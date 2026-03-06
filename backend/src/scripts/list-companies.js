
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function listCompanies() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot_portal';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const Comp = mongoose.model('Company', new mongoose.Schema({}, { strict: false }));
    const companies = await Comp.find({});
    console.log('Available Companies:', companies.length);
    companies.forEach(c => console.log(` - ${c.name} (ID: ${c._id})`));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

listCompanies();
