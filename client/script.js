
const studentBtn = document.getElementById("studentBtn");
const studentData = document.getElementById("studentData");

const attendanceBtn = document.getElementById("attendanceBtn");
const attendanceData = document.getElementById("attendanceData");

async function getStudentData() {
    try{
    const response = await fetch("/api/student");

    if(!response.ok){
        throw new Error("failed to fetch the student data");
    }

    const data = await response.json();

    studentData.textContent = `Student ID: ${data.studentId}
    Name: ${data.name}
    Department: ${data.department}
    Year: ${data.year}`;
   
    } catch (error) {
        studentData.textContent = "Unable to load student data. Please try again.";
        console.error("Student API error:", error);
    }
}

studentBtn.addEventListener("click", getStudentData);


async function getAttendance() {
    try{

    const response = await fetch("/api/attendance");
        //response.ok is used to detect the server crashed the response.ok return true if executed correctly
        //response.ok return false if not executed correctly 
        if (!response.ok) {
            throw new Error("Failed to fetch student data");
        }

    const data = await response.json();

    let result = `Overall Attendance: ${data.overall}%\n\nSubjects:\n`;

    for (let subject of data.subjects) {
        result += `${subject.name}: ${subject.attendance}%\n`;
    }

    attendanceData.textContent = result;
}catch(error){
    attendanceData.textContent = "Attendance api error....";
    console.log("Attendance api not working: ",error);
}
}

attendanceBtn.addEventListener("click", getAttendance);
