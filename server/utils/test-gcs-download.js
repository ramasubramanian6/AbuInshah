const { downloadFromGCS } = require('./gcs');
const path = require('path');

async function testDownload() {
  const gcsFileName = 'photos/test-image.jpeg'; // Change to an existing image in your bucket
  const localDestPath = path.join(__dirname, 'test-image-downloaded.jpeg');
  try {
    await downloadFromGCS(gcsFileName, localDestPath);
    console.log('Download successful:', localDestPath);
  } catch (err) {
    console.error('Download failed:', err);
  }
}

testDownload();
