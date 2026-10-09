import express from 'express'
const app  = express();
const port =  3000;

app.use(express.static('client'));

app.get('/api/student',(req,res) =>{
    res.send({
  "message": "Student API working.........."
});
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