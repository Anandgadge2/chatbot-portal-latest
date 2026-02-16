const mongoose = require("mongoose");
const fs = require("fs");
require("dotenv").config();

const Company = mongoose.model(
  "Company",
  new mongoose.Schema({ name: String, companyId: String }, { strict: false }),
  "companies",
);
const Department = mongoose.model(
  "Department",
  new mongoose.Schema(
    { companyId: mongoose.Schema.Types.ObjectId, name: String },
    { strict: false },
  ),
  "departments",
);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const comps = await Company.find({});
    let output = "COMPANIES AND DEPARTMENTS:\n";
    for (const c of comps) {
      const count = await Department.countDocuments({ companyId: c._id });
      output += `ID: ${c._id} | CID: ${c.companyId} | Name: ${c.name} | Depts: ${count}\n`;
    }
    fs.writeFileSync("output_debug.txt", output);
    console.log("Done");
    process.exit(0);
  } catch (e) {
    fs.writeFileSync("output_debug.txt", e.stack);
    process.exit(1);
  }
}
run();
