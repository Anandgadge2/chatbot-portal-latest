const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const uris = [
  process.env.MONGODB_URI,
  'mongodb+srv://agadge797_db_user:Amg797gmail@cluster0.5sim50l.mongodb.net/test' // Hardcoded fallback just in case
];

const STANDARD_ROLES_LIST = [
  'Platform Superadmin',
  'Company Administrator',
  'Department Administrator',
  'Sub Department Administrator',
  'Operator'
];

async function run() {
  let connected = false;
  for (const uri of uris) {
    if (!uri) continue;
    try {
      console.log('Connecting to:', uri.replace(/:([^:@]+)@/, ':****@'));
      await mongoose.connect(uri);
      console.log('✅ Connected to:', mongoose.connection.name);
      connected = true;
      break;
    } catch (e) {
      console.error('❌ Connection failed for', uri.substr(0, 30), e.message);
    }
  }

  if (!connected) process.exit(1);

  const Role = mongoose.model('Role', new mongoose.Schema({}, { strict: false }), 'roles');
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');

  // 1. Create standard global roles
  const map = {};
  for (const name of STANDARD_ROLES_LIST) {
     let role = await Role.findOne({ name, companyId: null });
     if (!role) {
       console.log('Creating global role:', name);
       role = await Role.create({
         name,
         companyId: null,
         isSystem: true,
         level: name.includes('Super') ? 0 : name.includes('Company') ? 1 : name.includes('Sub') ? 3 : name.includes('Dept') ? 2 : 4,
         scope: name.includes('Super') ? 'platform' : name.includes('Company') ? 'company' : name.includes('Dept') ? 'department' : 'assigned',
         permissions: [{ module: '*', actions: ['*'] }], // Global admin permissions broadly defined for now
         createdBy: null
       });
     }
     map[name.toLowerCase().replace(' administrator', ' admin')] = role._id;
     map[name.toLowerCase()] = role._id;
  }

  // Handle common variations
  map['company admin'] = map['company administrator'];
  map['department admin'] = map['department administrator'];
  map['sub department admin'] = map['sub department administrator'];


  // 2. Migrate Users
  const users = await User.find({ customRoleId: { $ne: null } });
  for (const user of users) {
     const roleData = await Role.findById(user.customRoleId);
     if (roleData && roleData.companyId !== null) {
       let targetId = map[roleData.name.toLowerCase()];
       // Try common cleanup
       if (!targetId) {
         if (roleData.name.toLowerCase().includes('company')) targetId = map['company administrator'];
         if (roleData.name.toLowerCase().includes('department') && !roleData.name.toLowerCase().includes('sub')) targetId = map['department administrator'];
         if (roleData.name.toLowerCase().includes('sub department')) targetId = map['sub department administrator'];
         if (roleData.name.toLowerCase().includes('operator')) targetId = map['operator'];
       }

       if (targetId) {
         console.log(`Migrating user ${user.email || user.phone}`);
         await User.updateOne({ _id: user._id }, { $set: { customRoleId: targetId } });
       }
     }
  }

  // 3. Delete non-global standard roles
  console.log('Cleaning up duplicate roles...');
  const result = await Role.deleteMany({ 
    companyId: { $ne: null }, 
    name: { $in: [/Admin/i, /Operator/i, /Administrator/i] }
  });
  console.log('Deleted', result.deletedCount, 'duplicates.');

  process.exit(0);
}

run();
