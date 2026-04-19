const mongoose = require('mongoose');
require('dotenv').config();

async function cleanup() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    
    const db = mongoose.connection.db;

    // Drop old 'otps' collection if it exists
    const collections = await db.listCollections().toArray();
    if (collections.some(c => c.name === 'otps')) {
      console.log('Dropping old "otps" collection...');
      await db.dropCollection('otps');
    }

    // Clean up broken tokens in 'authtokens'
    console.log('Removing broken tokens from "authtokens"...');
    const result = await db.collection('authtokens').deleteMany({ 
      $or: [
        { role: { $exists: false } },
        { role: "undefined" },
        { role: null }
      ]
    });
    
    console.log(`Cleaned up ${result.deletedCount} broken records.`);
    console.log('Database cleanup complete!');
    process.exit(0);
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
}

cleanup();
