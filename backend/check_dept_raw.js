const mongoose = require("mongoose");
require("dotenv").config();

const DeptSchema = new mongoose.Schema({}, { strict: false });
const Department = mongoose.model("Department", DeptSchema, "departments");

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const depts = await Department.find({ name: /Zilla/i }).limit(1);
  if (depts.length > 0) {
    console.log(JSON.stringify(depts[0], null, 2));
  } else {
    const any = await Department.findOne({});
    console.log("Any department sample:");
    console.log(JSON.stringify(any, null, 2));
  }
  process.exit(0);
}
check();
