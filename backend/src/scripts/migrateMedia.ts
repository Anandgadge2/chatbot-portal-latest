import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import Grievance from '../models/Grievance';
import { uploadWhatsAppMediaToGCS } from '../services/gcsService';
import { logger } from '../config/logger';

dotenv.config();

async function migrate() {
  try {
    console.log('🚀 Starting Media Migration: WhatsApp ID -> GCS URL');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error('MONGODB_URI missing in .env');
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find all grievances with raw numeric media IDs
    const grievances = await Grievance.find({
      'media.url': { $regex: /^\d+$/ },
      'media.isGCS': { $ne: true }
    });

    console.log(`🔍 Found ${grievances.length} grievances with potentially broken WhatsApp media IDs.`);

    if (grievances.length === 0) {
      console.log('✅ No migration needed.');
      return;
    }

    // Cache for access tokens
    const tokenCache = new Map<string, string>();

    for (const grievance of grievances) {
      const companyId = grievance.companyId.toString();
      
      let accessToken = tokenCache.get(companyId);
      if (!accessToken) {
        const config = await CompanyWhatsAppConfig.findOne({ companyId: grievance.companyId });
        if (config?.accessToken) {
          accessToken = config.accessToken;
          tokenCache.set(companyId, accessToken);
        }
      }

      if (!accessToken) {
        console.warn(`⚠️ No WhatsApp accessToken found for company ${companyId}. Skipping grievance ${grievance.grievanceId}`);
        continue;
      }

      console.log(`📦 Processing Grievance ${grievance.grievanceId}...`);
      let updated = false;

      for (let i = 0; i < grievance.media.length; i++) {
        const media = grievance.media[i];
        
        // Check if it's a raw numeric ID
        if (/^\d+$/.test(media.url) && !media.isGCS) {
          console.log(`   📸 Found WhatsApp ID: ${media.url}. Attempting GCS upload...`);
          
          try {
            const timestamp = Date.now();
            const folder = `grievances/${grievance.grievanceId}/evidence`;
            
            const uploadResult = await uploadWhatsAppMediaToGCS(
              media.url,
              accessToken,
              `${timestamp}_${media.url}`,
              folder
            );

            if (uploadResult) {
              console.log(`   ✅ Success! New URL: ${uploadResult.url}`);
              grievance.media[i].url = uploadResult.url;
              grievance.media[i].isGCS = true;
              grievance.media[i].mimeType = uploadResult.mimeType;
              grievance.media[i].originalName = uploadResult.originalName;
              updated = true;
            } else {
              console.error(`   ❌ Failed to upload media ID ${media.url} to GCS.`);
            }
          } catch (err: any) {
            console.error(`   ❌ Error during upload for ${media.url}: ${err.message}`);
          }
        }
      }

      if (updated) {
        await grievance.save();
        console.log(`   💾 Grievance ${grievance.grievanceId} updated.`);
      }
    }

    console.log('🏁 Migration complete.');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

migrate();
