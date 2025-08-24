// Script to update users: extract teamName from designation and set as field
const mongoose = require('mongoose');
const db = require('./db');

(async () => {
  await db.connect();
  const users = await db.User.find({ designation: /Team: / });
  for (const user of users) {
    // Extract team name from designation string
    const match = user.designation.match(/Team: ([^,]+)/);
    if (match) {
      user.teamName = match[1].trim();
      await user.save();
      console.log(`Updated user ${user.name} with teamName: ${user.teamName}`);
    }
  }
  console.log('Done updating users.');
  process.exit(0);
})();
