import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const mongoUri = process.env.MONGODB_URI;

async function debugNotifications() {
  if (!mongoUri) {
    console.error('MONGODB_URI missing');
    return;
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // Import models
  const User = (await import('../src/models/User')).default;
  const Notification = (await import('../src/models/Notification')).default;
  
  const user = await User.findOne({ isActive: true });
  
  if (!user) {
    console.error('No active user found');
    return;
  }

  console.log(`Found user: ${user._id} (${user.firstName})`);

  // Try to create a notification
  try {
    const note = await Notification.create({
      userId: user._id,
      companyId: user.companyId || user._id, // fallback for superadmin
      eventType: 'GRIEVANCE_RECEIVED',
      title: 'Debug Notification',
      message: 'This is a test notification from scratch script',
      isRead: false
    });
    console.log('Notification created:', note._id);

    const count = await Notification.countDocuments({ userId: user._id });
    console.log(`Notification count for user ${user._id}: ${count}`);
  } catch (err) {
    console.error('Failed to create notification:', err);
  }

  await mongoose.disconnect();
}

debugNotifications();
