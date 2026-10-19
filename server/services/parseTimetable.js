
import * as cheerio from "cheerio";

function parseTimetable(html) {
    const $ = cheerio.load(html);

    // 1. Extract period timings from the timetable header.
    const periods = [];

    //tr.subheader class is added to the period headers and the day name header so for accessing only period time headers i used
    //.first() to access the first relevant match to the subheader so that it matches with the tr.subheader 
    $("#tblClassTimetable tr.subheader").first().find("td").each(function (index) {

        // The first cell is empty; the remaining cells contain period times.
        if (index === 0) {
            //Inside a jQuery/Cheerio .each() callback, 
            //return stops processing the current item and continues to the next one.
            //It does not exit the entire parseTimetable() function.
            return;
        }

        const time = $(this).text().trim();

        //The expression /\s+To\s+/i is a regular expression:
        // - \s+ means one or more whitespace characters.
        // - To matches those letters.
        // - i makes the match case-insensitive.

        const timeParts = time.split(/\s+To\s+/i);
        
        //because everytimeslot has two times so timeparts.length not equal to 2 are ingnored
        if (timeParts.length !== 2) {
            return;
        }

        periods.push({
            label: String(index),
            start: timeParts[0].trim(),
            end: timeParts[1].trim()
        });
    });

    // 2. Extract the timetable grid, including empty periods.
    const days = [];

    $("#tblClassTimetable tr").each(function () {
        const cells = $(this).find("td");

        // Ignore headers and rows without a day name.
        // !cells.eq(0).hasClass("subheader") means ingnoring the header days
        if (cells.length < 2 || !cells.eq(0).hasClass("subheader")) {
            return;
        }

        const dayName = cells.eq(0).text().trim();
        const slots = [];

        cells.slice(1).each(function () {
            const cell = $(this);
            const codeAndRoom = cell.text().trim();
            const subjectName = (cell.attr("title") || "").trim();

            // Preserve empty cells so each class stays in its correct period.
            if (!codeAndRoom) {
                slots.push(null);
                return;
            }

            // Example: CSE 213(S 404)
            const match = codeAndRoom.match(/^(.+?)\s*\((.*?)\)$/);

            if (!match) {
                slots.push(null);
                return;
            }

            slots.push({
                code: match[1].trim(),
                subjectName,
                location: match[2].trim()
            });
        });

        days.push({
            name: dayName,
            slots
        });
    });

    // 3. Extract the subject details from the second table.
    const subjects = [];

    $("#tblSubjectList tr").each(function () {
        const cells = $(this).find("td");

        // Subject rows have five cells; the header row is skipped.
        if (cells.length < 5) {
            return;
        }

        const code = cells.eq(0).text().trim();
        const name = cells.eq(1).text().trim();
        const ltpc = cells.eq(2).text().trim();
        const facultyText = cells.eq(3).text().trim();
        const roomsText = cells.eq(4).text().trim();

        if (!code || !name) {
            return;
        }

        // Split multiple faculty names and IDs where possible.
        const faculty = facultyText
            .split(/,\s*(?=(?:Dr\.|Mr\.|Ms\.|Mrs\.)\s)/)
            .map(name => {
                const match = name.match(/^(.*?)\s*\(\s*(.*?)\s*\)$/);

                return {
                    name: (match ? match[1] : name).trim(),
                    id: match ? match[2].trim() : ""
                };
            });

        const rooms = roomsText
            .split(",")
            .map(room => room.replace(/[()]/g, "").trim())
            .filter(Boolean);

        subjects.push({
            code,
            name,
            ltpc,
            faculty,
            rooms
        });
    });

    // 4. Return the structure expected by the PortalX frontend.
    return {
        isSample: false,
        periods,
        days,
        subjects
    };
}

export default parseTimetable;
