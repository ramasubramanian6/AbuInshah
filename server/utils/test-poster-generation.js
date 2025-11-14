const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testPosterGeneration() {
  console.log('=== Testing Poster Generation ===');

  const templatePath = path.join(__dirname, '../assets/ABCD.jpg');
  if (!fs.existsSync(templatePath)) {
    console.log('❌ Template image not found:', templatePath);
    return;
  }

  // Check files before test
  console.log('Files in uploads before test:', fs.readdirSync(path.join(__dirname, '../uploads')).length);
  console.log('Files in output before test:', fs.readdirSync(path.join(__dirname, '../output')).length);

  const form = new FormData();
  form.append('designation', 'Partner'); // Test with Partner designation
  form.append('template', fs.createReadStream(templatePath));

  try {
    console.log('1. Attempting poster generation...');
    const response = await axios.post('http://localhost:3001/api/send-posters', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log('✅ Poster generation response:', response.status, response.data);

    // Check files after test
    console.log('Files in uploads after test:', fs.readdirSync(path.join(__dirname, '../uploads')).length);
    console.log('Files in output after test:', fs.readdirSync(path.join(__dirname, '../output')).length);

  } catch (error) {
    console.log('❌ Poster generation failed:', error.response ? error.response.status : error.message);
    if (error.response && error.response.data) {
      console.log('Error details:', error.response.data);
    }

    // Check cleanup on failure
    console.log('Files in uploads after failure:', fs.readdirSync(path.join(__dirname, '../uploads')).length);
    console.log('Files in output after failure:', fs.readdirSync(path.join(__dirname, '../output')).length);
  }

  console.log('=== Poster Generation Test Complete ===');
}

testPosterGeneration();