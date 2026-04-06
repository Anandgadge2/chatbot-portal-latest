import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot';
const JHARSUGUDA_ID = '69ad4c6eb1ad8e405e6c0858';

async function cleanupTemplates() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const CompanyWhatsAppTemplate = mongoose.connection.collection('companywhatsapptemplates');
    
    // Find all templates for Jharsuguda
    const templates = await CompanyWhatsAppTemplate.find({ 
      companyId: new mongoose.Types.ObjectId(JHARSUGUDA_ID) 
    }).toArray();

    console.log(`Found ${templates.length} templates for Jharsuguda`);

    const linkToRemove = /🔗 \*Access Dashboard:\* https:\/\/chatbot-portal-latest-frontend\.vercel\.app\/\s*/g;
    const buttonTextToRemove = /🔗 \*Access Dashboard:\* https:\/\/chatbot-portal-latest-frontend\.vercel\.app\//g;

    let updatedCount = 0;
    for (const template of templates) {
      if (template.message && (template.message.includes('Access Dashboard') || template.message.includes('vercel.app'))) {
        let newMessage = template.message.replace(linkToRemove, '');
        // Clean up double newlines that might occur
        newMessage = newMessage.replace(/\n\n\n+/g, '\n\n').trim();
        
        await CompanyWhatsAppTemplate.updateOne(
          { _id: template._id },
          { $set: { message: newMessage } }
        );
        console.log(`✅ Updated template: ${template.templateKey}`);
        updatedCount++;
      }
    }

    console.log(`Successfully cleaned up ${updatedCount} templates.`);
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupTemplates();
