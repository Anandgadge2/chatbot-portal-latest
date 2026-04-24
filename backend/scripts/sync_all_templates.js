const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

// Mock logger if needed
const { syncTemplatesForCompany } = require('../dist/services/whatsappTemplateSyncService');

async function syncAll() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error('MONGODB_URI not set');
    
    await mongoose.connect(mongoUri);
    console.log('Connected to DB');
    
    const configs = await mongoose.connection.collection('companywhatsappconfigs').find({ isActive: true }).toArray();
    console.log(`Found ${configs.length} active configs.`);

    for (const config of configs) {
      console.log(`Syncing templates for company: ${config.companyId}`);
      try {
        const result = await syncTemplatesForCompany(config.companyId);
        console.log(`Sync result for ${config.companyId}:`, result);
        
        const templatesInDb = await mongoose.connection.collection('whatsapptemplates').find({ companyId: config.companyId, isActive: true }).toArray();
        console.log(`Active templates in DB for ${config.companyId}:`, templatesInDb.map(t => t.name).join(', '));
      } catch (err) {
        console.error(`Sync failed for ${config.companyId}:`, err.message);
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

syncAll();
