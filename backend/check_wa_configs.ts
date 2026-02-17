
import mongoose from 'mongoose';
import CompanyWhatsAppConfig from './src/models/CompanyWhatsAppConfig';
import Company from './src/models/Company';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to DB');
    
    // Find Pugarch company
    const pugarch = await Company.findOne({ name: /Pugarch/i });
    if (!pugarch) {
      console.log('❌ Pugarch company not found');
    } else {
      console.log('🏢 Company:', pugarch.name, pugarch._id);
    }
    
    // Find all WA configs
    const configs = await CompanyWhatsAppConfig.find({});
    console.log('\n📊 All WhatsApp Configurations:');
    for (const c of configs) {
      const co = await Company.findById(c.companyId);
      console.log(`- Company: ${co?.name || 'Unknown'} (${c.companyId})`);
      console.log(`  Phone Number ID: ${c.phoneNumberId}`);
      console.log(`  Verify Token: ${c.verifyToken}`);
      console.log(`  Is Active: ${c.isActive}`);
      console.log(`  Is Verified: ${c.isVerified}`);
      console.log('-------------------');
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}
check();
