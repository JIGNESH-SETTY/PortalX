"use strict";

/* =========================================================
   PortalX script. Sections:
   1. Sample data (NOT from the backend)
   2. Small helpers
   3. API layer (real: /api/student and /api/attendance)
   4. Login (prototype only)
   5. Rendering: profile, home, attendance, courses, marks, results
   6. Timetable: day tabs and the class wheel
   7. Navigation, reveal animation and events
   ========================================================= */

/* ---------- 1. DATA SHAPE + SAMPLE DATA ----------
   THE TIMETABLE CONTRACT. The UI draws whatever it receives in this shape,
   so a student with 6 or 9 periods, or a Saturday with no classes, just works.
   Your Cheerio parser (see parseTimetable.example.js) should produce exactly this:

   {
     periods:  [ { label: "1", start: "09:00", end: "09:50" }, ... ],   // 24-hour "HH:MM"
     days:     [ { name: "Monday",
                   slots: [ { code: "CSE 101", subjectName: "DATA STRUCTURES", location: "S 404" } | null, ... ] } ],
                 // slots[i] belongs to periods[i]; null = free period
     subjects: [ { code: "CSE 101", name: "DATA STRUCTURES", ltpc: "3-0-1-4",
                   faculty: [ { name: "Dr. A", id: "12345" } ], rooms: ["S 404"] } ]
   }

   Everything below is made-up SAMPLE data in that shape (isSample: true). */
const SAMPLE_SUBJECTS = [
  { code: "CSE 101", name: "DATA STRUCTURES", ltpc: "3-0-1-4", faculty: [{ name: "Dr. Sample One", id: "00001" }], rooms: ["S 404", "C 201"] },
  { code: "CSE 102", name: "OPERATING SYSTEMS", ltpc: "3-0-1-4", faculty: [{ name: "Dr. Sample Two", id: "00002" }, { name: "Mr. Sample Three", id: "00003" }], rooms: ["S 404"] },
  { code: "CSE 103", name: "COMPUTER NETWORKS", ltpc: "3-0-0-3", faculty: [{ name: "Dr. Sample Four", id: "00004" }], rooms: ["C 305"] },
  { code: "MAT 101", name: "LINEAR ALGEBRA", ltpc: "3-0-0-3", faculty: [{ name: "Dr. Sample Five", id: "00005" }], rooms: ["S 404"] },
  { code: "SEC 101", name: "COMMUNICATION SKILLS", ltpc: "1-0-1-2", faculty: [{ name: "Ms. Sample Six", id: "00006" }], rooms: ["S 404"] },
];

const slot = (code, location) => ({ code, subjectName: SAMPLE_SUBJECTS.find((x) => x.code === code).name, location });

const SAMPLE_TIMETABLE = {
  isSample: true,
  periods: [
    { label: "1", start: "09:00", end: "09:50" }, { label: "2", start: "10:00", end: "10:50" },
    { label: "3", start: "11:00", end: "11:50" }, { label: "4", start: "12:00", end: "12:50" },
    { label: "5", start: "13:00", end: "13:50" }, { label: "6", start: "14:00", end: "14:50" },
    { label: "7", start: "15:00", end: "15:50" }, { label: "8", start: "16:00", end: "17:30" },
  ],
  days: [
    { name: "Monday",    slots: [slot("CSE 101", "S 404"), slot("MAT 101", "S 404"), slot("MAT 101", "S 404"), null, null, slot("CSE 102", "C 201"), slot("CSE 102", "C 201"), slot("CSE 103", "C 305")] },
    { name: "Tuesday",   slots: [slot("CSE 103", "C 305"), slot("CSE 103", "C 305"), slot("CSE 102", "S 404"), slot("CSE 102", "S 404"), null, null, slot("CSE 101", "S 404"), null] },
    { name: "Wednesday", slots: [slot("MAT 101", "S 404"), null, slot("CSE 101", "S 404"), slot("CSE 101", "S 404"), null, slot("SEC 101", "S 404"), null, null] },
    { name: "Thursday",  slots: [null, null, slot("CSE 102", "S 404"), slot("CSE 102", "S 404"), null, slot("CSE 103", "S 404"), slot("CSE 101", "C 201"), slot("CSE 101", "C 201")] },
    { name: "Friday",    slots: [slot("MAT 101", "S 404"), slot("MAT 101", "S 404"), slot("CSE 103", "S 404"), slot("CSE 103", "S 404"), null, null, slot("SEC 101", "S 404"), slot("SEC 101", "S 404")] },
    { name: "Saturday",  slots: [null, null, null, null, null, null, null, null] },
  ],
  subjects: SAMPLE_SUBJECTS,
};

const SAMPLE_MARKS = [
  { code: "CSE 101", assessments: [{ name: "Quiz 1", got: 8, max: 10 }, { name: "Mid-term 1", got: 21, max: 25 }] },
  { code: "MAT 101", assessments: [{ name: "Quiz 1", got: 7, max: 10 }, { name: "Mid-term 1", got: 18, max: 25 }] },
];

const SAMPLE_RESULTS = {
  cgpa: 8.4,
  semesters: [
    { name: "Semester 1", sgpa: 8.2, subjects: [{ code: "CSE 001", name: "Programming Basics", grade: "A" }, { code: "MAT 001", name: "Calculus", grade: "B+" }] },
    { name: "Semester 2", sgpa: 8.6, subjects: [{ code: "CSE 002", name: "Object Oriented Programming", grade: "A+" }, { code: "PHY 001", name: "Physics", grade: "A" }] },
  ],
};

/* ---------- 2. HELPERS ---------- */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function $(id) { return document.getElementById(id); }

// Builds an element. Uses textContent so API data can never inject HTML.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showMessage(container, text, isError) {
  container.replaceChildren(el("p", isError ? "msg error" : "msg", text));
}

function orNotAvailable(value) {
  return value === undefined || value === null || value === "" ? "Not available" : String(value);
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function todayName() {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

// "past", "current" or "upcoming", judged by the device clock.
function statusOf(period) {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes >= toMinutes(period.end)) return "past";
  if (minutes >= toMinutes(period.start)) return "current";
  return "upcoming";
}

function courseName(code) {
  const subject = timetable && timetable.subjects.find((x) => x.code === code);
  return subject ? subject.name : code;
}

// The portal writes locations like "S 404". We read that as block "S", room "404".
// If your campus uses another pattern, change only this function.
function splitLocation(location) {
  const match = /^(\S+)\s+(.+)$/.exec(location || "");
  return match ? { block: match[1], room: match[2] } : { block: "", room: location || "" };
}

// Turns one period + slot into the text every timetable widget shows.
function describe(period, entry) {
  const time = `${period.start} to ${period.end}`;
  if (period.isBreak) return { time, title: "Break", sub: "Time to recharge", kind: "rest" };
  if (!entry) return { time, title: "Free period", sub: "No class scheduled", kind: "free" };
  const { block, room } = splitLocation(entry.location);
  const place = block ? `Block ${block}, Room ${room}` : room ? `Room ${room}` : "";
  return { time, title: entry.code, sub: entry.subjectName || courseName(entry.code), place, kind: "class" };
}

/* ---------- 3. API LAYER ---------- */
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned status ${response.status}`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${url} did not return valid JSON`);
  }
}

// Each request is stored so the same data is never fetched twice at once.
let studentRequest = null;
let attendanceRequest = null;

function loadStudent() {
  if (!studentRequest) {
    studentRequest = fetchJson("/api/student").then((data) => {
      if (!data || typeof data !== "object") throw new Error("Unexpected student data");
      return {
        studentId: data.studentId ?? data.Studentid, // backend has used both spellings
        name: data.name,
        department: data.department,
        year: data.year,
      };
    });
    studentRequest.catch(() => { studentRequest = null; }); // allow a retry
  }
  return studentRequest;
}

function loadAttendance() {
  if (!attendanceRequest) {
    attendanceRequest = fetchJson("/api/attendance").then((data) => {
      if (!data || typeof data.overall !== "number" || !Array.isArray(data.subjects)) {
        throw new Error("Unexpected attendance data");
      }
      return data;
    });
    attendanceRequest.catch(() => { attendanceRequest = null; });
  }
  return attendanceRequest;
}

let timetable = null;          // filled by initTimetable(); null means "unavailable"
let timetableReady = Promise.resolve();

// "01:00" -> "13:00". The portal prints 12-hour times without AM/PM, so hours before 8 are afternoon.
function to24Hour(text) {
  const [hours, minutes] = String(text).trim().split(":").map(Number);
  return `${String(hours < 8 ? hours + 12 : hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// Checks the data and tidies it, so the rest of the page can trust it.
// It is forgiving on purpose. Accepted variations:
//   period: { start, end }  OR  { time: "09:00 To 09:50" }   (12-hour times like "01:00" are fixed automatically)
//   day:    { name } or { day }
//   slot:   { code, subjectName | title | name, location | room }, or null / empty for a free period
//           (code may also be written "CSE 213(S 404)", the "(...)" part becomes the location)
//   subject: faculty and rooms can be an array or a single string
function normalizeTimetable(raw) {
  if (!raw || !Array.isArray(raw.periods) || !Array.isArray(raw.days)) throw new Error("Unexpected timetable data");
  const toList = (value) => (Array.isArray(value) ? value : value ? [value] : []);

  const periods = raw.periods.map((p, i) => {
    const [start, end] = p.start && p.end ? [p.start, p.end] : String(p.time || "").split(/\bto\b/i);
    if (!/^\s*\d{1,2}:\d{2}\s*$/.test(start || "") || !/^\s*\d{1,2}:\d{2}\s*$/.test(end || "")) {
      throw new Error(`Timetable period ${i + 1} needs a start and end time like "09:00"`);
    }
    return { label: String(p.label ?? i + 1), start: to24Hour(start), end: to24Hour(end) };
  });

  const days = raw.days.map((d) => ({
    name: String(d.name ?? d.day),
    slots: periods.map((period, i) => {
      const cell = Array.isArray(d.slots) ? d.slots[i] : null; // missing cells become free periods
      if (!cell || !String(cell.code || "").trim()) return null;
      const match = /^(.*?)\s*\((.+)\)\s*$/.exec(String(cell.code).trim()); // "CSE 213(S 404)"
      return {
        code: match ? match[1].trim() : String(cell.code).trim(),
        subjectName: String(cell.subjectName ?? cell.title ?? cell.name ?? "").trim(),
        location: String(cell.location ?? cell.room ?? (match ? match[2] : "")).trim(),
      };
    }),
  }));

  const subjects = toList(raw.subjects).map((s) => ({
    code: s.code,
    name: s.name,
    ltpc: s.ltpc,
    faculty: toList(s.faculty).map((f) => (typeof f === "string" ? { name: f } : f)),
    rooms: toList(s.rooms),
  }));

  return { isSample: Boolean(raw.isSample), periods, days, subjects };
}

/* THE ONE PLACE TO CONNECT YOUR BACKEND.
   Once your server returns the Cheerio output as JSON, replace the body with:
     const raw = await fetchJson("/api/timetable");
     return normalizeTimetable(raw);
   Nothing else in this file needs to change. */

async function loadTimetable() {
  const response = await fetch("/api/timetable");

  if (!response.ok) {
    throw new Error("Failed to load timetable from the server");
  }

  const data = await response.json();

  return normalizeTimetable(data);
}


/* ---------- 4. LOGIN (PROTOTYPE) ----------
   This does NOT authenticate anyone. Replace the body of signIn() with a
   fetch("/api/login", ...) call when a real endpoint exists. */
async function signIn(studentId, password) {
  return { ok: true, prototype: true };
}

function validateLogin(studentId, password) {
  const errors = {};
  if (studentId.trim().length < 3) errors.id = "Enter your student ID.";
  if (password.length === 0) errors.pw = "Enter your password.";
  return errors;
}

/* ---------- 5. RENDERING ---------- */
// Used by BOTH the landing page and the Profile section, so there is one copy of the data.
async function renderProfile(container) {
  showMessage(container, "Loading your profile...");
  try {
    const s = await loadStudent();
    const initials = s.name ? s.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?";

    const hero = el("div", "hero");
    const text = el("div");
    text.append(el("h2", "", orNotAvailable(s.name)), el("p", "", orNotAvailable(s.studentId)));
    hero.append(el("div", "avatar", initials), text);

    const facts = el("dl", "facts");
    for (const [label, value] of [["Student ID", s.studentId], ["Department", s.department], ["Year", s.year], ["Semester", undefined]]) {
      const row = el("div");
      row.append(el("dt", "", label), el("dd", "", orNotAvailable(value))); // Semester: not in /api/student yet
      facts.appendChild(row);
    }
    const card = el("div", "card facts-card");
    card.appendChild(facts);
    container.replaceChildren(hero, card);
  } catch (error) {
    console.error(error);
    showMessage(container, "Could not load your profile. Check that the server is running, then try again.", true);
  }
}

function makeTile(view, title, value, caption, extraClass) {
  const tile = el("button", `tile ${extraClass || ""}`);
  tile.type = "button";
  tile.dataset.go = view;
  const top = el("span", "tile-title", title);
  const bottom = el("div");
  bottom.append(el("strong", "tile-value", value), el("span", "tile-cap", caption));
  tile.append(top, bottom);
  return tile;
}

function renderHome() {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  $("greeting").textContent = `Good ${part}`;
  $("today-date").textContent = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
  loadStudent().then((s) => { if (s.name) $("greeting").textContent = `Good ${part}, ${s.name.split(" ")[0]}`; }).catch(() => {});

  // Attendance tile: the only tile with real data besides the profile.
  const attendance = el("button", "tile dark-tile wide");
  attendance.type = "button";
  attendance.dataset.go = "attendance";
  const pie = el("div", "pie");
  const pieText = el("strong", "", "--");
  pie.appendChild(pieText);
  const caption = el("span", "tile-cap", "Loading...");
  const left = el("div");
  left.append(el("span", "tile-title", "Attendance"), el("strong", "tile-value", "Overall"), caption);
  attendance.append(left, pie);
  loadAttendance()
    .then((data) => {
      pieText.textContent = `${data.overall}%`;
      pie.style.setProperty("--p", data.overall);
      caption.textContent = "Across all subjects";
    })
    .catch(() => { caption.textContent = "Unavailable. Open to retry."; });

  // Next class tile (sample timetable).
  const items = todayItems();
  const next = items && items.find((i) => i.entry && i.status !== "past");
  const nextTile = next
    ? makeTile("timetable", next.status === "current" ? "Class now" : "Next class", next.entry.code, `${next.desc.time}, ${next.desc.place}`, "wide amber")
    : makeTile("timetable", "Timetable", items ? "Done for today" : "No classes today", "Sample data", "wide amber");

  const profileTile = makeTile("profile", "Profile", "View", "Your details");
  $("home-grid").replaceChildren(
    attendance, nextTile,
    makeTile("marks", "Internal marks", `${SAMPLE_MARKS.length} subjects`, "Sample data"),
    makeTile("courses", "Courses", timetable ? `${timetable.subjects.length}` : "--", timetable && !timetable.isSample ? "This semester" : "Sample data"),
    makeTile("results", "CGPA", SAMPLE_RESULTS.cgpa.toFixed(2), "Sample data"),
    profileTile
  );
}

async function renderAttendance() {
  const body = $("attendance-body");
  const button = $("refresh-attendance");
  button.disabled = true;
  showMessage(body, "Loading attendance...");
  try {
    const data = await loadAttendance();
    const overall = el("div", "overall");
    overall.append(el("strong", "", `${data.overall}%`), el("span", "muted", "overall attendance"));
    const nodes = [overall];
    if (data.subjects.length === 0) nodes.push(el("p", "msg", "No subject attendance has been recorded yet."));

    for (const subject of data.subjects) {
      const percent = Number(subject.attendance ?? subject.atendance); // backend has used both spellings
      const valid = Number.isFinite(percent) && percent >= 0 && percent <= 100;
      const low = valid && percent < 75;

      const top = el("div", "subject-top");
      top.append(el("span", "subject-name", orNotAvailable(subject.name)), el("span", low ? "pct low" : "pct", valid ? `${percent}%${low ? " (low)" : ""}` : "N/A"));
      const fill = el("i", low ? "low" : "");
      fill.style.width = "0%";
      const bar = el("div", "bar");
      bar.appendChild(fill);
      const row = el("div", "subject");
      row.append(top, bar);
      if (Number.isFinite(subject.attended) && Number.isFinite(subject.total)) {
        row.appendChild(el("p", "small", `${subject.attended} of ${subject.total} classes attended`)); // only if the API sends counts
      }
      nodes.push(row);
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = valid ? `${percent}%` : "0%"; })); // bars grow in
    }
    body.replaceChildren(...nodes);
  } catch (error) {
    console.error(error);
    showMessage(body, "Could not load attendance. Check that the server is running, then press Refresh.", true);
  } finally {
    button.disabled = false;
  }
}

function renderCourses() {
  const body = $("courses-body");
  if (!timetable) { showMessage(body, "Courses are unavailable right now. Please try again later.", true); return; }
  if (timetable.subjects.length === 0) { showMessage(body, "No courses found for this semester."); return; }
  const rows = timetable.subjects.map((subject) => {
    const left = el("div");
    left.append(el("strong", "", orNotAvailable(subject.name)), el("p", "code-tag", `${orNotAvailable(subject.code)}, L-T-P-C ${orNotAvailable(subject.ltpc)}`));
    const faculty = (subject.faculty || []).map((f) => f.name).join(", ");
    if (faculty) left.appendChild(el("p", "code-tag", faculty));
    if ((subject.rooms || []).length) left.appendChild(el("p", "code-tag", `Rooms: ${subject.rooms.join(", ")}`));
    const credits = Number(String(subject.ltpc || "").split("-").pop());
    const row = el("div", "item");
    row.appendChild(left);
    if (Number.isFinite(credits) && credits > 0) row.appendChild(el("span", "muted", `${credits} credits`)); // credits = last number of L-T-P-C
    return row;
  });
  body.replaceChildren(...rows);
}

function renderMarks() {
  const cards = SAMPLE_MARKS.map((subject) => {
    const card = el("div", "card");
    const title = el("div", "card-head");
    const names = el("div");
    names.append(el("h2", "", courseName(subject.code)), el("p", "code-tag", subject.code));
    title.appendChild(names);
    card.appendChild(title);
    let got = 0;
    let max = 0;
    for (const a of subject.assessments) {
      got += a.got;
      max += a.max;
      const row = el("div", "item");
      row.append(el("span", "", a.name), el("strong", "", `${a.got} / ${a.max}`));
      card.appendChild(row);
    }
    const total = el("div", "item"); // total is calculated from the rows above
    total.append(el("span", "", "Total"), el("span", "total", `${got} / ${max}`));
    card.appendChild(total);
    return card;
  });
  $("marks-body").replaceChildren(...cards);
}

function renderResults() {
  const latest = SAMPLE_RESULTS.semesters[SAMPLE_RESULTS.semesters.length - 1];
  const gpa = el("div", "gpa");
  for (const [value, label] of [[SAMPLE_RESULTS.cgpa, "CGPA"], [latest.sgpa, `SGPA, ${latest.name}`]]) {
    const card = el("div", "card");
    card.append(el("strong", "", value.toFixed(2)), el("span", "muted", label));
    gpa.appendChild(card);
  }
  const nodes = [gpa];
  for (const sem of SAMPLE_RESULTS.semesters) {
    const card = el("div", "card");
    const head = el("div", "card-head");
    head.append(el("h2", "", sem.name), el("span", "total", `SGPA ${sem.sgpa.toFixed(2)}`));
    card.appendChild(head);
    for (const s of sem.subjects) {
      const left = el("div");
      left.append(el("strong", "", s.name), el("p", "code-tag", s.code));
      const row = el("div", "item");
      row.append(left, el("strong", "", s.grade));
      card.appendChild(row);
    }
    nodes.push(card);
  }
  $("results-body").replaceChildren(...nodes);
}

/* ---------- 6. TIMETABLE ---------- */
function findDay(name) {
  return timetable ? timetable.days.find((d) => d.name.toLowerCase() === name.toLowerCase()) : undefined;
}

function dayHasClasses(day) {
  return day.slots.some(Boolean);
}

// Turns one day into an ordered list of items (classes, free periods and breaks).
// A gap of 20+ minutes between two periods is shown as a break.
function buildSchedule(day) {
  const items = [];
  timetable.periods.forEach((period, i) => {
    const previous = timetable.periods[i - 1];
    if (previous && toMinutes(period.start) - toMinutes(previous.end) >= 20) {
      items.push({ period: { start: previous.end, end: period.start, isBreak: true }, entry: null });
    }
    items.push({ period, entry: day.slots[i] });
  });
  return items.map((item) => ({ ...item, status: statusOf(item.period), desc: describe(item.period, item.entry) }));
}

// Today's items, or null on days without classes (or when data is unavailable).
function todayItems() {
  const day = findDay(todayName());
  return day && dayHasClasses(day) ? buildSchedule(day) : null;
}

/* Day tabs: today is selected automatically; otherwise the first day that has classes. */
let selectedDay = "";

function renderDayTabs() {
  if (!timetable) { $("day-tabs").replaceChildren(); return; }
  const tabs = timetable.days.map((day) => {
    const isToday = day.name.toLowerCase() === todayName().toLowerCase();
    const button = el("button", isToday ? "today" : "", day.name.slice(0, 3));
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(day.name === selectedDay));
    button.setAttribute("aria-label", day.name);
    button.addEventListener("click", () => { selectedDay = day.name; renderDayTabs(); renderDayPanel(); });
    return button;
  });
  $("day-tabs").replaceChildren(...tabs);
}

function renderDayPanel() {
  const panel = $("day-panel");
  if (!timetable) { showMessage(panel, "Timetable is unavailable right now. Please try again later.", true); return; }
  const day = findDay(selectedDay);
  if (!day) { showMessage(panel, "No timetable days to show."); return; }
  const isToday = day.name.toLowerCase() === todayName().toLowerCase();
  const today = findDay(todayName());
  const notes = [];
  if (!isToday && !(today && dayHasClasses(today))) notes.push(el("p", "msg", `No classes today. Showing ${day.name}.`));
  if (!dayHasClasses(day)) { panel.replaceChildren(...notes, el("p", "msg", `No classes on ${day.name}.`)); return; }

  const rows = buildSchedule(day).map((item, i) => {
    const d = item.desc;
    const card = el("div", `daycard ${d.kind} ${isToday ? item.status : ""}`);
    card.append(el("strong", "", d.title), el("p", "", d.place ? `${d.sub}, ${d.place}` : d.sub));
    const row = el("div", "dayrow rise");
    row.style.setProperty("--i", i);
    const time = el("time", "", `${item.period.start}\n${item.period.end}`);
    time.style.whiteSpace = "pre-line";
    row.append(time, card);
    return row;
  });
  panel.replaceChildren(...notes, ...rows);
}

/* The class wheel.
   ringPos is a decimal index: 2.0 means item 2 sits at the top centre.
   Dragging changes ringPos; releasing springs it back to ringHome (the current class). */
const RING_STEP_PX = 85;     // finger movement needed to turn one item
const RING_ANGLE = 21;       // degrees between neighbouring items
let ringItems = [];
let ringNodes = [];
let ringPos = 0;
let ringHome = 0;
let ringFrame = 0;
let ringTimer = 0;
let ringShown = -1;
let ringDragging = false;

function drawRing() {
  ringNodes.forEach((node, i) => {
    const distance = i - ringPos;
    const far = Math.abs(distance);
    node.style.transform = `rotate(${distance * RING_ANGLE}deg) scale(${1 - Math.min(far, 3) * 0.07})`;
    node.style.opacity = Math.max(0.15, 1 - far * 0.28);
    node.style.zIndex = 100 - Math.round(far * 10);
  });
  const nearest = Math.max(0, Math.min(ringItems.length - 1, Math.round(ringPos)));
  if (nearest !== ringShown) { // update the text only when a different item reaches the centre
    ringShown = nearest;
    ringNodes.forEach((node, i) => node.classList.toggle("focus", i === nearest));
    showRingReadout(ringItems[nearest]);
  }
}

function showRingReadout(item) {
  const box = $("ring-readout");
  if (!item) return;
  const label = { past: "Completed", current: "Happening now", upcoming: "Upcoming" }[item.status];
  const detail = item.desc.place ? `${item.desc.sub}, ${item.desc.place}` : item.desc.sub;
  const chip = el("span", `chip ${item.status}`, `${label}, ${item.desc.time}`);
  box.replaceChildren(el("strong", "", item.desc.title), el("span", "muted", detail), el("br"), chip);
}

// Spring: pull ringPos toward ringHome with a little bounce.
function springHome() {
  cancelAnimationFrame(ringFrame);
  if (reduceMotion) { ringPos = ringHome; drawRing(); return; }
  let velocity = 0;
  function step() {
    velocity = (velocity + (ringHome - ringPos) * 0.08) * 0.84;
    ringPos += velocity;
    drawRing();
    if (Math.abs(velocity) > 0.0005 || Math.abs(ringHome - ringPos) > 0.002) ringFrame = requestAnimationFrame(step);
    else { ringPos = ringHome; drawRing(); }
  }
  step();
}

function returnSoon() { // short pause so the person can read, then spring back
  clearTimeout(ringTimer);
  ringTimer = setTimeout(springHome, 800);
}

function renderRing() {
  const items = todayItems();
  const stage = $("ring-stage");
  if (!items) {
    ringItems = []; ringNodes = [];
    stage.replaceChildren();
    const message = timetable ? ["No classes today", "Enjoy the day off."] : ["Timetable unavailable", "Please try again later."];
    $("ring-readout").replaceChildren(el("strong", "", message[0]), el("span", "muted", message[1]));
    return;
  }
  ringItems = items;
  ringNodes = items.map((item) => {
    const node = el("div", `rc ${item.status} ${item.desc.kind}`);
    node.append(el("p", "rc-time", item.period.start), el("p", "rc-code", item.desc.title));
    node.appendChild(el("p", "rc-place", item.desc.place ? item.desc.place : item.desc.kind === "rest" ? "" : "Free"));
    return node;
  });
  stage.replaceChildren(...ringNodes);

  // Home = the current class, otherwise the next upcoming one, otherwise the last one.
  let home = items.findIndex((i) => i.status === "current");
  if (home === -1) home = items.findIndex((i) => i.status === "upcoming");
  if (home === -1) home = items.length - 1;
  const firstDraw = ringHome === 0 && ringPos === 0 && ringShown === -1;
  ringHome = home;
  ringShown = -1;
  if (firstDraw) ringPos = home;
  drawRing();
  if (!ringDragging && !firstDraw) springHome();
}

function setupRing() {
  const ring = $("ring");
  let startX = 0;
  let startPos = 0;
  const clamp = (value) => Math.max(-0.5, Math.min(ringItems.length - 0.5, value));

  ring.addEventListener("pointerdown", (event) => {
    if (ringItems.length === 0) return;
    ringDragging = true;
    startX = event.clientX;
    startPos = ringPos;
    cancelAnimationFrame(ringFrame);
    clearTimeout(ringTimer);
    ring.setPointerCapture(event.pointerId);
  });
  ring.addEventListener("pointermove", (event) => {
    if (!ringDragging) return;
    ringPos = clamp(startPos - (event.clientX - startX) / RING_STEP_PX); // drag left = ring turns left
    drawRing();
  });
  const release = () => { if (ringDragging) { ringDragging = false; returnSoon(); } };
  ring.addEventListener("pointerup", release);
  ring.addEventListener("pointercancel", release);

  ring.addEventListener("keydown", (event) => { // keyboard users can turn it too
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    cancelAnimationFrame(ringFrame);
    ringPos = clamp(Math.round(ringPos) + (event.key === "ArrowRight" ? 1 : -1));
    drawRing();
    returnSoon();
  });
}

/* ---------- 7. NAVIGATION, REVEAL AND EVENTS ---------- */
const VIEW_TITLES = {
  home: "Dashboard", profile: "Profile", attendance: "Mark Attendance", timetable: "Timetable",
  marks: "Internal Marks", courses: "Subjects and Courses", results: "Results",
};

// The six sections in nav order. Swiping and tapping move along this list.
const SECTION_ORDER = ["profile", "attendance", "timetable", "marks", "courses", "results"];
let currentView = "home";

function showView(name, baseDelay) {
  // +1 = moving forward in the nav order, -1 = backward, 0 = no sliding (e.g. from Home)
  const from = SECTION_ORDER.indexOf(currentView);
  const to = SECTION_ORDER.indexOf(name);
  const direction = from >= 0 && to >= 0 && from !== to ? Math.sign(to - from) : 0;
  currentView = name;

  for (const key of Object.keys(VIEW_TITLES)) $(`view-${key}`).hidden = key !== name;
  for (const button of document.querySelectorAll("#main-nav button")) {
    if (button.dataset.view === name) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  $("page-title").textContent = VIEW_TITLES[name];
  window.scrollTo(0, 0);

  if (name === "home") renderHome();
  if (name === "profile") renderProfile($("profile-body"));
  if (name === "attendance") renderAttendance();
  if (name === "timetable") { renderRing(); renderDayPanel(); }
  if (reduceMotion) return;

  const view = $(`view-${name}`);
  if (direction !== 0) { // new page slides in from the side it lives on
    view.animate(
      [{ transform: `translateX(${direction * 40}%)`, opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: 340, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
    return;
  }
  // Otherwise the blocks of this view rise in one after another.
  view.style.setProperty("--base", `${baseDelay || 0}ms`);
  view.querySelectorAll(":scope > *, .bento > *, #marks-body > *, #results-body > *").forEach((node, i) => {
    node.classList.remove("rise");
    node.style.setProperty("--i", i);
    void node.offsetWidth; // restart the animation
    node.classList.add("rise");
  });
}

/* Swipe between sections (touch only), like swiping between tabs in Instagram.
   The page follows your finger; let go past ~28% of the screen (or flick fast) to change page. */
function setupSwipe() {
  const shell = document.querySelector(".shell");
  let mode = "idle"; // idle | pending | horizontal | ignore
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let dragX = 0;
  let view = null;

  function hasNeighbour(dx) {
    const index = SECTION_ORDER.indexOf(currentView);
    return dx < 0 ? index < SECTION_ORDER.length - 1 : index > 0;
  }

  shell.addEventListener("pointerdown", (event) => {
    const inSwipeArea = SECTION_ORDER.includes(currentView) && !event.target.closest("#ring, input");
    if (event.pointerType !== "touch" || !inSwipeArea) { mode = "ignore"; return; }
    mode = "pending";
    startX = event.clientX; startY = event.clientY; startTime = event.timeStamp; dragX = 0;
    view = $(`view-${currentView}`);
  });

  shell.addEventListener("pointermove", (event) => {
    if (mode === "pending") { // decide: is this a sideways swipe or a normal vertical scroll?
      const moveX = event.clientX - startX;
      const moveY = event.clientY - startY;
      if (Math.abs(moveX) > 10 && Math.abs(moveX) > Math.abs(moveY) * 1.5) {
        mode = "horizontal";
        shell.setPointerCapture(event.pointerId);
      } else if (Math.abs(moveY) > 10) mode = "ignore";
    }
    if (mode !== "horizontal") return;
    dragX = event.clientX - startX;
    const pull = hasNeighbour(dragX) ? dragX : dragX * 0.25; // resist at the first and last page
    view.style.transition = "none";
    view.style.transform = `translateX(${pull}px)`;
    view.style.opacity = String(1 - Math.min(Math.abs(pull) / (innerWidth * 1.3), 0.6));
  });

  function endSwipe(event) {
    if (mode !== "horizontal") { mode = "idle"; return; }
    mode = "idle";
    const direction = dragX < 0 ? 1 : -1;
    const target = SECTION_ORDER[SECTION_ORDER.indexOf(currentView) + direction];
    const flick = Math.abs(dragX) / Math.max(event.timeStamp - startTime, 1) > 0.6;
    const commit = target && (Math.abs(dragX) > innerWidth * 0.28 || flick);
    const swiped = view;

    if (commit) { // slide the old page away, then load the next one
      swiped.style.transition = "transform 0.2s ease-in, opacity 0.2s";
      swiped.style.transform = `translateX(${-direction * innerWidth}px)`;
      swiped.style.opacity = "0";
      setTimeout(() => {
        swiped.style.cssText = "";
        showView(target);
      }, 200);
    } else { // not far enough: spring back
      swiped.style.transition = "transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.25), opacity 0.3s";
      swiped.style.transform = "translateX(0)";
      swiped.style.opacity = "1";
      setTimeout(() => { swiped.style.cssText = ""; }, 400);
    }
  }
  shell.addEventListener("pointerup", endSwipe);
  shell.addEventListener("pointercancel", endSwipe);
}

// Circle of the dashboard grows out of the button the person pressed.
function openDashboard() {
  const box = $("open-dashboard").getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const app = $("app");
  app.hidden = false;
  app.classList.add("revealing");
  showView("home", reduceMotion ? 0 : 450);
  const finish = () => { app.classList.remove("revealing"); $("landing").hidden = true; };
  if (reduceMotion) return finish();
  app.animate(
    [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${radius}px at ${x}px ${y}px)` }],
    { duration: 900, easing: "cubic-bezier(0.7, 0, 0.2, 1)" }
  ).onfinish = finish;
}

function setupLogin() {
  const passwordInput = $("password");
  $("toggle-password").addEventListener("click", (event) => {
    const hidden = passwordInput.type === "password";
    passwordInput.type = hidden ? "text" : "password";
    event.target.textContent = hidden ? "Hide" : "Show";
    event.target.setAttribute("aria-pressed", String(hidden));
  });

  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const errors = validateLogin($("student-id").value, passwordInput.value);
    $("id-error").textContent = errors.id || "";
    $("pw-error").textContent = errors.pw || "";
    if (errors.id || errors.pw) return;

    await signIn($("student-id").value, passwordInput.value);
    await timetableReady; // make sure the timetable has loaded before any screen needs it
    passwordInput.value = ""; // never keep the password around
    $("login-view").hidden = true;
    $("landing").hidden = false;
    renderProfile($("landing-profile"));
  });
}

function setupApp() {
  for (const button of document.querySelectorAll("#main-nav button")) {
    button.addEventListener("click", () => showView(button.dataset.view));
  }
  $("home-btn").addEventListener("click", () => showView("home"));
  $("home-grid").addEventListener("click", (event) => {
    const tile = event.target.closest("[data-go]");
    if (tile) showView(tile.dataset.go);
  });
  $("open-dashboard").addEventListener("click", openDashboard);

  $("sign-out").addEventListener("click", () => {
    studentRequest = null;
    attendanceRequest = null;
    $("app").hidden = true;
    $("landing").hidden = true;
    $("login-view").hidden = false;
    $("login-form").reset();
  });

  $("refresh-attendance").addEventListener("click", () => {
    attendanceRequest = null; // force a fresh request
    renderAttendance();
  });

  // No endpoint accepts codes yet, so the page says so honestly.
  $("code-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = $("code-input").value.trim();
    $("code-status").className = code ? "msg" : "msg error";
    $("code-status").textContent = code ? "Code submission is not connected to a backend yet. Nothing was sent." : "Enter the code first.";
  });
  $("friend-btn").addEventListener("click", () => {
    $("friend-status").textContent = "This feature is not available yet.";
  });
}

async function initTimetable() {
  try {
    timetable = await loadTimetable();
  } catch (error) {
    console.error("Timetable error:", error);
    timetable = null;
  }
  // The "Sample data" badges only show while the sample timetable is in use.
  document.querySelectorAll(".sample-only").forEach((badge) => { badge.hidden = !(timetable && timetable.isSample); });
  const today = timetable && findDay(todayName());
  const firstBusyDay = timetable && timetable.days.find(dayHasClasses);
  selectedDay = today && dayHasClasses(today) ? today.name : firstBusyDay ? firstBusyDay.name : "";
  renderDayTabs();
  renderCourses();
  renderMarks();
}

function init() {
  setupLogin();
  setupApp();
  setupRing();
  setupSwipe();
  renderResults();
  timetableReady = initTimetable();
  // One timer: every minute, refresh the wheel and today's list so "current class" stays correct.
  setInterval(() => {
    if (!$("view-timetable").hidden) { renderRing(); renderDayPanel(); }
  }, 60000);
}

init();