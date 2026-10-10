import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

//fileURLToPath(import.meta.url) identifies the current file's path.
//path.dirname(__filename) identifies the server directory.
//path.join(__dirname, '../client') builds the correct path to your client folder.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app  = express();
const port =  3000;

app.use(express.static(path.join(__dirname, '../client')));

app.get('/api/student',(req,res) =>{
   res.json({
    Studentid : "Mock123",
    name : "Mock123",
    department : "Computers",
    year : 2
   })
});

app.get('/api/attendance',(req,res) => {
    res.json({
        "overall" : 87.6,
        "subjects": [{
         "name": "science",
         "atendance": 82,
        },{
            "name": "data structures",
            "attendance": 64,
        }]
});
});

app.listen(port, () => {
    console.log(`server is running on ${port} ...`);
});