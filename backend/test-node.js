const fs = require("fs");
fs.appendFileSync(
  "D:/Multitenant_chatbot/chatbot_portal-chatbot_flow_features/test.txt",
  "Hello at " + new Date() + "\n",
);
