const fs = require('fs');
const path = require('path');

const filePath = 'd:/Multitenant_chatbot/chatbot_portal-chatbot_flow_features/backend/src/routes/status.routes.ts';
if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

const target = "const uploadedFiles = (req.files as Express.Multer.File[]) || [];";
const logLine = "console.log('[STATUS_LOG] Grievance:', req.params.id, 'Files:', uploadedFiles.length);";

if (content.includes(logLine)) {
    // Remove the debug log line
    content = content.replace('\n    ' + logLine, '');
    fs.writeFileSync(filePath, content);
    console.log('✅ Successfully removed debug logs from status.routes.ts');
} else {
    console.log('ℹ️ No debug logs found to remove.');
}
