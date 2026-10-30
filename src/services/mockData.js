/**
 * Realistic mock data matching the frontend's expected format.
 * Used exclusively for local offline testing when DEV_MOCK_FALLBACK=true.
 */

export const MOCK_PROFILE = {
  name: 'S JIGNESH',
  studentId: 'AP25110010807',
  regNo: 'AP25110010807',
  institution: 'School of Engineering and Sciences (College)',
  semester: 'III SEMESTER',
  program: 'B.Tech.-Computer Science and Engineering [UG - Full Time]',
  section: 'A',
  programSection: 'B.Tech.-Computer Science and Engineering [UG - Full Time] / A',
  specialization: '',
  dob: '13-Dec-2007',
  gender: 'Male',
  dobGender: '13-Dec-2007 / Male',
  phone: '9100715947',
  contactNumber: '9100715947',
  phoneVerified: true,
  email: 'jignesh_s@srmap.edu.in',
  contactEmail: 'jignesh_s@srmap.edu.in',
  father: 'S GURUNADHAM',
  mother: 'S YASODA',
  parentNames: 'S GURUNADHAM / S YASODA'
};

export const MOCK_TIMETABLE = {
  days: {
    Mon: ['CSE 213:S 404', 'SEC 203:S 404', 'SEC 203:S 404', 'SEC 203:S 404', 0, 'CSE 202:C 804', 'CSE 202:C 804', 'MAT 279:C 504'],
    Tue: ['CSE 204:S 404', 'CSE 204:S 404', 'CSE 207:C 706', 'CSE 207:C 706', 0, 0, 'CSE 202:S 404', 'MAT 279:C 504'],
    Wed: ['CSE 203:S 404', 0, 'CSE 213:S 404', 'CSE 213:S 404', 0, 'CSE 204:S 404', 0, 0],
    Thu: [0, 0, 'CSE 202:S 404', 'CSE 202:S 404', 0, 'CSE 207:S 404', 'CSE 204:C 501', 'CSE 204:C 501'],
    Fri: ['CSE 203:S 404', 'CSE 203:S 404', 'CSE 207:X 201', 'CSE 207:X 201', 0, 0, 'CSE 213:C 701', 'CSE 213:C 701'],
    Sat: [0, 0, 0, 0, 0, 0, 0, 0]
  },
  subjects: [
    {
      code: 'CSE 202',
      name: 'OBJECT ORIENTED PROGRAMMING WITH C++',
      ltpc: '3-0-1-4',
      faculty: ['Dr. Lipismita Panigrahi (25065)', 'Dr. Pratik Roy (22296)'],
      rooms: ['C 804', 'S 404']
    },
    {
      code: 'CSE 203',
      name: 'DISCRETE MATHEMATICS',
      ltpc: '3-0-0-3',
      faculty: ['Dr. Kamalesh Saha (25155)'],
      rooms: ['S 404']
    },
    {
      code: 'CSE 204',
      name: 'DESIGN AND ANALYSIS OF ALGORITHMS',
      ltpc: '3-0-1-4',
      faculty: ['Dr. Kunal Dey (25366)', 'Dr. Morampudi Mahesh Kumar (21034)'],
      rooms: ['C 501', 'S 404']
    },
    {
      code: 'CSE 207',
      name: 'DIGITAL ELECTRONICS',
      ltpc: '3-0-1-4',
      faculty: ['Dr. Dandupalli Venkata Siva Prasad (26136)', 'Dr. Pothapakula Naveen Kumar (26306)'],
      rooms: ['C 706', 'S 404', 'X 201']
    },
    {
      code: 'CSE 213',
      name: 'ADVANCED JAVA PROGRAMMING',
      ltpc: '3-0-1-4',
      faculty: ['Dr. Aditya Kumar Sahu (25346)', 'Mr. Atul Kumar (26205)'],
      rooms: ['C 701', 'S 404']
    },
    {
      code: 'MAT 279',
      name: 'STOCHASTIC CALCULUS FOR FINANCIAL ENGINEERING',
      ltpc: '3-0-0-3',
      faculty: ['Dr. Sazzad Ali Biswas (21044)'],
      rooms: ['C 504']
    },
    {
      code: 'SEC 203',
      name: 'APTITUDE FOR ENGINEERS - III',
      ltpc: '1-0-1-2',
      faculty: ['Mr. Skilling Course Six Two (tmp062)'],
      rooms: ['S 404']
    }
  ],
  periods: [
    ['09:00', '09:50'],
    ['10:00', '10:50'],
    ['11:00', '11:50'],
    ['12:00', '12:50'],
    ['13:00', '13:50'],
    ['14:00', '14:50'],
    ['15:00', '15:50'],
    ['16:00', '17:30']
  ]
};

export const MOCK_ATTENDANCE = {
  from: '03/Aug/2026',
  to: '27/Oct/2026',
  rows: [
    ['CSE 202', 49, 46, 0, 3, 93.88, 4.0, 97.88],
    ['CSE 203', 28, 26, 2, 0, 92.86, 0.0, 92.86],
    ['CSE 204', 52, 48, 2, 2, 92.31, 3.0, 95.31],
    ['CSE 207', 51, 45, 4, 2, 88.24, 3.0, 91.24],
    ['CSE 213', 48, 45, 2, 1, 93.75, 1.0, 94.75],
    ['MAT 279', 18, 16, 0, 2, 88.89, 7.0, 95.89],
    ['SEC 203', 30, 27, 0, 3, 90.0, 6.0, 96.0]
  ],
  summary: {
    totalConducted: 276,
    totalPresent: 253,
    totalAbsent: 10,
    totalOdml: 13,
    averagePercentage: 94.85
  }
};

export const MOCK_MARKS = {
  rows: [
    ['CSE 202', 18.8, 50],
    ['CSE 203', 28.0, 50],
    ['CSE 204', 18.44, 50],
    ['CSE 207', 26.0, 50],
    ['CSE 213', 25.33, 50],
    ['MAT 279', 30.0, 50],
    ['SEC 203', 11.2, 40]
  ],
  subjects: [
    { code: 'CSE 202', description: 'OBJECT ORIENTED PROGRAMMING WITH C++', obtained: 18.8, max: 50 },
    { code: 'CSE 203', description: 'DISCRETE MATHEMATICS', obtained: 28.0, max: 50 },
    { code: 'CSE 204', description: 'DESIGN AND ANALYSIS OF ALGORITHMS', obtained: 18.44, max: 50 },
    { code: 'CSE 207', description: 'DIGITAL ELECTRONICS', obtained: 26.0, max: 50 },
    { code: 'CSE 213', description: 'ADVANCED JAVA PROGRAMMING', obtained: 25.33, max: 50 },
    { code: 'MAT 279', description: 'STOCHASTIC CALCULUS FOR FINANCIAL ENGINEERING', obtained: 30.0, max: 50 },
    { code: 'SEC 203', description: 'APTITUDE FOR ENGINEERS - III', obtained: 11.2, max: 40 }
  ]
};

