const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    const departments = db.collection("departments");
    const companies = db.collection("companies");

    const jh_comp = await companies.findOne({ name: /Jharsuguda/i });
    if (!jh_comp) {
      console.log("No Jharsuguda company");
      process.exit(0);
    }

    console.log(
      `Company: ${jh_comp.name}, _id: ${jh_comp._id} (${typeof jh_comp._id})`,
    );

    const dept = await departments.findOne({});
    if (dept) {
      console.log(
        `Dept Sample: ${dept.name}, companyId: ${dept.companyId} (${typeof dept.companyId})`,
      );

      if (typeof dept.companyId === "string") {
        console.log("Detected companyId as STRING! This is the bug.");
      }
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
run();
