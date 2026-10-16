import axios from "axios"
import parseTimetable from "./parseTimetable.js";

async function fetchTimetable(){
    const response = await axios.get("http://localhost:3000/mock-timetable.html");
    const html = response.data;
    const timetable = parseTimetable(html);
    console.log(timetable);
}

fetchTimetable();


// import axios from "axios";
// import parseTimetable from "./parseTimetable.js";

// async function fetchTimetable() {
//     const response = await axios.get(
//         "http://localhost:3000/mock-timetable.html"
//     );

//     const html = response.data;

//     const timetable = parseTimetable(html);

//     console.log(timetable);
// }

// fetchTimetable();
