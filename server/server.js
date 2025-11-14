// server.js
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const allowedOrigins = [
  'https://abuinshah.netlify.app',
  'http://localhost:5173',
  'https://abuinshah-1.onrender.com',
  'https://wealthpluspostermanagementbackend-786760620153.asia-south1.run.app',
  'https://wealthplusmanagement-ca4fe.web.app'
];

const path = require('path');
const crypto = require('crypto');

const { getMembersByDesignation } = require('./utils/excel');
const { processCircularImage, generateFooterSVG, createFinalPoster } = require('./utils/image');
const { sendEmail, testEmailConfiguration } = require('./utils/emailSender');
const db = require('./db');
const { uploadToGCS, downloadFromGCS } = require('./utils/gcs');
const axios = require('axios');

const app = express();
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'output');
const LOGO_PATH = path.join(__dirname, 'assets/logo.png');

// Create necessary directories if they don't exist
[UPLOADS_DIR, OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only image files are allowed.`), false);
    }
  }
});

// Move CORS configuration before routes
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS policy violation'), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Explicitly handle OPTIONS requests for all routes (CORS preflight)
app.options('*', cors());
app.use(express.json());
app.use(cookieParser(process.env.ADMIN_TOKEN_SECRET || 'supersecret'));

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, '../client/dist')));
app.use(express.static(path.join(__dirname, 'uploads')));

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await db.allUsers();
    // normalize: older records may have `photo` while client expects `photoUrl`
    const normalized = users.map(u => ({
      ...u,
      photoUrl: u.photoUrl || u.photo || ''
    }));
    res.json(normalized);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/teams', async (req, res) => {
  try {
    const teams = await db.User.distinct('teamName', { teamName: { $exists: true, $ne: '' } });
    res.json(teams);
  } catch (error) {
    console.error('Fetch teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await db.getUser(req.params.id);
    if (user && user.photo) {
      try { fs.unlinkSync(user.photo); } catch (e) { /* ignore */ }
    }
    await db.deleteUser(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.post('/api/register', upload.single('photo'), async (req, res) => {
  try {
    const { name, phone, email, designation, teamName } = req.body;
    if (!name || !phone || !email || !designation) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Photo is required' });
    }

    // Prevent duplicate email registrations
    const existingByEmail = await db.User.findOne({ email });
    if (existingByEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const filenameSafe = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const finalPhotoPath = path.join(UPLOADS_DIR, `${filenameSafe}_${Date.now()}.jpeg`);
    
    try {
      if (!fs.existsSync(req.file.path)) throw new Error('Uploaded file not found');
      await processCircularImage(req.file.path, finalPhotoPath, 200);
      if (!fs.existsSync(finalPhotoPath)) throw new Error('Failed to save processed image');
      try { await fs.promises.unlink(req.file.path); } catch (e) { console.warn('Cleanup error (ignored):', e.message || e); }
    } catch (err) {
      console.error('Image processing failed, falling back:', err);
      try {
        if (fs.existsSync(req.file.path)) fs.renameSync(req.file.path, finalPhotoPath);
        else throw new Error('No valid image file available');
      } catch (e) {
        throw new Error(`Failed to save image: ${e.message}`);
      }
    }

  // Upload processed image to GCS and get public URL
  const { uploadToGCS } = require('./utils/gcs');
  const gcsFileName = `photos/${Date.now()}_${filenameSafe}.jpeg`;
  let photoUrl;
  try {
    photoUrl = await uploadToGCS(finalPhotoPath, gcsFileName);
    // Clean up local temp file after successful upload
    try { await fs.promises.unlink(finalPhotoPath); } catch (e) { console.warn('Temp file cleanup failed (ignored):', e.message || e); }
  } catch (err) {
    console.error('GCS upload failed:', err);
    // Clean up temp file on failure
    try { await fs.promises.unlink(finalPhotoPath); } catch (e) { /* ignore */ }
    return res.status(500).json({ error: 'Failed to upload photo to cloud storage' });
  }

    try {
      // To avoid duplicate emails, if user selected 'both' we store both designations
      // in one record as a comma-separated designation value.
      const id = Date.now().toString();
      const actualDesignation = designation && designation.toLowerCase() === 'both' ? 'Health insurance advisor,Wealth Manager' : designation;
      const userData = { id, name, phone, email, designation: actualDesignation, photoUrl };
      if (teamName) userData.teamName = teamName;

      await db.createUser(userData);
      res.json({ success: true, message: '✅ Member registered successfully', user: userData });
    } catch (err) {
      if (err.message && err.message.includes('duplicate key')) {
        return res.status(400).json({ error: 'Duplicate entry' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register member', details: error.message });
  }
});

app.post('/api/send-posters', upload.single('template'), async (req, res) => {
  try {
    const { designation, teamName } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Template image is required' });
    const templatePath = req.file.path;

    let recipients = [];
      if (designation.toLowerCase() === 'team') {
        recipients = await db.User.find({
          teamName: { $exists: true, $ne: '' },
          email: { $exists: true, $ne: '' },
          photoUrl: { $exists: true, $ne: '' }
        });
    } else {
      let designationsToSend = [];
      if (designation.toLowerCase() === 'both') {
        designationsToSend = ['Health Insurance Advisor', 'Wealth Manager'];
      } else if (designation.toLowerCase().includes('health')) {
        designationsToSend = ['Health Insurance Advisor'];
      } else if (designation.toLowerCase().includes('wealth')) {
        designationsToSend = ['Wealth Manager'];
      } else if (designation.toLowerCase().includes('partner')) {
        designationsToSend = ['Partner'];
      } else {
        designationsToSend = [designation];
      }
      
      for (const desig of designationsToSend) {
        const found = await db.findMembersByDesignation(desig);
        recipients = recipients.concat(found);
      }
    }

    if (recipients.length === 0) {
      try { fs.unlinkSync(templatePath); } catch (e) { /* ignore cleanup error */ }
      return res.status(404).json({ error: `No recipients found for designation: ${designation}` });
    }

    let successfulRecipients = 0;
    for (const person of recipients) {
      const finalImagePath = path.join(OUTPUT_DIR, `final_${Date.now()}_${person.name.replace(/\s+/g, '_')}.jpeg`);
      let isTempFile = false;
      let photoPath = '';

      try {
        const photoSource = person.photoUrl || person.photo || '';

        if (photoSource.startsWith('https://storage.googleapis.com')) {
          // GCS URL, download to temp file
          const bucketName = process.env.GCS_BUCKET || 'abuinshah-photos';
          const urlParts = photoSource.split(`https://storage.googleapis.com/${bucketName}/`);
          if (urlParts.length === 2) {
            const gcsFileName = urlParts[1];
            const tmpFile = path.join(UPLOADS_DIR, `${person.id || person._id}_gcs_${Date.now()}.jpeg`);
            try {
              await downloadFromGCS(gcsFileName, tmpFile);
              photoPath = tmpFile;
              isTempFile = true;
            } catch (e) {
              console.warn(`Failed to download GCS photo for ${person.name}:`, e.message || e);
              continue;
            }
          } else {
            console.warn(`Invalid GCS URL for ${person.name}: ${photoSource}`);
            continue;
          }
        } else if (photoSource.startsWith('http')) {
          // Other remote URL, download to temp file
          const tmpFile = path.join(UPLOADS_DIR, `${person.id || person._id}_remote_${Date.now()}.jpg`);
          try {
            const response = await axios.get(photoSource, { responseType: 'arraybuffer' });
            await fs.promises.writeFile(tmpFile, response.data);
            photoPath = tmpFile;
            isTempFile = true;
          } catch (e) {
            console.warn(`Failed to download remote photo for ${person.name}:`, e.message || e);
            continue;
          }
        } else if (photoSource.startsWith('/')) {
          // Local path
          photoPath = path.join(__dirname, photoSource);
        } else {
          // Invalid
          console.warn(`Skipping poster for ${person.name}: Invalid photo source: ${photoSource}`);
          continue;
        }

        if (!photoPath || !fs.existsSync(photoPath)) {
          console.warn(`Skipping poster for ${person.name}: Photo file not found.`);
          continue;
        }

        // For team users, set designation to the most specific 'Team: ...' value if present
        let designation = person.designation;
        if (designation && designation.includes('Team:')) {
          // Use the last 'Team: ...' in the string
          const matches = designation.match(/Team: ([^,]+)/g);
          if (matches && matches.length > 0) {
            designation = matches[matches.length - 1];
          }
        }

        // Debug logging
        console.log('DEBUG createFinalPoster:', {
          name: person.name,
          photo: photoPath,
          designation,
          teamName: person.teamName,
          email: person.email
        });

        // Build a plain object to avoid passing Mongoose document with non-enumerable props
        const personForPoster = {
          id: person.id || person._id || '',
          name: person.name || '',
          email: person.email || '',
          phone: person.phone || '',
          designation: designation || person.designation || '',
          teamName: person.teamName || '',
          photo: photoPath
        };

        await createFinalPoster({
          templatePath,
          person: personForPoster,
          logoPath: LOGO_PATH,
          outputPath: finalImagePath
        });

        await sendEmail({
          Name: person.name,
          Email: person.email,
          Phone: person.phone,
          Designation: person.designation
        }, finalImagePath);
        
        successfulRecipients++;

      } catch (err) {
        console.error(`Failed to generate/send poster for ${person.name}:`, err.message);
        // Clean up any partially created files for this recipient
        try { await fs.promises.unlink(finalImagePath); } catch (e) { /* ignore */ }
        // Clean up temp photo file if created
        if (isTempFile) {
          try { await fs.promises.unlink(photoPath); } catch (e) { /* ignore */ }
        }
      } finally {
        // Ensure the final image is cleaned up after each attempt
        try { await fs.promises.unlink(finalImagePath); } catch (e) { /* ignore */ }
        // Clean up temp photo file if created
        if (isTempFile) {
          try { await fs.promises.unlink(photoPath); } catch (e) { /* ignore */ }
        }
      }
    }

    try {
      fs.unlinkSync(templatePath);
    } catch (e) {
      console.warn('Template cleanup failed (ignored):', e.message || e);
    }

    res.json({ success: true, message: `✅ Posters sent to ${successfulRecipients} recipients.`, recipientCount: successfulRecipients });
  } catch (error) {
    console.error('Send posters error:', error);
    res.status(500).json({ error: 'Failed to send posters', details: error.message });
  }
});


const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || 'supersecret';
const ADMIN_COOKIE_NAME = 'admin_token';
const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 24 * 60 * 60 * 1000,
  signed: true,
};

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function isAdmin(req, res, next) {
  const isAdminQuery = req.query.isAdmin === 'true';
  const token = req.signedCookies && req.signedCookies[ADMIN_COOKIE_NAME];
  if (isAdminQuery || token) return next();
  return res.status(403).json({ error: 'Admin access required' });
}

app.post('/api/admin-login', (req, res) => {
  const { username, password } = req.body;
  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validUsername || !validPassword) return res.status(500).json({ error: 'Admin credentials not configured' });
  if (username === validUsername && password === validPassword) {
    const token = generateToken();
    res.cookie(ADMIN_COOKIE_NAME, token, ADMIN_COOKIE_OPTIONS);
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/admin-auth', (req, res) => {
  const token = req.signedCookies[ADMIN_COOKIE_NAME];
  if (token) {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie(ADMIN_COOKIE_NAME, { ...ADMIN_COOKIE_OPTIONS, maxAge: 0 });
  res.json({ success: true });
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, designation } = req.body;
    if (!id || !name || !email || !phone || !designation) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const existing = await db.User.findOne({ email });
    if (existing && existing.id !== id) {
      return res.status(400).json({ error: 'Email already in use by another user' });
    }
    const updatedUser = await db.updateUser(id, { name, email, phone, designation });
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: '✅ User updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
});

app.post('/api/admin/users', async (req, res) => {
  try {
    const { id, name, email, phone, designation } = req.body;
    if (!id || !name || !email) return res.status(400).json({ error: 'id, name and email required' });
    const exists = await db.User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already registered' });
    const user = { id: String(id), name, email, phone: phone || '', designation: designation || '', photoUrl: '' };
    const created = await db.createUser(user);
    res.json({ success: true, user: created });
  } catch (err) {
    console.error('Admin create error:', err);
    res.status(500).json({ error: err.message || 'Failed to create user' });
  }
});

app.post('/api/admin/migrate-photo', isAdmin, async (req, res) => {
  try {
    const users = await db.User.find({
      $and: [
        { $or: [{ photoUrl: { $exists: false } }, { photoUrl: '' }, { photoUrl: null }] },
        { photo: { $exists: true, $ne: '' } }
      ]
    }).lean();

    let updated = 0;
    for (const u of users) {
      const val = u.photo || '';
      if (!val) continue;
      const photoUrl = val.startsWith('/') ? val : `/${val}`;
      try { await db.updateUser(u.id, { ...u, photoUrl }); updated++; } catch (e) { console.warn('skip', u.id, e.message); }
    }

    res.json({ success: true, updated });
  } catch (err) {
    console.error('Migration API failed:', err);
    res.status(500).json({ error: 'Migration failed' });
  }
});

app.put('/api/users/:id/photo', upload.single('photo'), isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

    const user = await db.getUser(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const filenameSafe = (user.name || id).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const finalPhotoPath = path.join(UPLOADS_DIR, `${filenameSafe}_${Date.now()}.jpeg`);

    try {
      await processCircularImage(req.file.path, finalPhotoPath, 200);
      try { await fs.promises.unlink(req.file.path); } catch (e) { /* ignore cleanup error */ }
    } catch (err) {
      try { await fs.promises.rename(req.file.path, finalPhotoPath); } catch (e) { console.warn('Fallback save failed:', e.message || e); }
    }

    // Upload processed image to GCS
    const { uploadToGCS } = require('./utils/gcs');
    const gcsFileName = `photos/${Date.now()}_${filenameSafe}.jpeg`;
    let photoUrl;
    try {
      photoUrl = await uploadToGCS(finalPhotoPath, gcsFileName);
    } catch (err) {
      console.error('GCS upload failed:', err);
      // Clean up temp file on failure
      try { await fs.promises.unlink(finalPhotoPath); } catch (e) { /* ignore */ }
      return res.status(500).json({ error: 'Failed to upload photo to cloud storage' });
    }

    // Update DB: set photoUrl to GCS URL, clear photo field
    await db.updateUser(id, { photoUrl, photo: '' });

    // Clean up local temp file
    try { await fs.promises.unlink(finalPhotoPath); } catch (e) { console.warn('Local file cleanup failed (ignored):', e.message || e); }

    res.json({ success: true, photoUrl });
  } catch (err) {
    console.error('Admin photo update error:', err);
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is live!' });
});

const PORT = process.env.PORT || 3001;
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

const startServer = async () => {
  try {
    await db.connect();
  } catch (err) {
    console.error('Failed to connect to DB, exiting.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`✅ Server running on ${BACKEND_URL}`);
  });
};

startServer();
