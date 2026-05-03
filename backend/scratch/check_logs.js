const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkRecentLogs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const AuditLog = mongoose.model('AuditLog', new mongoose.Schema({}, { strict: false }));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logs = await AuditLog.find({
      timestamp: { $gte: today }
    }).sort({ timestamp: -1 }).limit(20).lean();

    console.log(`Found ${logs.length} logs for today.`);
    logs.forEach(log => {
      console.log(`[${log.timestamp.toISOString()}] ${log.action} | ${log.resource} | ${log.resourceId} | ${JSON.stringify(log.details)}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkRecentLogs();
