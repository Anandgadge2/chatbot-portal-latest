const fs = require("fs");
const file = "whatsapp_templates/collectorate_jharsuguda_flow.json";
let content = fs.readFileSync(file, "utf8");

content = content.replace(/Collectorate Jharsuguda/g, "{companyName}");
content = content.replace(/कलेक्टरेट झारसुगुडा/g, "{companyName}");
content = content.replace(/ଝାରସୁଗୁଡା କଲେକ୍ଟରେଟ୍/g, "{companyName}");
content = content.replace(/ଝାରସୁଗୁଡା କଲେକ୍ଟରେଟ/g, "{companyName}");

// Address replacements in helpdesk
content = content.replace(/jharsuguda.odisha.gov.in/g, "{websiteUrl}");
content = content.replace(
  /Collectorate, NH 10, Jharsuguda Road,\\nBijju Nagar, Jharsuguda, Odisha 768204/g,
  "{companyAddress}",
);
content = content.replace(
  /कलेक्टरेट, एनएच 10, झारसुगुडा रोड,\\nबीजू नगर, झारसुगुडा, ओडिशा 768204/g,
  "{companyAddress}",
);
content = content.replace(
  /କଲେକ୍ଟରେଟ୍, NH 10, ଝାରସୁଗୁଡା ରୋଡ୍,\\nବିଜୁ ନଗର, ଝାରସୁଗୁଡା, ଓଡିଶା 768204/g,
  "{companyAddress}",
);
content = content.replace(/1800-123-4567/g, "{helplineNumber}");

fs.writeFileSync(file, content);
console.log(
  "Successfully updated JSON templates with placeholders for multi-tenant support.",
);
