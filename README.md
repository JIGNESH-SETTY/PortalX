# PortalX (An alternate portal for srm ap student portal)

PortalX is a modern, responsive alternative student portal for SRM University-AP. It provides a fast, clean interface for students to access academic profiles, weekly schedules, attendance records, internal assessment breakdowns, and in-class attendance marking.

The application operates as a lightweight, secure gateway between the student browser and the university's academic portal (`student.srmap.edu.in`). It fetches official portal reports on demand, converts the returned HTML tables into structured JSON via Cheerio, and delivers the data to a responsive single-page application.

---

## Table of Contents

1. [Architecture and System Design](#architecture-and-system-design)
2. [Technology Stack](#technology-stack)
3. [Repository Structure](#repository-structure)
4. [Prerequisites](#prerequisites)
5. [Installation and Configuration](#installation-and-configuration)
6. [Running the Application](#running-the-application)
7. [API Documentation](#api-documentation)
8. [Automated Testing](#automated-testing)
9. [Security and Privacy Design](#security-and-privacy-design)
10. [Troubleshooting and Frequently Asked Questions](#troubleshooting-and-frequently-asked-questions)

---

## Architecture and System Design

PortalX follows a modular, layered backend architecture built on Node.js and Express 5. Responsibilities are strictly segregated to facilitate maintainability, code readability, and interview review.

```text
Student Browser (SPA)
        │
        ▼ HTTP / JSON (Express Session Cookie)
Express 5 Application Layer
        │
        ├── Middleware (Security Headers, Route Guards, Error Handlers)
        ├── Controllers (Request Validation & Response Dispatch)
        ├── Services (Business Logic & Session Orchestration)
        ├── Parsers (Cheerio DOM Extraction)
        └── SRM Client (Session-Aware Axios Instance)
        │
        ▼ Form-Encoded POST / HTTPS
SRM University-AP Portal (student.srmap.edu.in)
```

### Core Design Principles

1. **No Student Database**: Student records, credentials, attendance percentages, and internal marks are never stored in a local database. PortalX functions as a stateless translation layer; all data originates from the university server.
2. **Per-User Session Isolation**: Each authenticated student session receives an independent `tough-cookie` `CookieJar`. University session cookies (such as `JSESSIONID`) are maintained in memory per user and are never shared across concurrent sessions, eliminating cross-user data leakage.
3. **Data Integrity and Fidelity**: Parsers preserve official data exactly as returned by the university portal. Unknown, unentered, or withheld marks are maintained as `null` rather than converted to numeric zeroes. Attendance percentages are preserved without recalculation.
4. **Resilient Parsing**: Cheerio parsers identify table structures dynamically through column header matching, regex pattern boundaries, and document hierarchy rather than brittle, hardcoded index assumptions.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js (v20+) | JavaScript runtime with ES module support |
| **Server Framework** | Express 5 | Web application framework handling routing and middleware |
| **HTTP Client** | Axios & `axios-cookiejar-support` | Session-aware external HTTP client |
| **Cookie Storage** | `tough-cookie` | RFC 6265 compliant in-memory cookie jar per user |
| **DOM Parser** | Cheerio | Server-side HTML parsing for converting SRM reports to JSON |
| **Session Management** | `express-session` | HTTP-only browser cookie management for PortalX sessions |
| **Security Headers** | Helmet | Sets secure HTTP headers and Content Security Policy |
| **Environment** | `dotenv` | Loads configuration from environment files |
| **Testing** | Node.js Test Runner (`node:test`) | Built-in test runner for unit and integration tests |
| **Development** | Nodemon | Hot-reloading tool for local development |

---

## Repository Structure

```text
PortalX-new/
├── public/
│   └── index.html                       # Frontend Single Page Application
├── src/
│   ├── app.js                           # Express application setup and middleware chain
│   ├── server.js                        # HTTP server initialization and shutdown logic
│   ├── config/
│   │   └── env.js                       # Environment variable validation and defaults
│   ├── controllers/
│   │   ├── auth.controller.js           # Authentication and session status endpoints
│   │   ├── profile.controller.js        # Student profile data endpoint
│   │   ├── timetable.controller.js      # Timetable schedule endpoint
│   │   ├── attendance.controller.js     # Attendance records endpoint
│   │   ├── marks.controller.js          # Internal marks endpoint
│   │   └── markAttendance.controller.js # Attendance verification and code submission
│   ├── middleware/
│   │   ├── errorHandler.js              # Central error handling and JSON normalization
│   │   └── requireAuth.js               # Route guard verifying active user sessions
│   ├── parsers/
│   │   ├── profile.parser.js            # Parser for SRM profile reports (ids=1)
│   │   ├── timetable.parser.js          # Parser for timetable grid and subjects (ids=10)
│   │   ├── attendance.parser.js         # Parser for attendance table (ids=3)
│   │   ├── marks.parser.js              # Parser for marks summary and breakdowns (ids=5)
│   │   └── markAttendance.parser.js     # Parser for student attendance page (ids=33)
│   ├── routes/
│   │   ├── auth.routes.js               # /api/auth routes
│   │   ├── profile.routes.js            # /api/student/profile routes
│   │   ├── timetable.routes.js          # /api/timetable routes
│   │   ├── attendance.routes.js         # /api/attendance routes
│   │   ├── marks.routes.js              # /api/marks routes
│   │   └── markAttendance.routes.js     # /api/mark-attendance routes
│   ├── services/
│   │   ├── auth.service.js              # Authentication service and credential validation
│   │   ├── srmClient.service.js         # Centralized Axios client for SRM portal calls
│   │   ├── srmSession.service.js        # Per-user cookie jar registry and lifecycle
│   │   ├── profile.service.js           # Profile workflow coordinator
│   │   ├── timetable.service.js         # Timetable workflow coordinator
│   │   ├── attendance.service.js        # Attendance workflow coordinator
│   │   ├── marks.service.js             # Internal marks workflow coordinator
│   │   ├── markAttendance.service.js    # Attendance marking workflow coordinator
│   │   └── mockData.js                  # Realistic fallback fixtures for offline development
│   └── utils/
│       ├── asyncHandler.js              # Wrapper for asynchronous route handlers
│       └── errors.js                    # Custom application error classes
├── tests/
│   ├── fixtures/                        # Representative SRM HTML responses for tests
│   │   ├── attendance.html
│   │   ├── markAttendance.html
│   │   ├── marks.html
│   │   ├── profile.html
│   │   └── timetable.html
│   ├── integration/
│   │   └── api.test.js                  # Integration tests for routes, 401 guards, and 404s
│   ├── parsers/                         # Unit tests for all Cheerio parsers
│   │   ├── attendance.parser.test.js
│   │   ├── markAttendance.parser.test.js
│   │   ├── marks.parser.test.js
│   │   ├── profile.parser.test.js
│   │   └── timetable.parser.test.js
│   └── services/                        # Unit tests for services and session isolation
│       ├── markAttendance.service.test.js
│       └── srmSession.service.test.js
├── .env.example                         # Example environment configuration
├── .gitignore                           # Git ignore rules
├── frontend.html                        # Original reference frontend design
└── package.json                         # Project dependencies and execution scripts
```

---

## Prerequisites

Before running PortalX, ensure the following tools are installed on your machine:

- **Node.js**: Version 20.0.0 or higher (Node.js 22+ recommended). Check with:
  ```bash
  node -v
  ```
- **npm**: Version 9.0.0 or higher. Check with:
  ```bash
  npm -v
  ```

---

## Installation and Configuration

### 1. Clone or Open the Project

Navigate to the project root directory:

```bash
cd PortalX-new
```

### 2. Install Dependencies

Install the project dependencies using npm:

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root directory by copying the example template:

```bash
cp .env.example .env
```

Review and adjust the configuration parameters as needed:

```ini
# Port on which the PortalX server listens
PORT=3000

# Node runtime environment (development | production | test)
NODE_ENV=development

# Secret key used to sign Express session cookies
SESSION_SECRET=portalx_local_development_secret_key_12345

# Official SRM University-AP Student Portal base URL
SRM_BASE_URL=https://student.srmap.edu.in/srmapstudentcorner

# Request timeout in milliseconds for university portal requests
SRM_REQUEST_TIMEOUT_MS=15000

# Development Mock Fallback (true | false)
# When set to true, returns realistic offline data for local UI previewing
DEV_MOCK_FALLBACK=false
```

---

## Running the Application

### Development Mode

Run the backend with automatic hot-reloading on code changes:

```bash
npm run dev
```

### Standard / Production Mode

Start the server using Node directly:

```bash
npm start
```

### Accessing the Portal

Once started, open your web browser and navigate to:

```text
http://localhost:3000
```

- When `DEV_MOCK_FALLBACK=false`, the server communicates directly with the live SRM portal at `https://student.srmap.edu.in/srmapstudentcorner`.
- When `DEV_MOCK_FALLBACK=true`, the server serves sample academic records so developers and interviewers can evaluate all dashboard interfaces without active network access to the university portal.

---

## API Documentation

All PortalX backend endpoints return standard JSON envelopes with uniform structures:

**Success Response (HTTP 200)**:
```json
{
  "ok": true,
  "data": {},
  "message": null
}
```

**Error Response (HTTP 4xx / 5xx)**:
```json
{
  "ok": false,
  "data": null,
  "message": "Human-readable explanation of the error",
  "code": "ERROR_CODE"
}
```

### Endpoint Reference

#### 1. System Health Check
- **Route**: `GET /api/health`
- **Authentication**: None
- **Description**: Returns operational status, server timestamp, and target SRM portal URL.

#### 2. Student Authentication
- **Route**: `POST /api/auth/login`
- **Authentication**: None
- **Request Body**:
  ```json
  {
    "username": "AP25110010807",
    "password": "your_password"
  }
  ```
- **Validation**:
  - `username`: Required, case-insensitive, must begin with `AP` followed by 11 or 12 digits (`/^AP\d{11,12}$/i`).
  - `password`: Required, non-empty string.
- **Description**: Initiates authentication against the SRM portal. On success, creates a PortalX session and allocates an isolated cookie jar.

#### 3. Session Status
- **Route**: `GET /api/auth/status`
- **Authentication**: None
- **Description**: Returns whether the current browser session holds an active student identity.

#### 4. Student Logout
- **Route**: `POST /api/auth/logout`
- **Authentication**: Required
- **Description**: Destroys the active PortalX session and purges the associated in-memory cookie jar.

#### 5. Student Profile
- **Route**: `GET /api/student/profile`
- **Authentication**: Required
- **Report Parameter**: `ids=1`
- **Response Structure**:
  ```json
  {
    "ok": true,
    "data": {
      "name": "S JIGNESH",
      "studentId": "AP25110010807",
      "regNo": "AP25110010807",
      "institution": "School of Engineering and Sciences (College)",
      "semester": "III SEMESTER",
      "program": "B.Tech.-Computer Science and Engineering [UG - Full Time]",
      "section": "A",
      "programSection": "B.Tech.-Computer Science and Engineering [UG - Full Time] / A",
      "specialization": "",
      "dob": "13-Dec-2007",
      "gender": "Male",
      "dobGender": "13-Dec-2007 / Male",
      "phone": "9100715947",
      "contactNumber": "9100715947",
      "phoneVerified": true,
      "email": "jignesh_s@srmap.edu.in",
      "contactEmail": "jignesh_s@srmap.edu.in",
      "father": "S GURUNADHAM",
      "mother": "S YASODA",
      "parentNames": "S GURUNADHAM / S YASODA"
    }
  }
  ```

#### 6. Weekly Timetable
- **Route**: `GET /api/timetable`
- **Authentication**: Required
- **Report Parameter**: `ids=10`
- **Description**: Returns the weekly timetable schedule across Monday through Saturday (8 periods per day), along with the subject registry. Unoccupied periods are represented as `0`; occupied slots are formatted as `"CODE:ROOM"`.
- **Response Structure**:
  ```json
  {
    "ok": true,
    "data": {
      "days": {
        "Mon": ["CSE 213:S 404", "SEC 203:S 404", "SEC 203:S 404", "SEC 203:S 404", 0, "CSE 202:C 804", "CSE 202:C 804", "MAT 279:C 504"],
        "Tue": ["CSE 204:S 404", "CSE 204:S 404", "CSE 207:C 706", "CSE 207:C 706", 0, 0, "CSE 202:S 404", "MAT 279:C 504"],
        "Wed": ["CSE 203:S 404", 0, "CSE 213:S 404", "CSE 213:S 404", 0, "CSE 204:S 404", 0, 0],
        "Thu": [0, 0, "CSE 202:S 404", "CSE 202:S 404", 0, "CSE 207:S 404", "CSE 204:C 501", "CSE 204:C 501"],
        "Fri": ["CSE 203:S 404", "CSE 203:S 404", "CSE 207:X 201", "CSE 207:X 201", 0, 0, "CSE 213:C 701", "CSE 213:C 701"],
        "Sat": [0, 0, 0, 0, 0, 0, 0, 0]
      },
      "subjects": [
        {
          "code": "CSE 202",
          "name": "OBJECT ORIENTED PROGRAMMING WITH C++",
          "ltpc": "3-0-1-4",
          "faculty": ["Dr. Lipismita Panigrahi (25065)", "Dr. Pratik Roy (22296)"],
          "rooms": ["C 804", "S 404"]
        }
      ],
      "periods": [
        ["09:00", "09:50"],
        ["10:00", "10:50"],
        ["11:00", "11:50"],
        ["12:00", "12:50"],
        ["13:00", "13:50"],
        ["14:00", "14:50"],
        ["15:00", "15:50"],
        ["16:00", "17:30"]
      ]
    }
  }
  ```

#### 7. Attendance Records
- **Route**: `GET /api/attendance`
- **Authentication**: Required
- **Report Parameter**: `ids=3`
- **Description**: Returns subject-wise attendance statistics, date boundaries, and aggregated summary counts.
- **Row Format**: `[code, conducted, present, absent, odml, presentPercentage, odmlPercentage, attendancePercentage]`
- **Response Structure**:
  ```json
  {
    "ok": true,
    "data": {
      "from": "03/Aug/2026",
      "to": "27/Oct/2026",
      "rows": [
        ["CSE 202", 49, 46, 0, 3, 93.88, 4.00, 97.88],
        ["CSE 203", 28, 26, 2, 0, 92.86, 0.00, 92.86]
      ],
      "summary": {
        "totalConducted": 77,
        "totalPresent": 72,
        "totalAbsent": 2,
        "totalOdml": 3,
        "averagePercentage": 95.37
      }
    }
  }
  ```

#### 8. Internal Assessment Marks
- **Route**: `GET /api/marks`
- **Authentication**: Required
- **Report Parameter**: `ids=5`
- **Description**: Returns total marks obtained per subject and granular assessment breakdowns (such as CLA 1, CLA 2, and Midterm exams). Unentered marks remain `null`.
- **Response Structure**:
  ```json
  {
    "ok": true,
    "data": {
      "rows": [
        ["CSE 202", 18.80, 50],
        ["CSE 203", 28.00, 50]
      ],
      "subjects": [
        {
          "code": "CSE 202",
          "description": "OBJECT ORIENTED PROGRAMMING WITH C++",
          "obtained": 18.80,
          "max": 50,
          "isPublished": true,
          "components": [
            { "name": "CLA 1", "conducted": 18.00, "max": 20, "converted": 9.00 },
            { "name": "Mid Semester Exam I", "conducted": 39.20, "max": 50, "converted": 9.80 }
          ]
        }
      ]
    }
  }
  ```

#### 9. Current Day Attendance Info
- **Route**: `GET /api/mark-attendance`
- **Authentication**: Required
- **Description**: Fetches current day order, dynamic verification coordinates, and today's logged attendance records from `studentattendance.jsp`.

#### 10. Submit In-Class Attendance Code
- **Route**: `POST /api/mark-attendance/submit`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "code": "A123456"
  }
  ```
- **Validation**:
  - `code`: Must match the 7-character format consisting of one letter followed by six digits (`/^[A-Za-z]\d{6}$/`).
- **Description**: Transmits the code and dynamic verification parameters to `studentattendanceresources.jsp` and returns the official university server outcome.

---

## Automated Testing

PortalX includes a comprehensive automated test suite powered by the Node.js built-in test runner (`node:test`). Tests run in an isolated environment without requiring live university credentials or active network connectivity.

### Running Tests

Execute all test suites from the root directory:

```bash
npm test
```

### Test Coverage Summary

- **Profile Parser (`tests/parsers/profile.parser.test.js`)**: Validates field extraction from realistic HTML, checks null and empty inputs, and ensures missing fields are not populated with invented data.
- **Timetable Parser (`tests/parsers/timetable.parser.test.js`)**: Verifies weekly schedule matrix parsing, checks that free periods (`-`, `NIL`, `FREE`, and empty cells) resolve strictly to `0`, and validates subject/room mapping.
- **Attendance Parser (`tests/parsers/attendance.parser.test.js`)**: Verifies date range extraction (`from` and `to`), confirms numeric slot counts, and checks that OD/ML headers do not collide with code or conducted columns.
- **Marks Parser (`tests/parsers/marks.parser.test.js`)**: Tests summary marks extraction, component breakdown mapping, and verifies that unentered assessments remain `null` instead of zero.
- **Mark Attendance Parser (`tests/parsers/markAttendance.parser.test.js`)**: Verifies day order extraction, dynamic coordinate token reading, and today's record table parsing.
- **Session Isolation Service (`tests/services/srmSession.service.test.js`)**: Proves that concurrent users receive isolated `CookieJar` instances with zero cross-talk between credentials or session cookies.
- **Mark Attendance Service (`tests/services/markAttendance.service.test.js`)**: Verifies 7-character code format enforcement and validates server response interpretation.
- **Integration Tests (`tests/integration/api.test.js`)**: Validates Express server instantiation, health check responses, route guard enforcement (HTTP 401 on unauthenticated calls), login validation (HTTP 400), and 404 handling.

---

## Security and Privacy Design

1. **Zero Database Persistence**: PortalX does not retain passwords, session tokens, profile records, or attendance logs in any persistent database. Data resides only in transient application memory during active requests.
2. **Strict Session Isolation**: University session cookies (`JSESSIONID`) are maintained exclusively in server-side memory inside per-session `tough-cookie` jars. They are never sent to the student's browser.
3. **Session Cookie Security**: Express session cookies (`portalx_sid`) are configured with:
   - `httpOnly: true`: Prevents client-side scripts from reading the session identifier.
   - `sameSite: 'lax'`: Mitigates Cross-Site Request Forgery (CSRF).
   - `secure: true` (in production): Enforces transmission solely over HTTPS.
4. **Masked Logging**: The central error handling middleware and logger suppress passwords, session keys, attendance submission codes, and raw personal HTML pages from console and log output.
5. **Content Security Policy**: Configured using Helmet to restrict script execution, frame embedding, and resource loading while explicitly whitelisting verified typography fonts from Google Fonts.

---

## Troubleshooting and Frequently Asked Questions

### Why does login fail when connecting to the live portal?
SRM University-AP's student portal periodically mandates CAPTCHA verification (`/srmapstudentcorner/captchas`) for direct form submissions. In accordance with university policy, PortalX does not bypass or fabricate CAPTCHA verification. If testing off-campus or without live credentials, enable `DEV_MOCK_FALLBACK=true` in your `.env` file to explore and evaluate all application workflows with realistic mock data.

### How are empty timetable periods represented?
Periods with no scheduled classes are represented as numeric `0` in the timetable matrix. The frontend checks for truthy values (`if (!c)`) and displays them as free slots. PortalX never fabricates courses for unoccupied periods.

### Why do some internal marks display as `--` or blank?
When faculty members have not yet entered or published assessment scores, SRM returns empty table cells or dashes. The marks parser explicitly preserves these as `null` with `isPublished: false`. This avoids falsely reporting a zero score to the student.

### How is overall attendance calculated?
The dashboard displays the true weighted average attendance across all registered courses:
$$\text{Average Attendance} = \frac{\sum \text{Present Slots}}{\sum \text{Conducted Classes}} \times 100$$
Subject-specific percentages are extracted verbatim from the university portal.

