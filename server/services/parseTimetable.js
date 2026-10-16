import * as cheerio from "cheerio"

function parseTimetable(html){

    const $ = cheerio.load(html);
    const timetable = [];
    

    $("tr").each(function () {
        const cells = $(this).find("td");

        if (cells.length < 2) {
            return;
        }
        
        const subject  = cells.eq(0).text().trim();
        const time = cells.eq(1).text().trim();

        if(!subject || !time ){
            return
        }

        const timetableEntry = {
            subject: subject,
            time: time
        };

        timetable.push(timetableEntry);
        
    });
    return timetable;
}

export default parseTimetable;