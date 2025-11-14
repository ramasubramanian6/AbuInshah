const { Storage } = require('@google-cloud/storage');
const path = require('path');

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET || 'abuinshah-photos';
const bucket = storage.bucket(BUCKET_NAME);

async function uploadToGCS(localFilePath, destFileName) {
  await bucket.upload(localFilePath, {
    destination: destFileName,
    public: true,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });
  return `https://storage.googleapis.com/${BUCKET_NAME}/${destFileName}`;
}

// Download image from GCS to local temp file
async function downloadFromGCS(gcsFileName, localDestPath) {
  const file = bucket.file(gcsFileName);
  await file.download({ destination: localDestPath });
  return localDestPath;
}

module.exports = { uploadToGCS, downloadFromGCS };
