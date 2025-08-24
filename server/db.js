const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/abuinshah';

mongoose.set('strictQuery', false);
// Disable buffering of model operations until connected - fail fast instead of timing out
mongoose.set('bufferCommands', false);

const connect = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 20000
    });
    console.log('Connected to MongoDB:', MONGO_URI);
  } catch (err) {
    console.error('MongoDB connection error:', err && err.message ? err.message : err);
    throw err;
  }
};

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  phone: String,
  designation: String,
  teamName: String, // Added for team support
  photoUrl: String,
  photo: String
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

module.exports = {
  connect,
  User,
  // helper wrappers
  allUsers: async () => await User.find({}).sort({ createdAt: 1 }).lean(),
  getUser: async (id) => await User.findOne({ id }).lean(),
  createUser: async (user) => {
    if (mongoose.connection.readyState !== 1) throw new Error('Not connected to MongoDB');
    const u = new User(user);
    return await u.save();
  },
  findMembersByDesignation: async (designation) => {
    if (!designation) return [];
    const desig = designation.toLowerCase();
    // match exact or comma-separated lists (case-insensitive)
    const users = await User.find({
      designation: { $exists: true, $ne: null },
      $expr: {
        $in: [desig, { $map: { input: { $split: [{ $toLower: '$designation' }, ','] }, as: 'd', in: { $trim: { input: '$$d' } } } } ]
      }
    }).lean();

    // Ensure each user has a valid photo field
    return users.map(user => ({
      ...user,
      // If photo exists, use it; otherwise try photoUrl
      photo: user.photo || (user.photoUrl ? user.photoUrl.split('/').pop() : null)
    }));
  },
  updateUser: async (id, changes) => await User.findOneAndUpdate({ id }, changes, { new: true }),
    updateUser: async (id, changes) => {
      if (mongoose.connection.readyState !== 1) throw new Error('Not connected to MongoDB');
      return await User.findOneAndUpdate({ id }, changes, { new: true });
    },
    deleteUser: async (id) => {
      if (mongoose.connection.readyState !== 1) throw new Error('Not connected to MongoDB');
      return await User.findOneAndDelete({ id });
    }
};
