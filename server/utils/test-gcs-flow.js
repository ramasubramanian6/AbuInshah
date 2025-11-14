const { uploadToGCS, downloadFromGCS } = require('./gcs');
const path = require('path');
const fs = require('fs');

async function testGCSFlow() {
  console.log('=== Testing GCS Flow ===');

  // Test 1: Try to upload a test file
  const testImagePath = path.join(__dirname, '../assets/logo.png');
  if (!fs.existsSync(testImagePath)) {
    console.log('❌ Test image not found:', testImagePath);
    return;
  }

  console.log('1. Testing GCS Upload...');
  try {
    const gcsFileName = `test/${Date.now()}_logo.png`;
    const uploadUrl = await uploadToGCS(testImagePath, gcsFileName);
    console.log('✅ Upload successful:', uploadUrl);

    // Test 2: Try to download the uploaded file
    console.log('2. Testing GCS Download...');
    const downloadPath = path.join(__dirname, '../uploads/test_download.png');
    await downloadFromGCS(gcsFileName, downloadPath);
    console.log('✅ Download successful:', downloadPath);

    // Clean up
    if (fs.existsSync(downloadPath)) {
      fs.unlinkSync(downloadPath);
      console.log('✅ Test file cleaned up');
    }

  } catch (error) {
    console.log('❌ GCS operation failed:', error.message);
    console.log('This is expected if GCS credentials are not configured');
  }

  console.log('=== GCS Flow Test Complete ===');
}

testGCSFlow();