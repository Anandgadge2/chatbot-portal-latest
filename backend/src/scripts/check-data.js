
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkData() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot_portal';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const companyId = '6996db20b0b919335c191d6f';
    const cid = new mongoose.Types.ObjectId(companyId);

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Dept = mongoose.model('Department', new mongoose.Schema({}, { strict: false }));
    const Grie = mongoose.model('Grievance', new mongoose.Schema({}, { strict: false }));
    const Appt = mongoose.model('Appointment', new mongoose.Schema({}, { strict: false }));
    const Comp = mongoose.model('Company', new mongoose.Schema({}, { strict: false }));

    console.log(`Checking data for Company: ${companyId}`);
    
    const company = await Comp.findById(cid);
    console.log('Company found:', company ? company.name : 'NO');

    const userCount = await User.countDocuments({ companyId: cid });
    const deptCount = await Dept.countDocuments({ companyId: cid });
    const grieCount = await Grie.countDocuments({ companyId: cid });
    const apptCount = await Appt.countDocuments({ companyId: cid });

    console.log('Counts:');
    console.log(' - Users:', userCount);
    console.log(' - Departments:', deptCount);
    console.log(' - Grievances:', grieCount);
    console.log(' - Appointments:', apptCount);

    if (userCount > 0) {
       const sampleUser = await User.findOne({ companyId: cid });
       console.log('Sample User:', sampleUser.firstName, sampleUser.role);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkData();
