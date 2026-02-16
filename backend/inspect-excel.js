const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

try {
  const excelFilePath =
    "d:/Multitenant_chatbot/chatbot_portal-chatbot_flow_features/jharsygda departments.xlsx";
  console.log("Reading:", excelFilePath);
  const workbook = XLSX.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  fs.writeFileSync("excel_dump.csv", csv);
  console.log("CSV Written");
} catch (err) {
  fs.writeFileSync("excel_error.txt", err.stack);
}
