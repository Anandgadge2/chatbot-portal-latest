import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot-portal';

// Use 'test' as default if not in URI
const dbUri = MONGODB_URI.includes('?') 
  ? MONGODB_URI.replace(/\/\?/, '/test?') 
  : MONGODB_URI.endsWith('/') 
    ? MONGODB_URI + 'test' 
    : MONGODB_URI;

console.log('Connecting to:', dbUri);

async function migrate() {
  try {
    await mongoose.connect(dbUri);
    console.log('✅ Connected to MongoDB');

    const Role = mongoose.connection.collection('roles');
    const User = mongoose.connection.collection('users');

    // 1. Get all system roles
    const systemRoles = await Role.find({ isSystem: true, companyId: null }).toArray();
    console.log(`Found ${systemRoles.length} system roles`);

    const roleMap: Record<string, any> = {};
    systemRoles.forEach(role => {
      const name = role.name.toLowerCase();
      if (name.includes('platform superadmin')) roleMap['SUPER_ADMIN'] = role._id;
      if (name.includes('company administrator')) roleMap['COMPANY ADMINISTRATOR'] = role._id;
      if (name.includes('department administrator')) roleMap['DEPARTMENT ADMINISTRATOR'] = role._id;
      if (name.includes('sub department administrator')) roleMap['SUB DEPARTMENT ADMINISTRATOR'] = role._id;
      if (name.includes('operator')) roleMap['OPERATOR'] = role._id;
    });

    console.log('Role Map for mapping:', JSON.stringify(roleMap, null, 2));

    // 2. Fetch all users
    const users = await User.find({}).toArray();
    console.log(`Processing ${users.length} users...`);

    let updatedCount = 0;
    for (const user of users) {
      const legacyRole = user.role || '';
      const normalizedRole = legacyRole.toUpperCase();
      
      let targetRoleId = roleMap[normalizedRole];

      // If no mapping found and not already CUSTOM, skip or log
      if (!targetRoleId) {
        if (user.customRoleId) {
            // Already has a custom role, check if it's still valid or if we should keep it
            console.log(`User ${user.email || user._id} already has customRoleId: ${user.customRoleId}. Skipping.`);
            continue;
        }
        console.warn(`⚠️ No role mapping found for user ${user.email || user._id} with role "${legacyRole}"`);
        continue;
      }

      // Update user
      await User.updateOne(
        { _id: user._id },
        { 
          $set: { 
            customRoleId: targetRoleId,
            role: 'CUSTOM' // Standardize on CUSTOM for all roles that use customRoleId
          } 
        }
      );
      updatedCount++;
    }

    console.log(`✅ Migration complete. Updated ${updatedCount} users.`);

    // 3. Ensure SuperAdmin user has isSuperAdmin: true AND customRoleId
    const superAdminResult = await User.updateOne(
      { email: 'superadmin@platform.com' },
      { 
        $set: { 
          isSuperAdmin: true,
          role: 'CUSTOM',
          customRoleId: roleMap['SUPER_ADMIN']
        } 
      }
    );
    if (superAdminResult.modifiedCount > 0) {
        console.log('✅ SuperAdmin user verified and updated.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
