
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Company from './src/models/Company';
import Department from './src/models/Department';
import CompanyWhatsAppConfig from './src/models/CompanyWhatsAppConfig';
import ChatbotFlow from './src/models/ChatbotFlow';

dotenv.config();

async function checkRelations() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const jharsuguda = await Company.findOne({ name: /Jharsug/i });
    if (!jharsuguda) {
      console.log('❌ Jharsuguda company not found');
      return;
    }

    console.log(`🏢 Jharsuguda Company:`);
    console.log(`   _id: ${jharsuguda._id}`);
    console.log(`   companyId: ${jharsuguda.companyId}`);
    console.log(`   name: ${jharsuguda.name}`);

    const waConfig = await CompanyWhatsAppConfig.findOne({ companyId: jharsuguda._id });
    if (waConfig) {
      console.log(`\n📱 WhatsApp Config found for Jharsuguda ID:`);
      console.log(`   Phone: ${waConfig.phoneNumber}`);
      console.log(`   Active Flows: ${waConfig.activeFlows.length}`);
    } else {
      console.log(`\n❌ No WhatsApp Config found linking to Jharsuguda _id (${jharsuguda._id})`);
      
      const allWAConfigs = await CompanyWhatsAppConfig.find({}).populate('companyId');
      console.log(`\nListing all WhatsApp Configs in DB:`);
      allWAConfigs.forEach(w => {
        const comp = w.companyId as any;
        console.log(`  - Phone: ${w.phoneNumber}, Company: ${comp?.name} (_id: ${comp?._id}, companyId: ${comp?.companyId})`);
      });
    }

    const depts = await Department.find({ companyId: jharsuguda._id });
    console.log(`\n📊 Departments linked to Jharsuguda (${jharsuguda._id}): ${depts.length}`);
    if (depts.length > 0) {
        console.log(`   Sample: ${depts.slice(0, 3).map(d => d.name).join(', ')}`);
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkRelations();
