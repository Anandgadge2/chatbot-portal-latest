import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function fixUserRoleStrings() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error('MONGODB_URI not found');

    console.log('🔌 Connecting to MongoDB...');
    const conn = await mongoose.connect(mongoUri);
    console.log(`✅ Connected to database: ${conn.connection.db?.databaseName}`);

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Role = mongoose.model('Role', new mongoose.Schema({}, { strict: false }));

    const users = await User.find({ customRoleId: { $exists: true, $ne: null } });
    console.log(`\nChecking ${users.length} users with assigned roles...`);

    let updatedCount = 0;

    for (const u of users) {
      const user = u as any;
      const role: any = await Role.findById(user.customRoleId);
      if (role) {
        const expectedRoleKey = role.name.toUpperCase().replace(/\s+/g, '_');
        // Check if the legacy user.role matches the standard name.
        // We use the name from the role document to be the source of truth.
        const normalizedRoleName = role.name.toUpperCase();
        
        if (user.role !== normalizedRoleName && user.role !== expectedRoleKey) {
            console.log(`[Syncing] User ${user.firstName} ${user.lastName} (${user.email}): ${user.role} -> ${normalizedRoleName}`);
            await User.updateOne({ _id: user._id }, { $set: { role: normalizedRoleName } });
            updatedCount++;
        }
      }
    }

    console.log(`\n✅ Synchronization complete. Updated ${updatedCount} users.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

fixUserRoleStrings();
