
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkRoles() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot_portal';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const Role = mongoose.model('Role', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    const companyId = '6996db20b0b919335c191d6f';
    const roles = await Role.find({ companyId });
    console.log(`Roles for company ${companyId}:`, roles.length);
    roles.forEach(r => console.log(` - ${r.name} (Key: ${r.key}, ID: ${r._id})`));

    const companyAdmin = await User.findOne({ phone: '9356150561' });
    if (companyAdmin) {
      console.log('User 9356150561:');
      console.log(' - Role:', companyAdmin.role);
      console.log(' - customRoleId:', companyAdmin.customRoleId);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkRoles();
