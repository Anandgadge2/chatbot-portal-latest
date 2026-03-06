import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Module from '../models/Module';
import Company from '../models/Company';
import Role from '../models/Role';
import { seedModules } from './seedModules';
import { roleService } from '../services/roleService';

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function syncSystem() {
  try {
    console.log('🚀 Starting System Synchronization...');
    
    // 1. Connect to DB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in env');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📡 Connected to MongoDB');

    // 2. Sync Modules
    console.log('\n--- Syncing Modules ---');
    await seedModules();

    // 3. Sync Roles for all Companies
    console.log('\n--- Syncing Company Roles ---');
    const companies = await Company.find({});
    console.log(`Found ${companies.length} companies to process`);

    // Find a SuperAdmin to attribute the creation to (optional, but good for tracking)
    const User = mongoose.model('User');
    const superAdmin = await User.findOne({ role: 'SUPER_ADMIN' });
    const creatorId = superAdmin ? superAdmin._id.toString() : new mongoose.Types.ObjectId().toString();

    for (const company of companies) {
      console.log(`\nProcessing Company: ${company.name} (${company._id})`);
      
      // Update existing roles to have updated permissions if they match templates
      const results = await roleService.seedDefaultRoles(company._id.toString(), creatorId);
      
      // Log results
      const createdCount = results.filter(r => r.status === 'created').length;
      const updatedCount = results.filter(r => r.status === 'updated').length;
      const existingCount = results.filter(r => r.status === 'exists').length;
      console.log(`✅ Result: ${createdCount} roles created, ${updatedCount} roles updated, ${existingCount} already existed.`);
      
      // Special: Update existing "System" roles with latest permissions
      const systemRoles = await Role.find({ companyId: company._id, isSystem: true });
      for (const role of systemRoles) {
         // Logic to force update permissions from templates could go here if needed
         // For now, seedDefaultRoles only creates if missing. 
         // Let's enhance it to update permissions for system roles.
      }
    }

    console.log('\n✨ Synchronization Complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Synchronization Failed:', error);
    process.exit(1);
  }
}

syncSystem();
