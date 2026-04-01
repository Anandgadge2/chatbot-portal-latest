import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot-portal';
const dbUri = MONGODB_URI.includes('?') 
  ? MONGODB_URI.replace(/\/\?/, '/test?') 
  : MONGODB_URI.endsWith('/') 
    ? MONGODB_URI + 'test' 
    : MONGODB_URI;

async function runMigration() {
  try {
    console.log('🚀 Starting Role Field Permanent Removal Migration...');
    await mongoose.connect(dbUri);
    console.log('✅ Connected to MongoDB');

    const User = mongoose.connection.collection('users');
    const Role = mongoose.connection.collection('roles');

    // 1. Get System Roles for mapping
    const systemRoles = await Role.find({ isSystem: true, companyId: null }).toArray();
    console.log(`Found ${systemRoles.length} system roles for mapping.`);

    const roleMap: Record<string, any> = {};
    systemRoles.forEach(role => {
      const key = role.key || '';
      const name = role.name.toLowerCase();
      if (key === 'SUPER_ADMIN' || name.includes('platform superadmin')) roleMap['SUPER_ADMIN'] = role._id;
      if (key === 'COMPANY_ADMIN' || name.includes('company administrator')) roleMap['COMPANY_ADMIN'] = role._id;
      if (key === 'DEPARTMENT_ADMIN' || name.includes('department administrator')) roleMap['DEPARTMENT_ADMIN'] = role._id;
      if (key === 'SUB_DEPARTMENT_ADMIN' || name.includes('sub department administrator')) roleMap['SUB_DEPARTMENT_ADMIN'] = role._id;
      if (key === 'OPERATOR' || name.includes('operator')) roleMap['OPERATOR'] = role._id;
    });

    // 2. Step-by-Step Migration for all users
    const users = await User.find({ role: { $exists: true } }).toArray();
    console.log(`Processing ${users.length} users...`);

    let migratedCount = 0;

    for (const user of users) {
      const legacyRole = user.role;
      const updates: any = {};

      // A. Handle "CUSTOM:id" format
      if (typeof legacyRole === 'string' && legacyRole.startsWith('CUSTOM:')) {
        const roleIdStr = legacyRole.split(':')[1];
        if (mongoose.Types.ObjectId.isValid(roleIdStr)) {
          updates.customRoleId = new mongoose.Types.ObjectId(roleIdStr);
        }
      }

      // B. Handle named legacy roles
      const normalizedRole = String(legacyRole || '').toUpperCase();
      if (roleMap[normalizedRole] && !user.customRoleId) {
        updates.customRoleId = roleMap[normalizedRole];
      }

      // C. Ensure SuperAdmin flag
      if (normalizedRole === 'SUPER_ADMIN' || user.isSuperAdmin === true) {
        updates.isSuperAdmin = true;
      }

      if (Object.keys(updates).length > 0) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        migratedCount++;
      }
    }

    console.log(`✅ Phase 1: Migrated data for ${migratedCount} users.`);

    // 3. Final Step: Unset the role field from ALL users
    const unsetResult = await User.updateMany({}, { $unset: { role: "" } });
    console.log(`✅ Phase 2: Unset 'role' field from ${unsetResult.modifiedCount} documents.`);

    // 4. Update the Platform SuperAdmin specifically
    const saResult = await User.updateOne(
      { email: 'superadmin@platform.com' },
      { $set: { isSuperAdmin: true, customRoleId: roleMap['SUPER_ADMIN'] } }
    );
    if (saResult.modifiedCount > 0) console.log('✅ SuperAdmin user verified.');

    // 5. Drop indices
    try {
      const indexes = await User.indexes();
      for (const idx of indexes) {
        if (idx.key && idx.key.role && idx.name) {
          console.log(`Dropping index: ${idx.name}`);
          await User.dropIndex(idx.name as string);
        }
      }
      console.log('✅ Role-based indexes dropped.');
    } catch (e) {
      console.log('⚠️ Index cleanup skipped or already done.');
    }

    console.log('✨ Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
