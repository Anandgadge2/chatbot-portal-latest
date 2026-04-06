import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';

const uri = "mongodb+srv://agadge797_db_user:Amg797gmail@cluster0.5sim50l.mongodb.net/";
const client = new MongoClient(uri);

async function cleanup() {
  const log = (msg) => {
    console.log(msg);
    fs.appendFileSync('cleanup.log', msg + '\n');
  };

  try {
    await client.connect();
    const db = client.db('test');
    const templates = db.collection('companywhatsapptemplates');

    const countBefore = await templates.countDocuments();
    log(`📊 Initial template count: ${countBefore}`);

    const activeCompanyIds = [
      new ObjectId('69ad4c6eb1ad8e405e6c0858'),
      new ObjectId('69c8fae944723f00f8dc2173')
    ];

    const result = await templates.deleteMany({
      companyId: { $nin: activeCompanyIds }
    });

    log(`✅ Cleanup complete! Deleted: ${result.deletedCount} orphaned records.`);

    const countAfter = await templates.countDocuments();
    log(`📊 Final template count: ${countAfter}`);
  } catch (err) {
    log(`❌ Error: ${err.message}`);
  } finally {
    await client.close();
  }
}

cleanup().catch(err => log(`❌ Fatal Error: ${err.message}`));
