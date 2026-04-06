import { MongoClient, ObjectId } from 'mongodb';

const uri = "mongodb+srv://agadge797_db_user:Amg797gmail@cluster0.5sim50l.mongodb.net/";
const client = new MongoClient(uri);

async function cleanup() {
  try {
    await client.connect();
    const db = client.db('test');
    const templates = db.collection('companywhatsapptemplates');

    // Counts before
    const countBefore = await templates.countDocuments();
    console.log(`📊 Initial template count: ${countBefore}`);

    // Active client IDs (Jharsuguda and DFO)
    const activeCompanyIds = [
      new ObjectId('69ad4c6eb1ad8e405e6c0858'),
      new ObjectId('69c8fae944723f00f8dc2173')
    ];

    // Delete everything else
    const result = await templates.deleteMany({
      companyId: { $nin: activeCompanyIds }
    });

    console.log(`✅ Cleanup complete! Deleted: ${result.deletedCount} orphaned records.`);

    // Final count
    const countAfter = await templates.countDocuments();
    console.log(`📊 Final template count: ${countAfter}`);
  } finally {
    await client.close();
  }
}

cleanup().catch(console.error);
