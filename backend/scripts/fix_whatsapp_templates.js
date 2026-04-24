const mongoose = require('mongoose');

async function fixTemplates() {
  try {
    await mongoose.connect('mongodb://localhost:27017/test');
    console.log('Connected to DB');
    
    // Reactivate approved and pending templates
    const result = await mongoose.connection.collection('whatsapptemplates').updateMany(
      { status: { $in: ['APPROVED', 'PENDING'] } },
      { $set: { isActive: true } }
    );
    console.log(`Reactivated ${result.modifiedCount} templates.`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

fixTemplates();
