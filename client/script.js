const studentBtn = document.getElementById("studentBtn");
const studentData = document.getElementById("studentData");

async function getStudentData() {
    const response = await fetch("/api/student");

    const data = await response.json();

    studentData.textContent = data.message;
}

studentBtn.addEventListener("click", getStudentData);