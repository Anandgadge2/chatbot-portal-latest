
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import path from 'path';
import dotenv from 'dotenv';
import User from '../models/User';
import Department from '../models/Department';
import Company from '../models/Company';
import { UserRole } from '../config/constants';

dotenv.config();

const EXCEL_FILE_PATH = path.join(__dirname, '../../../for dept user mapping-3.02.2026.xlsx');
const TARGET_COMPANY_ID = '6989db83453881ef7ba5c778'; // Collectorate Jharsugda
const DEFAULT_PASSWORD = 'Password@123';

async function seedData() {
  try {
    console.log('🚀 Starting Seed Process...');
    
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Verify Company
    const company = await Company.findById(TARGET_COMPANY_ID);
    if (!company) {
      throw new Error(`Company with ID ${TARGET_COMPANY_ID} not found`);
    }
    console.log(`🏢 Target Company: ${company.name}`);

    // Read Excel
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(sheet);

    console.log(`📊 Found ${data.length} records in Excel`);

    for (const row of data) {
      const deptName = row['Department Name']?.toString().trim();
      const officerName = row['Officer Name']?.toString().trim();
      const phone = row['WhatsApp Number']?.toString().trim() || row['Official Phone Number']?.toString().trim();
      const email = row['Email']?.toString().trim().toLowerCase();
      const excelRole = row['Role (Admin/Operator/Viewer)']?.toString().trim().toLowerCase();
      const remarks = row['Remarks/Description']?.toString().trim();
      const designation = row['Designation']?.toString().trim();

      if (!deptName || !officerName || !phone) {
        console.log(`⚠️ Skipping incomplete row: ${JSON.stringify(row)}`);
        continue;
      }

      // 1. Find or Create Department
      let department = await Department.findOne({ 
        companyId: company._id, 
        name: new RegExp(`^${deptName}$`, 'i') 
      });

      if (!department) {
        department = await Department.create({
          companyId: company._id,
          name: deptName,
          isActive: true
        });
        console.log(`🆕 Created Department: ${deptName}`);
      }

      // 2. Map Role
      let role = UserRole.OPERATOR;
      if (excelRole === 'admin') role = UserRole.DEPARTMENT_ADMIN;
      else if (excelRole === 'viewer') role = UserRole.ANALYTICS_VIEWER;
      
      // Special case for Collector
      if (designation?.toLowerCase().includes('collector') && !designation?.toLowerCase().includes('sub')) {
          role = UserRole.COMPANY_ADMIN;
      }

      // 3. Prepare User Data
      const nameParts = officerName.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '.';

      // 4. Check if User Exists (by phone or email)
      const existingUser = await User.findOne({
        $or: [
          { phone, companyId: company._id },
          ...(email ? [{ email, companyId: company._id }] : [])
        ]
      });

      if (existingUser) {
        console.log(`⏭️ User already exists: ${officerName} (${phone})`);
        
        // Update department if it's different and not null
        if (existingUser.departmentId?.toString() !== department._id.toString()) {
            existingUser.departmentId = department._id as any;
            await existingUser.save();
            console.log(`📝 Updated department for ${officerName}`);
        }
        continue;
      }

      // 5. Create User
      try {
        await User.create({
          firstName,
          lastName,
          email: email || undefined,
          phone,
          password: DEFAULT_PASSWORD,
          role,
          companyId: company._id,
          departmentId: department._id,
          isActive: true
        });
        console.log(`👤 Seeded User: ${officerName} [${role}]`);
      } catch (userError: any) {
        console.error(`❌ Failed to create user ${officerName}:`, userError.message);
      }
    }

    console.log('🏁 Seed Process Completed Successfully!');
  } catch (error: any) {
    console.error('💥 Critical Error during seed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

seedData();
