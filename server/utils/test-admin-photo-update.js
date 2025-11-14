const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testAdminPhotoUpdate() {
  console.log('=== Testing Admin Photo Update ===');

  const testPhotoPath = path.join(__dirname, '../uploads/test_photo.jpg');
  if (!fs.existsSync(testPhotoPath)) {
    console.log('❌ Test photo not found:', testPhotoPath);
    return;
  }

  // Use an existing user ID from the database
  const userId = '1756277906973'; // Malathi

  // First, login as admin
  console.log('1. Logging in as admin...');
  try {
    const loginResponse = await axios.post('http://localhost:3001/api/admin-login', {
      username: 'admin',
      password: 'password123'
    }, {
      withCredentials: true
    });

    console.log('✅ Admin login successful');

    // Get the cookie from response
    const cookie = loginResponse.headers['set-cookie'];
    if (!cookie) {
      console.log('❌ No cookie received from login');
      return;
    }

    const cookieHeader = cookie.join('; ');

    // Check if temp file exists before test
    console.log('Files in uploads before test:', fs.readdirSync(path.join(__dirname, '../uploads')).length);

    const form = new FormData();
    form.append('photo', fs.createReadStream(testPhotoPath));

    console.log('2. Attempting admin photo update...');
    const response = await axios.put(`http://localhost:3001/api/users/${userId}/photo`, form, {
      headers: {
        ...form.getHeaders(),
        'Cookie': cookieHeader
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      withCredentials: true
    });

    console.log('✅ Admin photo update response:', response.status, response.data);

    // Check if temp files are cleaned up
    console.log('Files in uploads after test:', fs.readdirSync(path.join(__dirname, '../uploads')).length);

    // Verify the user was updated in DB
    console.log('3. Verifying user update...');
    const usersResponse = await axios.get('http://localhost:3001/api/users');
    const users = usersResponse.data;
    const updatedUser = users.find(u => u.id === userId);
    if (updatedUser) {
      console.log('✅ User found in database:', updatedUser.name, updatedUser.photoUrl);
      if (updatedUser.photoUrl && updatedUser.photoUrl.startsWith('https://storage.googleapis.com')) {
        console.log('✅ GCS URL stored correctly');
      } else {
        console.log('❌ Local URL stored instead of GCS URL:', updatedUser.photoUrl);
      }
    } else {
      console.log('❌ User not found in database');
    }

  } catch (error) {
    console.log('❌ Admin photo update failed:', error.response ? error.response.status : error.message);
    if (error.response && error.response.data) {
      console.log('Error details:', error.response.data);
    }

    // Check cleanup on failure
    console.log('Files in uploads after failure:', fs.readdirSync(path.join(__dirname, '../uploads')).length);
  }

  console.log('=== Admin Photo Update Test Complete ===');
}

testAdminPhotoUpdate();