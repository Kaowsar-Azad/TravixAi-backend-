const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function test() {
  const form = new FormData();
  form.append('message', 'What is in this file?');
  form.append('history', '[]');
  
  fs.writeFileSync('dummy.txt', 'dummy content');
  form.append('file', fs.createReadStream('dummy.txt'));
  
  try {
    const res = await axios.post('http://localhost:5000/api/ai/chat', form, {
      headers: form.getHeaders()
    });
    console.log(res.data);
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
