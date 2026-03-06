
const mongoose = require('mongoose');

async function listAllData() {
  try {
    const clusterUri = "mongodb+srv://agadge797_db_user:Amg797gmail@cluster0.5sim50l.mongodb.net/";
    await mongoose.connect(clusterUri);
    console.log('Connected to Cluster');

    const admin = mongoose.connection.db.admin();
    const dbs = await admin.listDatabases();
    
    for (const dbInfo of dbs.databases) {
      console.log(`Database: ${dbInfo.name}`);
      const db = mongoose.connection.useDb(dbInfo.name);
      const collections = await db.db.listCollections().toArray();
      console.log(` - Collections: ${collections.map(c => c.name).join(', ')}`);
      
      for (const coll of collections) {
         const count = await db.db.collection(coll.name).countDocuments();
         if (count > 0) {
            console.log(`   * ${coll.name}: ${count} docs`);
            if (coll.name === 'companies') {
               const sample = await db.db.collection(coll.name).findOne({});
               console.log(`     Sample Company: ${sample.name} (${sample._id})`);
            }
         }
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

listAllData();
