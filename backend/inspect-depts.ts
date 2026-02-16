
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Company from './src/models/Company';
import Department from './src/models/Department';

dotenv.config();

async function inspectData() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const companies = await Company.find({}, { name: 1, _id: 1, companyId: 1 });
    console.log('--- Companies ---');
    companies.forEach(c => {
      console.log(`ID: ${c._id}, CID: ${c.companyId}, Name: ${c.name}`);
    });

    const jharsuguda = await Company.findOne({ name: /Jharsug/i });
    if (jharsuguda) {
      console.log(`\nSelected Jharsuguda ID: ${jharsuguda._id}`);
      const depts = await Department.find({ companyId: jharsuguda._id });
      console.log(`\nFound ${depts.length} departments for Jharsuguda`);
      depts.forEach(d => {
        console.log(`  - ${d.name} (isActive: ${d.isActive})`);
      });
      
      const allDepts = await Department.find({ name: /Zilla/i });
      console.log(`\nDepartments with 'Zilla' in name: ${allDepts.length}`);

      const deptsByAnyCompany = await Department.find({}).limit(5);
      console.log(`\nRandom Departments Sample:`);
      deptsByAnyCompany.forEach(d => {
          console.log(`  - ${d.name} (companyId: ${d.companyId})`);
      });

    } else {
      console.log('\n❌ Jharsuguda company not found');
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

inspectData();
