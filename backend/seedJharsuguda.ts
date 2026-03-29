import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import Company from './src/models/Company';
import { seedDefaultTemplates } from './src/services/templateSeeder';

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const company = await Company.findById('69ad4c6eb1ad8e405e6c0858');
  if (!company) {
    console.log('Company not found');
    process.exit(1);
  }

  console.log('Seeding templates for:', company.name);
  await seedDefaultTemplates(company);
  console.log('Done');
  process.exit(0);
}

run();
