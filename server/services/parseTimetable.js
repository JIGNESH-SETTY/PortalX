import * as cheerio from "cheerio"

function parseTimetable(html){

    const $ = cheerio.load(html);
    const timetable = [];
    

    $("tr").each(function () {
        const cells = $(this).find("td");

        if (cells.length < 5) {
            return;
        }
        
        const day = cells.eq(0).text().trim();
        const subjectCode = cells.eq(1).text().trim();
        const subject  = cells.eq(2).text().trim();
        const time = cells.eq(3).text().trim();
        const timeParts = time.split("-");

        //if the time contains only one element then the code below this i.e if case will handle the error
        if(timeParts.length < 2){
            return;
        }
        
        const startTime = timeParts[0].trim();
        const endTime = timeParts[1].trim();
        const room = cells.eq(4).text().trim();

        if(!day || !subject || !time ){
            return;
        }

        const timetableEntry = {
            day: day,
            subjectCode: subjectCode,
            subject: subject,
            startTime: startTime,
            endTime: endTime,
            room: room
        };

        timetable.push(timetableEntry);
        
    });
    return timetable;
}

export default parseTimetable;