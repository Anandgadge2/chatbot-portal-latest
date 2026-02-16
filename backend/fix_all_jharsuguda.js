const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

async function fixAll() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    console.log("Connected");
    const db = client.db();
    const companies = db.collection("companies");
    const departments = db.collection("departments");
    const waConfigs = db.collection("companywhatsappconfigs");
    const flows = db.collection("chatbotflows");

    // 1. Find all Jharsuguda companies
    const jhComps = await companies.find({ name: /Jharsuguda/i }).toArray();
    console.log(`Found ${jhComps.length} Jharsuguda companies`);

    if (jhComps.length === 0) {
      console.log("No Jharsuguda company found.");
      return;
    }

    // 2. Identify the "Main" company (the one with the most departments or the first one)
    let mainComp = jhComps[0];
    let maxDepts = -1;
    for (const c of jhComps) {
      const count = await departments.countDocuments({
        $or: [{ companyId: c._id }, { companyId: c._id.toString() }],
      });
      console.log(`Company ${c.name} (${c._id}) has ${count} departments`);
      if (count > maxDepts) {
        maxDepts = count;
        mainComp = c;
      }
    }

    console.log(`Main Company selected: ${mainComp.name} (${mainComp._id})`);

    // 3. Move EVERYTHING to this main company
    const jhIds = jhComps.map((c) => c._id);
    const jhIdStrings = jhComps.map((c) => c._id.toString());

    // Update departments (fix types and move)
    const allJhDepts = await departments
      .find({
        $or: [
          { companyId: { $in: jhIds } },
          { companyId: { $in: jhIdStrings } },
        ],
      })
      .toArray();

    console.log(
      `Moving ${allJhDepts.length} departments to ${mainComp._id}...`,
    );
    for (const d of allJhDepts) {
      await departments.updateOne(
        { _id: d._id },
        { $set: { companyId: mainComp._id, isActive: true } },
      );
    }

    // Update WhatsApp Configs
    const waUpdate = await waConfigs.updateMany(
      { companyId: { $in: [...jhIds, ...jhIdStrings] } },
      { $set: { companyId: mainComp._id } },
    );
    console.log(`Updated ${waUpdate.modifiedCount} WhatsApp configs`);

    // Update Flows
    const flowUpdate = await flows.updateMany(
      { companyId: { $in: [...jhIds, ...jhIdStrings] } },
      { $set: { companyId: mainComp._id } },
    );
    console.log(`Updated ${flowUpdate.modifiedCount} Flows`);

    console.log("✅ Fix completed successfully");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
fixAll();
