const pdfParse = require('pdf-parse');
const fs = require('fs');
async function test() {
  const buffer = fs.readFileSync('package.json'); // Just some file
  try {
    const data = await pdfParse(buffer);
    console.log("Success:", data.text);
  } catch(e) {
    console.error("Parse error:", e.message);
  }
}
test();
