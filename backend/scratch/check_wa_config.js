const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkWAConfig() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const CompanyWhatsAppConfig = mongoose.model('CompanyWhatsAppConfig', new mongoose.Schema({}, { strict: false }));
    const Company = mongoose.model('Company', new mongoose.Schema({}, { strict: false }));
    
    const configs = await CompanyWhatsAppConfig.find({ isActive: true }).lean();
    console.log(`Found ${configs.length} active WA configs.`);

    for (const config of configs) {
      const company = await Company.findById(config.companyId).lean();
      console.log(`Company: ${company?.name || 'Unknown'}`);
      console.log(`Phone Number ID: ${config.phoneNumberId}`);
      console.log(`Business Account ID: ${config.businessAccountId}`);
      console.log(`Verify Token: ${config.verifyToken}`);
      console.log(`Access Token: ${config.accessToken ? (config.accessToken.substring(0, 10) + '...') : 'MISSING'}`);
      console.log('---');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkWAConfig();
