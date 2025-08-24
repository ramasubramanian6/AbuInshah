const cloudinary = require('cloudinary').v2;
require('dotenv').config();

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

async function uploadLocalImage(filePath, options = {}) {
  if (!cloudinary.config().api_key) {
    throw new Error('Cloudinary not configured');
  }
  const res = await cloudinary.uploader.upload(filePath, options);
  return res; // contains secure_url, public_id, etc.
}

module.exports = {
  uploadLocalImage,
  cloudinary
};
