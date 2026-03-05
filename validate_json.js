try {
  const data = require("./whatsapp_templates/collectorate_jharsuguda_flow.json");
  const s = data.settings;
  console.log("✅ JSON is valid!");
  console.log("   name:", data.metadata.name);
  console.log("   version:", data.metadata.version);
  console.log("   has commands:", !!s.commands);
  console.log("   commands:", Object.keys(s.commands || {}).join(", "));
  console.log("   has fallback:", !!s.fallback);
  console.log("   fallback types:", Object.keys(s.fallback || {}).join(", "));
} catch (e) {
  console.error("❌ JSON ERROR:", e.message);
  process.exit(1);
}
