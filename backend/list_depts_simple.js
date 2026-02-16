const mongoose = require("mongoose");
require("dotenv").config();

const CompanySchema = new mongoose.Schema(
  {
    companyId: String,
    name: String,
  },
  { strict: false },
);
const Company = mongoose.model("Company", CompanySchema, "companies");

const DeptSchema = new mongoose.Schema(
  {
    companyId: mongoose.Schema.Types.ObjectId,
    name: String,
    isActive: Boolean,
  },
  { strict: false },
);
const Department = mongoose.model("Department", DeptSchema, "departments");

const fs = require("fs");
async function run() {
  let output = "";
  const log = (msg) => {
    output += msg + "\n";
    console.log(msg);
  };
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    log("Connected");

    const jharsugudas = await Company.find({ name: /Jharsuguda/i });
    log(`Found ${jharsugudas.length} Jharsuguda companies:`);
    for (const c of jharsugudas) {
      const depts = await Department.find({ companyId: c._id });
      log(
        `- Name: ${c.name}, _id: ${c._id}, companyId: ${c.companyId}, DeptCount: ${depts.length}`,
      );
    }

    const allDepts = await Department.countDocuments({});
    log(`Total departments in DB: ${allDepts}`);

    fs.writeFileSync("results.txt", output);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync("results.txt", e.stack);
    process.exit(1);
  }
}
run();
