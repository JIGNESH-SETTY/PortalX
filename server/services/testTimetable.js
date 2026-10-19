
import fs from "node:fs";
import parseTimetable from "./parseTimetable.js";

// Read the saved timetable HTML.
const html = fs.readFileSync("../timetable.html", "utf8");

// Pass the HTML into our parser.
const result = parseTimetable(html);

// Display the structured result.
console.log(JSON.stringify(result, null, 2));
