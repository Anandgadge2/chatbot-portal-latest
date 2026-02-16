const mongoose = require("mongoose");
require("dotenv").config();

const CompanySchema = new mongoose.Schema(
  { name: String, companyId: String },
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

const WAConfigSchema = new mongoose.Schema(
  { companyId: mongoose.Schema.Types.ObjectId, phoneNumber: String },
  { strict: false },
);
const CompanyWhatsAppConfig = mongoose.model(
  "CompanyWhatsAppConfig",
  WAConfigSchema,
  "companywhatsappconfigs",
);

const FlowSchema = new mongoose.Schema(
  { companyId: mongoose.Schema.Types.ObjectId, flowId: String },
  { strict: false },
);
const ChatbotFlow = mongoose.model("ChatbotFlow", FlowSchema, "chatbotflows");

async function unify() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected");

    const jharsugudaComps = await Company.find({ name: /Jharsuguda/i });
    console.log(`Found ${jharsugudaComps.length} Jharsuguda companies.`);

    if (jharsugudaComps.length <= 1) {
      console.log(
        "Only one or zero Jharsuguda company found. checking departments...",
      );
      if (jharsugudaComps.length === 1) {
        const count = await Department.countDocuments({
          companyId: jharsugudaComps[0]._id,
        });
        console.log(
          `Company ${jharsugudaComps[0].name} has ${count} departments.`,
        );
      }
    } else {
      // Find the one with most departments
      let bestComp = null;
      let maxDepts = -1;
      for (const c of jharsugudaComps) {
        const count = await Department.countDocuments({ companyId: c._id });
        console.log(
          `Company: ${c.name} (_id: ${c._id}, companyId: ${c.companyId}) has ${count} departments.`,
        );
        if (count > maxDepts) {
          maxDepts = count;
          bestComp = c;
        }
      }

      console.log(
        `\nBest company is ${bestComp.name} (${bestComp._id}) with ${maxDepts} departments.`,
      );

      // Point all WhatsApp configs to this company
      const waUpdate = await CompanyWhatsAppConfig.updateMany(
        { companyId: { $in: jharsugudaComps.map((c) => c._id) } },
        { $set: { companyId: bestComp._id } },
      );
      console.log(`Updated ${waUpdate.modifiedCount} WhatsApp configs.`);

      // Point all flows to this company
      const flowUpdate = await ChatbotFlow.updateMany(
        { companyId: { $in: jharsugudaComps.map((c) => c._id) } },
        { $set: { companyId: bestComp._id } },
      );
      console.log(`Updated ${flowUpdate.modifiedCount} Flows.`);

      // Move all departments to this company (just in case they were split)
      const deptUpdate = await Department.updateMany(
        { companyId: { $in: jharsugudaComps.map((c) => c._id) } },
        { $set: { companyId: bestComp._id } },
      );
      console.log(`Unified ${deptUpdate.modifiedCount} Departments.`);
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
unify();
