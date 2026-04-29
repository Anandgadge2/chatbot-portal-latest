
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Role = mongoose.model('Role', new mongoose.Schema({}, { strict: false }), 'roles');
    const Company = mongoose.model('Company', new mongoose.Schema({}, { strict: false }), 'companies');
    
    // Find the latest company
    const latestCompany = await Company.findOne().sort({ createdAt: -1 });
    if (!latestCompany) {
      console.log('No company found');
      process.exit(0);
    }
    
    console.log('Latest Company:', latestCompany.name, '(', latestCompany._id, ')');
    console.log('Enabled Modules:', latestCompany.enabledModules);
    
    // Find roles for this company
    const roles = await Role.find({ companyId: latestCompany._id });
    console.log('Roles found:', roles.length);
    
    for (const role of roles) {
      console.log('Role:', role.name);
      console.log('Permissions:', JSON.stringify(role.permissions, null, 2));
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
