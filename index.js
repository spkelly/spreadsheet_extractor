const fs = require("fs");

function readFile(){
  const data = fs.readFileSync("./test.xls", null);
  const dataBuffer = Buffer.from(data);
  let header = dataBuffer.slice(0,512);
  console.log(header);

  
}



readFile();