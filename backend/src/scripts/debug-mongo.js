
const mongoose = require('mongoose');

async function listCollections() {
  try {
    const mongoUri = "mongodb+srv://agadge797_db_user:Amg797gmail@cluster0.5sim50l.mongodb.net/chatbot_portal";
    
    await mongoose.connect(mongoUri);
    console.log('Connected to chatbot_portal');

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));

    const companies = await mongoose.connection.db.collection('companies').find({}).limit(5).toArray();
    console.log('Companies found:', companies.length);
    companies.forEach(c => console.log(` - ${c.name} (ID: ${c._id})`));

    const users = await mongoose.connection.db.collection('users').find({ phone: '919356150561' }).toArray();
    console.log('Users with 919356150561:', users.length);
    if (users.length > 0) {
      console.log('User Role:', users[0].role);
      console.log('User CompanyId:', users[0].companyId);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

listCollections();
