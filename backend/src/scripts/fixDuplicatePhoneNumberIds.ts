/**
 * Script to find and fix duplicate Phone Number IDs in WhatsApp configurations
 * 
 * Usage: npx ts-node src/scripts/fixDuplicatePhoneNumberIds.ts
 */

import mongoose from 'mongoose';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import Company from '../models/Company';

async function fixDuplicatePhoneNumberIds() {
  try {
    console.log('🔍 Finding Duplicate Phone Number IDs\n');
    console.log('='.repeat(60));

    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot_portal';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all WhatsApp configs
    const configs = await CompanyWhatsAppConfig.find({}).populate('companyId', 'name companyId');
    
    // Group by phoneNumberId
    const phoneNumberIdMap = new Map<string, any[]>();
    
    for (const config of configs) {
      const phoneNumberId = config.phoneNumberId;
      if (!phoneNumberIdMap.has(phoneNumberId)) {
        phoneNumberIdMap.set(phoneNumberId, []);
      }
      phoneNumberIdMap.get(phoneNumberId)!.push(config);
    }
    
    // Find duplicates
    const duplicates = Array.from(phoneNumberIdMap.entries()).filter(([_, configs]) => configs.length > 1);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate Phone Number IDs found!\n');
    } else {
      console.log(`❌ Found ${duplicates.length} duplicate Phone Number ID(s):\n`);
      
      for (const [phoneNumberId, configs] of duplicates) {
        console.log(`\n📱 Phone Number ID: ${phoneNumberId}`);
        console.log(`   Used by ${configs.length} companies:\n`);
        
        for (let i = 0; i < configs.length; i++) {
          const config = configs[i];
          const company = config.companyId as any;
          console.log(`   ${i + 1}. Company: ${company?.name || 'Unknown'}`);
          console.log(`      Company ID: ${company?.companyId || 'N/A'}`);
          console.log(`      Phone Number: ${config.phoneNumber}`);
          console.log(`      Display Phone: ${config.displayPhoneNumber}`);
          console.log(`      Is Active: ${config.isActive ? '✅ Yes' : '❌ No'}`);
          console.log(`      Config ID: ${config._id}`);
          console.log(`      Created: ${config.createdAt}`);
          console.log('');
        }
        
        // Suggest which one to keep
        const activeConfigs = configs.filter(c => c.isActive);
        const mostRecent = configs.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];
        
        console.log(`   💡 Recommendation:`);
        if (activeConfigs.length === 1) {
          const company = activeConfigs[0].companyId as any;
          console.log(`      Keep: ${company?.name} (only active config)`);
          console.log(`      Deactivate: All others`);
        } else {
          const company = mostRecent.companyId as any;
          console.log(`      Keep: ${company?.name} (most recently updated)`);
          console.log(`      Deactivate: All others`);
        }
        console.log('');
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('🔧 How to Fix:\n');
      console.log('Option 1: Deactivate old configurations');
      console.log('  1. Go to WhatsApp Config page for each company');
      console.log('  2. Turn OFF the "Is Active" toggle for old configs');
      console.log('  3. Save changes\n');
      
      console.log('Option 2: Delete old configurations (MongoDB)');
      console.log('  db.companywhatsappconfigs.deleteOne({ _id: ObjectId("CONFIG_ID") })\n');
      
      console.log('Option 3: Update Phone Number ID for new config');
      console.log('  1. Get the correct Phone Number ID from Meta Business Manager');
      console.log('  2. Update in WhatsApp Config page');
      console.log('  3. Save changes\n');
    }
    
    // Show all Phone Number IDs in use
    console.log('\n' + '='.repeat(60));
    console.log('📊 All Phone Number IDs in Database:\n');
    
    const allPhoneNumberIds = Array.from(phoneNumberIdMap.entries());
    for (const [phoneNumberId, configs] of allPhoneNumberIds) {
      const config = configs[0];
      const company = config.companyId as any;
      const status = config.isActive ? '✅' : '❌';
      console.log(`${status} ${phoneNumberId} → ${company?.name || 'Unknown'} (${configs.length} config${configs.length > 1 ? 's' : ''})`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Analysis complete!\n');

  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run script
fixDuplicatePhoneNumberIds().catch(console.error);
