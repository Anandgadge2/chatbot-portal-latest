import mongoose from 'mongoose';
import Grievance from '../src/models/Grievance';
import CompanyWhatsAppConfig from '../src/models/CompanyWhatsAppConfig';
import { uploadWhatsAppMediaToGCS } from '../src/services/gcsService';
import { logger } from '../src/config/logger';

async function testMigration() {
    try {
        console.log('🚀 Starting manual migration test for GRV00000364...');
        await mongoose.connect('mongodb://chatbot_user:Chatbot_user%4091@103.185.75.242:27017/whatsapp_chatbot');
        console.log('✅ Connected to MongoDB');

        const grievance = await Grievance.findOne({ grievanceId: 'GRV00000364' });
        if (!grievance) {
            console.error('❌ Grievance not found');
            process.exit(1);
        }

        const waConfig = await CompanyWhatsAppConfig.findOne({ companyId: grievance.companyId, isActive: true });
        if (!waConfig || !waConfig.accessToken) {
            console.error('❌ WhatsApp config or accessToken not found');
            process.exit(1);
        }

        console.log(`📦 Found ${grievance.media.length} media items. Checking for migration...`);

        let updated = false;
        for (const m of grievance.media) {
            if (/^\d+$/.test(m.url) && !m.isGCS) {
                console.log(`📸 Migrating WhatsApp ID: ${m.url}...`);
                const timestamp = Date.now();
                const folder = `grievances/${grievance.grievanceId}/evidence`;
                
                const result = await uploadWhatsAppMediaToGCS(
                    m.url,
                    waConfig.accessToken,
                    `${timestamp}_${m.url}`,
                    folder
                );

                if (result) {
                    console.log(`✅ Success! New URL: ${result.url}`);
                    m.url = result.url;
                    m.isGCS = true;
                    m.mimeType = result.mimeType;
                    m.originalName = result.originalName;
                    updated = true;
                } else {
                    console.error('❌ Migration failed for item');
                }
            }
        }

        if (updated) {
            grievance.markModified('media');
            await grievance.save();
            console.log('💾 Grievance updated in database!');
        } else {
            console.log('ℹ️ No items needed migration.');
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

testMigration();
