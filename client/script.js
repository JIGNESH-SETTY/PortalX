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

/* ---------- 1. SAMPLE DATA ----------
   No endpoints exist for these yet. When they do, swap each constant
   for a fetchJson("/api/...") call. */
const C = (code, block, room) => ({ code, block, room });

const SAMPLE_PERIODS = [
  { start: "09:00", end: "09:50" },
  { start: "10:00", end: "10:50" },
  { start: "11:00", end: "11:50" },
  { start: "12:00", end: "13:00", isBreak: true },
  { start: "13:00", end: "13:50" },
  { start: "14:00", end: "14:50" },
  { start: "15:00", end: "15:50" },
];

// One entry per period (null = free). The lunch slot is always null.
const SAMPLE_WEEK = {
  Monday:    [C("CSE201", "AB1", "204"), C("MAT203", "AB2", "101"), null, null, C("CSE203", "AB1", "LAB-3"), C("CSE203", "AB1", "LAB-3"), C("HUM201", "AB3", "110")],
  Tuesday:   [C("MAT203", "AB2", "101"), C("CSE205", "AB1", "208"), C("CSE201", "AB1", "204"), null, null, C("HUM201", "AB3", "110"), null],
  Wednesday: [C("CSE203", "AB1", "206"), null, C("CSE205", "AB1", "208"), null, C("CSE201", "AB1", "LAB-1"), C("CSE201", "AB1", "LAB-1"), null],
  Thursday:  [C("CSE205", "AB1", "208"), C("CSE203", "AB1", "206"), C("MAT203", "AB2", "101"), null, null, null, C("HUM201", "AB3", "110")],
  Friday:    [C("CSE201", "AB1", "204"), C("CSE205", "AB1", "208"), null, null, C("MAT203", "AB2", "101"), null, null],
};

const SAMPLE_COURSES = [
  { name: "Data Structures", code: "CSE201", credits: 4 },
  { name: "Discrete Mathematics", code: "MAT203", credits: 3 },
  { name: "Database Management Systems", code: "CSE203", credits: 4 },
  { name: "Computer Organization", code: "CSE205", credits: 3 },
  { name: "Technical Communication", code: "HUM201", credits: 2 },
];

const SAMPLE_MARKS = [
  { code: "CSE201", assessments: [{ name: "Quiz 1", got: 8, max: 10 }, { name: "Mid-term 1", got: 21, max: 25 }] },
  { code: "MAT203", assessments: [{ name: "Quiz 1", got: 7, max: 10 }, { name: "Mid-term 1", got: 18, max: 25 }] },
];

const SAMPLE_RESULTS = {
  cgpa: 8.4,
  semesters: [
    { name: "Semester 1", sgpa: 8.2, subjects: [{ code: "CSE101", name: "Programming Basics", grade: "A" }, { code: "MAT101", name: "Calculus", grade: "B+" }] },
    { name: "Semester 2", sgpa: 8.6, subjects: [{ code: "CSE102", name: "Object Oriented Programming", grade: "A+" }, { code: "PHY101", name: "Physics", grade: "A" }] },
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
  const course = SAMPLE_COURSES.find((c) => c.code === code);
  return course ? course.name : code;
}

// Turns one period + class into the text every timetable widget shows.
function describe(period, entry) {
  const time = `${period.start} to ${period.end}`;
  if (period.isBreak) return { time, title: "Lunch break", sub: "Time to recharge", kind: "rest" };
  if (!entry) return { time, title: "Free period", sub: "No class scheduled", kind: "free" };
  return { time, title: entry.code, sub: courseName(entry.code), place: `Block ${entry.block}, Room ${entry.room}`, kind: "class" };
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
    makeTile("courses", "Courses", `${SAMPLE_COURSES.length}`, "Sample data"),
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
  const rows = SAMPLE_COURSES.map((c) => {
    const left = el("div");
    left.append(el("strong", "", c.name), el("p", "code-tag", c.code));
    const row = el("div", "item");
    row.append(left, el("span", "muted", `${c.credits} credits`));
    return row;
  });
  $("courses-body").replaceChildren(...rows);
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
// Today's periods with their status, or null on days without classes.
function todayItems() {
  const classes = SAMPLE_WEEK[todayName()];
  if (!classes) return null;
  return SAMPLE_PERIODS.map((period, i) => ({ period, entry: classes[i], status: statusOf(period), desc: describe(period, classes[i]) }));
}

/* Day tabs: today is selected automatically (Monday on weekends). */
let selectedDay = SAMPLE_WEEK[todayName()] ? todayName() : "Monday";

function renderDayTabs() {
  const tabs = Object.keys(SAMPLE_WEEK).map((day) => {
    const button = el("button", day === todayName() ? "today" : "", day.slice(0, 3));
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(day === selectedDay));
    button.setAttribute("aria-label", day);
    button.addEventListener("click", () => { selectedDay = day; renderDayTabs(); renderDayPanel(); });
    return button;
  });
  $("day-tabs").replaceChildren(...tabs);
}

function renderDayPanel() {
  const isToday = selectedDay === todayName();
  const rows = SAMPLE_PERIODS.map((period, i) => {
    const d = describe(period, SAMPLE_WEEK[selectedDay][i]);
    const status = isToday ? statusOf(period) : "";
    const card = el("div", `daycard ${d.kind} ${status}`);
    card.append(el("strong", "", d.title), el("p", "", d.place ? `${d.sub}, ${d.place}` : d.sub));
    const row = el("div", "dayrow rise");
    row.style.setProperty("--i", i);
    row.append(el("time", "", `${period.start}\n${period.end}`), card);
    row.firstChild.style.whiteSpace = "pre-line";
    return row;
  });
  const note = SAMPLE_WEEK[todayName()] ? [] : [el("p", "msg", "No classes on weekends. Showing Monday.")];
  $("day-panel").replaceChildren(...note, ...rows);
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
    $("ring-readout").replaceChildren(el("strong", "", "No classes today"), el("span", "muted", "Enjoy the day off."));
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

function init() {
  setupLogin();
  setupApp();
  setupRing();
  setupSwipe();
  renderDayTabs();
  renderCourses();
  renderMarks();
  renderResults();
  // One timer: every minute, refresh the wheel and today's list so "current class" stays correct.
  setInterval(() => {
    if (!$("view-timetable").hidden) { renderRing(); renderDayPanel(); }
  }, 60000);
}

init();