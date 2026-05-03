import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

// Define interface for AuditLog to resolve TypeScript errors
interface IAuditLog {
  timestamp: Date;
  action: string;
  resource: string;
  resourceId: string;
  details: any;
}

async function checkRecentLogs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    // Specify the interface when creating the model
    const AuditLog = mongoose.model<IAuditLog>('AuditLog', new mongoose.Schema({}, { strict: false }));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Cast the lean() result to the interface array
    const logs = (await AuditLog.find({
      timestamp: { $gte: today }
    }).sort({ timestamp: -1 }).limit(20).lean()) as unknown as IAuditLog[];

    console.log(`Found ${logs.length} logs for today.`);
    logs.forEach(log => {
      // TypeScript now correctly recognizes timestamp, action, resource, etc.
      const date = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
      console.log(`[${date.toISOString()}] ${log.action} | ${log.resource} | ${log.resourceId} | ${JSON.stringify(log.details)}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkRecentLogs();
