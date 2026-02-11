const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function checkConfig() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const companyId = "6989db83453881ef7ba5c778";

    const config = await mongoose.connection.db
      .collection("companyemailconfigs")
      .findOne({
        companyId: new mongoose.Types.ObjectId(companyId),
      });

    console.log("Email Config:", JSON.stringify(config, null, 2));

    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
  }
}

checkConfig();
