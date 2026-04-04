import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Force absolute path for .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import User from '../models/User';

const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('MONGODB_URI not found in .env');
  process.exit(1);
}

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI!);
    console.log('Connected to MongoDB');

    const users = await User.find({
      $or: [
        { designation: { $exists: true, $ne: "" } },
        { departmentId: { $exists: true } }
      ]
    });

    console.log(`Found ${users.length} users to potential migration.`);

    let migratedCount = 0;

    for (const user of users) {
      let updated = false;

      // Migrate designation -> designations
      const legacyDesignation = (user as any).designation;
      if (legacyDesignation && typeof legacyDesignation === 'string' && legacyDesignation.trim()) {
        if (!user.designations) user.designations = [];
        if (!user.designations.includes(legacyDesignation.trim())) {
          user.designations.push(legacyDesignation.trim());
          updated = true;
        }
      }

      // Migrate departmentId -> departmentIds
      const legacyDeptId = user.departmentId;
      if (legacyDeptId) {
        if (!user.departmentIds) user.departmentIds = [];
        const exists = user.departmentIds.some(id => id.toString() === legacyDeptId.toString());
        if (!exists) {
          user.departmentIds.push(legacyDeptId);
          updated = true;
        }
      }

      if (updated) {
        // Use markModified if needed, but save should work for these fields
        await user.save();
        migratedCount++;
        console.log(`Migrated user: ${user.email || user.userId}`);
      }
    }

    console.log(`Migration completed. ${migratedCount} users updated.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
