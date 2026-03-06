
const mongoose = require('mongoose');

async function listTestCompanies() {
  try {
    const clusterUri = "mongodb+srv://agadge797_db_user:Amg797gmail@cluster0.5sim50l.mongodb.net/test";
    await mongoose.connect(clusterUri);
    console.log('Connected to test DB');

    const companies = await mongoose.connection.db.collection('companies').find({}).toArray();
    console.log('Test DB Companies:', companies.length);
    companies.forEach(c => console.log(` - ${c.name} (ID: ${c._id})`));

    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log('Test DB Users:', users.length);
    users.forEach(u => console.log(` - ${u.firstName} (Phone: ${u.phone}, Role: ${u.role}, Company: ${u.companyId})`));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

listTestCompanies();
