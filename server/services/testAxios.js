import axios from "axios"

async function getData() {
    const response = await axios.get(
        "https://jsonplaceholder.typicode.com/todos/1");
    
    console.log(response.data);
    console.log(response.data.title);
    console.log(response.status);
}

getData();