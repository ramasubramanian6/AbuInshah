const db = require('../db');

async function checkDesignations() {
  try {
    await db.connect();
    const users = await db.allUsers();
    const designations = users.map(u => u.designation).filter(d => d);
    console.log('Designations found:', [...new Set(designations)]);
    console.log('Total users:', users.length);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkDesignations();