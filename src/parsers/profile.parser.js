import * as cheerio from 'cheerio';

/**
 * Clean and normalize text extracted from HTML.
 *
 * @param {string} text
 * @returns {string}
 */
function clean(text) {
  if (!text) return '';
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse student profile HTML returned by SRM report endpoint (ids=1).
 *
 * @param {string} html - Raw HTML from SRM portal
 * @returns {object} Normalized student profile object
 */
export function parseProfileHtml(html) {
  if (!html || typeof html !== 'string') {
    return {
      name: '',
      studentId: '',
      regNo: '',
      institution: '',
      semester: '',
      program: '',
      section: '',
      programSection: '',
      specialization: '',
      dob: '',
      gender: '',
      dobGender: '',
      phone: '',
      contactNumber: '',
      phoneVerified: false,
      email: '',
      contactEmail: '',
      father: '',
      mother: '',
      parentNames: ''
    };
  }

  const $ = cheerio.load(html);

  // Collect key-value pairs from tables, definition lists, or label-value spans
  const map = new Map();

  // Pattern 1: Table rows with key-value pairs across <td> elements
  // Handles both standard 2/4-cell tables and real SRM tables with colon separator cells:
  // e.g. <td width="40%">Student Name</td> <td width="5%">:</td> <td><b>S JIGNESH</b></td>
  $('tr').each((_, tr) => {
    const allCells = $(tr).find('th, td').toArray();
    const meaningful = [];
    for (const c of allCells) {
      const t = clean($(c).text());
      // Skip pure separator cells
      if (t !== ':' && t !== ':-') {
        meaningful.push(t);
      }
    }

    for (let i = 0; i + 1 < meaningful.length; i += 2) {
      const key = meaningful[i].replace(/[:：]$/, '').trim().toLowerCase();
      const val = meaningful[i + 1].trim();
      if (key && val) {
        map.set(key, val);
      }
    }
  });

  // Pattern 2: Definition lists or divs with label/value structure
  $('dl').each((_, dl) => {
    $(dl).find('dt').each((_, dt) => {
      const key = clean($(dt).text()).replace(/[:：]$/, '').trim().toLowerCase();
      const val = clean($(dt).next('dd').text());
      if (key && val) {
        map.set(key, val);
      }
    });
  });

  // Helper to look up exact keys first, then fallback to substring
  const getExact = (...keys) => {
    for (const k of keys) {
      const lower = k.toLowerCase();
      if (map.has(lower)) return map.get(lower);
    }
    return '';
  };

  const getSub = (...keys) => {
    for (const k of keys) {
      const lower = k.toLowerCase();
      for (const [mk, mv] of map.entries()) {
        if (mk.includes(lower)) return mv;
      }
    }
    return '';
  };

  const name = getExact('student name', 'candidate name', 'name') || getSub('student name');
  const regNo = getExact('registration number', 'register no.', 'register no', 'reg no', 'reg. no', 'roll no', 'student id') || getSub('registration number', 'register no');
  const institution = getExact('institution', 'college', 'school') || getSub('institution');
  const semester = getExact('semester', 'current semester') || getSub('semester');
  const specialization = getExact('specialization', 'branch') || getSub('specialization');

  let program = getExact('program', 'degree', 'course');
  let section = getExact('section', 'sec');
  const progSec = getExact('program / section', 'program/section') || getSub('program / section');
  if (progSec) {
    const parts = progSec.split('/');
    if (parts.length >= 2) {
      program = program || parts[0].trim();
      section = section || parts[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  if (!program) program = getSub('program');
  if (!section) section = getSub('section');

  let dob = getExact('date of birth', 'dob');
  let gender = getExact('gender', 'sex');
  const dobGenderVal = getExact('d.o.b. / gender', 'dob / gender', 'dob/gender', 'd.o.b / gender') || getSub('d.o.b. / gender', 'dob / gender');
  if (dobGenderVal) {
    const parts = dobGenderVal.split('/');
    if (parts.length >= 2) {
      dob = dob || parts[0].trim();
      gender = gender || parts[1].trim();
    }
  }
  if (!dob) dob = getSub('date of birth');
  if (!gender) gender = getSub('gender');

  let phone = getExact('student mobile no', 'student mobile', 'mobile number', 'mobile no', 'contact number', 'phone');
  let email = getExact('student email', 'email id', 'email');
  const contactEmail = getExact('student contact number / email', 'contact number / email', 'contact number/email') || getSub('contact number / email');
  if (contactEmail) {
    const parts = contactEmail.split('/');
    if (parts.length >= 2) {
      const rawPhone = parts[0].replace(/\(Verified\s*\)/i, '').trim();
      phone = phone || rawPhone;
      email = email || parts[1].trim();
    }
  }
  if (!phone) phone = getSub('student mobile', 'mobile no');
  if (!email) email = getSub('student email');

  let father = getExact('father name', 'father');
  let mother = getExact('mother name', 'mother');
  const parentNames = getExact('father name / mother name', 'parent names', 'parents') || getSub('father name / mother name');
  if (parentNames) {
    const parts = parentNames.split('/');
    if (parts.length >= 2) {
      father = father || parts[0].trim();
      mother = mother || parts[1].trim();
    }
  }
  if (!father) father = getSub('father name');
  if (!mother) mother = getSub('mother name');

  const programSection = program && section ? `${program} / ${section}` : program || section || '';
  const dobGender = dob && gender ? `${dob} / ${gender}` : dob || gender || '';
  const finalParentNames = [father, mother].filter(Boolean).join(' / ');

  return {
    name,
    studentId: regNo,
    regNo,
    institution,
    semester,
    program,
    section,
    programSection,
    specialization,
    dob,
    gender,
    dobGender,
    phone,
    contactNumber: phone,
    phoneVerified: Boolean(phone),
    email,
    contactEmail: email,
    father,
    mother,
    parentNames: finalParentNames
  };
}

