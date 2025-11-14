const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testMemberRegistration() {
  console.log('=== Testing Member Registration with Photo Upload ===');

  const testPhotoPath = path.join(__dirname, '../uploads/test_photo.jpg');
  if (!fs.existsSync(testPhotoPath)) {
    console.log('❌ Test photo not found:', testPhotoPath);
    return;
  }

  // Check if temp file exists before test
  console.log('Files in uploads before test:', fs.readdirSync(path.join(__dirname, '../uploads')).length);

  const form = new FormData();
  form.append('name', 'Test User GCS');
  form.append('phone', '1234567890');
  form.append('email', `test_gcs_${Date.now()}@example.com`);
  form.append('designation', 'Partner');
  form.append('photo', fs.createReadStream(testPhotoPath));

  try {
    console.log('1. Attempting member registration...');
    const response = await axios.post('http://localhost:3001/api/register', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log('✅ Registration response:', response.status, response.data);

    // Check if temp files are cleaned up
    console.log('Files in uploads after test:', fs.readdirSync(path.join(__dirname, '../uploads')).length);

    // Verify the user was created in DB
    console.log('2. Verifying user creation...');
    const usersResponse = await axios.get('http://localhost:3001/api/users');
    const users = usersResponse.data;
    const newUser = users.find(u => u.email === form.get('email'));
    if (newUser) {
      console.log('✅ User found in database:', newUser.name, newUser.photoUrl);
      if (newUser.photoUrl && newUser.photoUrl.startsWith('https://storage.googleapis.com')) {
        console.log('✅ GCS URL stored correctly');
      } else {
        console.log('❌ Local URL stored instead of GCS URL:', newUser.photoUrl);
      }
    } else {
      console.log('❌ User not found in database');
    }

  } catch (error) {
    console.log('❌ Registration failed:', error.response ? error.response.status : error.message);
    if (error.response && error.response.data) {
      console.log('Error details:', error.response.data);
    }

    // Check cleanup on failure
    console.log('Files in uploads after failure:', fs.readdirSync(path.join(__dirname, '../uploads')).length);
  }

  console.log('=== Member Registration Test Complete ===');
}

testMemberRegistration();