
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function listDatabases() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot_portal';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const admin = mongoose.connection.db.admin();
    const dbs = await admin.listDatabases();
    console.log('Databases:', dbs.databases.map(db => db.name));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

listDatabases();
