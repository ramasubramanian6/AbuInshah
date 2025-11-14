const { generateFooterSVG } = require('./image');
const sharp = require('sharp');
const fs = require('fs');

async function testFont() {
  console.log('Testing Noto Sans font in image generation...');

  // Check if font file exists
  const fontPath = require('path').join(__dirname, '../assets/fonts/NotoSans-Regular.ttf');
  console.log('Expected font path:', fontPath);
  console.log('Font file exists:', fs.existsSync(fontPath));

  // Generate SVG
  const svg = generateFooterSVG('Test Name', 'Test Designation', '1234567890', 300, 100, 18);
  console.log('Generated SVG length:', svg.length);

  try {
    // Convert SVG to PNG
    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
    console.log('Image generated successfully, buffer size:', buffer.length);

    // Save to file for inspection
    fs.writeFileSync('server/output/test_font.png', buffer);
    console.log('Test image saved to server/output/test_font.png');

  } catch (error) {
    console.error('Error generating image:', error.message);
  }
}

testFont();