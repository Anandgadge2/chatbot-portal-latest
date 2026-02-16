
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Company from './src/models/Company';

dotenv.config();

async function listCompanies() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const companies = await Company.find({}, { name: 1, _id: 1, companyId: 1 });
    console.log('--- All Companies ---');
    companies.forEach(c => {
      console.log(`ID: ${c._id}, CID: ${c.companyId}, Name: ${c.name}`);
    });
    
    const jharsuguda = await Company.findOne({ name: /Jharsug/i });
    if (jharsuguda) {
      console.log('\n--- Found Jharsuguda ---');
      console.log(`ID: ${jharsuguda._id}, Name: ${jharsuguda.name}`);
    } else {
      console.log('\n❌ No company with "Jharsug" in name found.');
    }
    console.log('-----------------');

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

listCompanies();
