
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function listCollections() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    // Append db name if not present
    const fullUri = mongoUri.endsWith('/') ? mongoUri + 'chatbot_portal' : mongoUri + '/chatbot_portal';
    
    await mongoose.connect(fullUri);
    console.log('Connected to chatbot_portal');

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));

    const companiesCount = await mongoose.connection.db.collection('companies').countDocuments();
    console.log('Companies count:', companiesCount);

    if (companiesCount > 0) {
       const company = await mongoose.connection.db.collection('companies').findOne({});
       console.log('Sample Company:', company.name, company._id);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

listCollections();
