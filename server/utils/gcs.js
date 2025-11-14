const { Storage } = require('@google-cloud/storage');
const path = require('path');

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET || 'abuinshah-photos';
const bucket = storage.bucket(BUCKET_NAME);

// Retry utility
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`GCS operation attempt ${attempt}/${maxRetries}`);
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`GCS operation failed on attempt ${attempt}:`, error.message);
      if (attempt < maxRetries) {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }
  throw lastError;
}

async function uploadToGCS(localFilePath, destFileName) {
  console.log(`Uploading ${localFilePath} to GCS as ${destFileName}`);
  await retryOperation(async () => {
    await bucket.upload(localFilePath, {
      destination: destFileName,
      public: true,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });
  });
  const url = `https://storage.googleapis.com/${BUCKET_NAME}/${destFileName}`;
  console.log(`Upload successful: ${url}`);
  return url;
}

// Download image from GCS to local temp file
async function downloadFromGCS(gcsFileName, localDestPath) {
  console.log(`Downloading ${gcsFileName} from GCS to ${localDestPath}`);
  await retryOperation(async () => {
    const file = bucket.file(gcsFileName);
    await file.download({ destination: localDestPath });
  });
  console.log(`Download successful: ${localDestPath}`);
  return localDestPath;
}

module.exports = { uploadToGCS, downloadFromGCS };
