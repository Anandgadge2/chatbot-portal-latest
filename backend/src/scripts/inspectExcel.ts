import * as XLSX from 'xlsx';
import * as path from 'path';

const excelFilePath = path.join(__dirname, '../../../jharsygda departments.xlsx');
const workbook = XLSX.readFile(excelFilePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log(JSON.stringify(data, null, 2));
