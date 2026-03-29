import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Fix directory issues in backend
dotenv.config({ path: path.join(__dirname, '../../.env') });

const mongoUri = process.env.MONGODB_URI;

const STANDARD_ROLES = [
  {
    name: 'Platform Superadmin',
    level: 0,
    scope: 'platform',
    isSystem: true,
    permissions: [
      { module: 'SETTINGS', actions: ['*'] },
      { module: 'USER_MANAGEMENT', actions: ['*'] },
      { module: 'COMPANIES', actions: ['*'] },
      { module: 'DEPARTMENTS', actions: ['*'] },
      { module: 'ANALYTICS', actions: ['*'] },
      { module: 'GRIEVANCE', actions: ['*'] },
      { module: 'APPOINTMENT', actions: ['*'] },
      { module: 'FLOW_BUILDER', actions: ['*'] }
    ]
  },
  {
    name: 'Company Administrator',
    level: 1,
    scope: 'company',
    isSystem: true,
    permissions: [
      { module: 'SETTINGS', actions: ['*'] },
      { module: 'USER_MANAGEMENT', actions: ['*'] },
      { module: 'DEPARTMENTS', actions: ['*'] },
      { module: 'ANALYTICS', actions: ['*'] },
      { module: 'GRIEVANCE', actions: ['*'] },
      { module: 'APPOINTMENT', actions: ['*'] },
      { module: 'LEAD_CAPTURE', actions: ['*'] }
    ]
  },
  {
    name: 'Department Administrator',
    level: 2,
    scope: 'department',
    isSystem: true,
    permissions: [
      { module: 'USER_MANAGEMENT', actions: ['view', 'create', 'update'] },
      { module: 'DEPARTMENTS', actions: ['view', 'create', 'update'] },
      { module: 'GRIEVANCE', actions: ['view', 'assign', 'status_change', 'revert'] },
      { module: 'ANALYTICS', actions: ['view'] }
    ]
  },
  {
    name: 'Sub Department Administrator',
    level: 3,
    scope: 'subdepartment',
    isSystem: true,
    permissions: [
      { module: 'USER_MANAGEMENT', actions: ['view', 'create'] },
      { module: 'GRIEVANCE', actions: ['view', 'status_change', 'revert'] }
    ]
  },
  {
    name: 'Operator',
    level: 4,
    scope: 'assigned',
    isSystem: true,
    permissions: [
      { module: 'GRIEVANCE', actions: ['view', 'status_change'] },
      { module: 'DASHBOARD', actions: ['view'] }
    ]
  }
];

const run = async () => {
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment');
    process.exit(1);
  }

  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database:', mongoose.connection.name);

    if (mongoose.connection.name !== 'test') {
      console.warn('⚠️ WARNING: Current database is NOT "test". It is:', mongoose.connection.name);
    }

    const Role = mongoose.model('Role', new mongoose.Schema({}, { strict: false }), 'roles');
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');

    console.log('\n--- PHASE 1: Create Standard Global Roles ---');
    
    // We'll use names to identify standard roles for now
    const standardRolesMap: { [key: string]: any } = {};

    for (const roleData of STANDARD_ROLES) {
      // Find if this standard role already exists globaly (companyId: null)
      let existing: any = await Role.findOne({ 
        name: { $regex: new RegExp(`^${roleData.name}$`, 'i') }, 
        companyId: null 
      });

      if (!existing) {
        console.log(`[+] Creating global role: ${roleData.name}`);
        // We set companyId explicitly to null.
        // Also we need a placeholder for createdBy if we want to follow schema strictly, 
        // but here we are using a flexible schema.
        const newRole: any = await Role.create({
          ...roleData,
          companyId: null,
          roleId: `SYS${roleData.level}`,
          createdBy: new mongoose.Types.ObjectId('000000000000000000000000') // Placeholder
        });
        standardRolesMap[roleData.name.toLowerCase()] = newRole._id;
      } else {
        console.log(`[-] Updating global role permissions: ${roleData.name}`);
        await Role.updateOne({ _id: existing._id }, { $set: { permissions: roleData.permissions, isSystem: true, level: roleData.level, scope: roleData.scope } });
        standardRolesMap[roleData.name.toLowerCase()] = existing._id;
      }
    }

    console.log('\n--- PHASE 2: Migrate Users to Standard Roles ---');
    
    // Process companies to get their custom versions and replace them in users
    const allUsers: any[] = await User.find({ customRoleId: { $ne: null } });
    console.log(`Found ${allUsers.length} users with assigned roles.`);

    for (const user of allUsers) {
      const currentRole: any = await Role.findById(user.customRoleId);
      if (currentRole && currentRole.companyId !== null) {
        // This is a company-specific role that should be global
        const roleName = currentRole.name;
        // Map common variations (e.g. "Department admin" vs "Department Administrator")
        let standardKey = roleName.toLowerCase();
        if (standardKey.includes('department administrator') || standardKey === 'department admin') standardKey = 'department administrator';
        if (standardKey.includes('sub department administrator') || standardKey === 'sub department admin') standardKey = 'sub department administrator';
        if (standardKey.includes('company administrator') || standardKey === 'company admin') standardKey = 'company administrator';

        const standardId = standardRolesMap[standardKey];
        
        if (standardId) {
          console.log(`[Migrating] User ${user.email || user.phone || user._id}: ${roleName} -> Global ${roleName}`);
          // Sync both customRoleId and the legacy role string
          await User.updateOne({ _id: user._id }, { $set: { customRoleId: standardId, role: roleName.toUpperCase() } });
        } else {
          console.warn(`[!] No global match for role: ${roleName}. User ${user._id} skipped.`);
        }
      }
    }

    console.log('\n--- PHASE 3: Cleanup Duplicate Company-Specific Roles ---');
    
    const standardNames = STANDARD_ROLES.map(r => r.name);
    // Include variations
    standardNames.push('Company Admin', 'Department Admin', 'Sub Department Admin', 'Operator', 'sub department admin');

    const result = await Role.deleteMany({ 
      companyId: { $ne: null }, 
      name: { $in: standardNames.map(n => new RegExp(`^${n}$`, 'i')) } 
    });
    
    console.log(`✅ Deleted ${result.deletedCount} company-specific duplicate roles.`);
    
    const totalCount = await Role.countDocuments();
    console.log(`📊 Final total roles in database: ${totalCount}`);

    console.log('\n✅ Mission Complete. Database is now standardized.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
};

run();
