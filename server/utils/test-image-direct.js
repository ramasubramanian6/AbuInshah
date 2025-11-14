const { createFinalPoster } = require('./image');
const path = require('path');

async function testImageDirect() {
  console.log('=== Testing createFinalPoster directly ===');

  const templatePath = path.join(__dirname, '../assets/ABCD.jpg');
  const logoPath = path.join(__dirname, '../assets/logo.png');
  const outputPath = path.join(__dirname, '../output/test_direct.jpeg');

  const dummyPerson = {
    name: 'Test User',
    designation: 'Wealth Manager',
    phone: '1234567890',
    photo: path.join(__dirname, '../assets/logo.png'), // use logo as dummy photo
    email: 'test@example.com'
  };

  try {
    await createFinalPoster({
      templatePath,
      person: dummyPerson,
      logoPath,
      outputPath
    });
    console.log('✅ Poster created successfully at:', outputPath);
  } catch (error) {
    console.error('❌ Error creating poster:', error.message);
  }
}

testImageDirect();