const { createFinalPoster } = require('./image');
const path = require('path');

async function testCreateFinalPoster() {
  console.log('Testing createFinalPoster...');

  const templatePath = path.join(__dirname, '../output/test_direct.jpeg');
  const outputPath = path.join(__dirname, '../output/test_final.jpeg');
  const logoPath = path.join(__dirname, '../assets/logo.png');

  const person = {
    name: 'Test User',
    designation: 'Test Designation',
    phone: '1234567890',
    photo: path.join(__dirname, '../assets/logo.png'), // use logo as photo for test
    teamName: ''
  };

  try {
    await createFinalPoster({
      templatePath,
      person,
      logoPath,
      outputPath
    });
    console.log('✅ createFinalPoster test successful, output saved to:', outputPath);
  } catch (error) {
    console.error('❌ createFinalPoster test failed:', error.message);
  }
}

testCreateFinalPoster();