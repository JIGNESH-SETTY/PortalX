import parseTimetable from "./parseTimetable.js";

const html = `
<table>
    <tr>
        <td>Data Structures</td>
        <td>9:00 AM</td>
    </tr>
    <tr>
        <td>Mathematics</td>
        <td>10:00 AM</td>
    </tr>
</table>
`;

const result = parseTimetable(html);

console.log(result);