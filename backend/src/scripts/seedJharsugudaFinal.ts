
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import path from 'path';
import dotenv from 'dotenv';
import User from '../models/User';
import Department from '../models/Department';
import Company from '../models/Company';
import { UserRole, CompanyType, Module } from '../config/constants';

dotenv.config();

const EXCEL_FILE_PATH = path.join(__dirname, '../../../jharsygda departments.xlsx');
// TARGET_COMPANY_ID for Collectorate Jharsuguda obtained from previous script
const TARGET_COMPANY_ID = '6989db83453881ef7ba5c778'; 
const DEFAULT_PASSWORD = 'Password@123';

async function seedData() {
  try {
    console.log('🚀 Starting Final Seed Process for Jharsuguda...');
    
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Verify Company - make it robust
    let company = await Company.findById(TARGET_COMPANY_ID);
    
    if (!company) {
      console.log(`⚠️ Company with ID ${TARGET_COMPANY_ID} not found, searching by name...`);
      company = await Company.findOne({ name: /Jharsuguda/i });
    }

    if (!company) {
      console.log('🆕 Creating Collectorate Jharsuguda company...');
      company = await Company.create({
          name: 'Collectorate Jharsuguda',
          companyType: CompanyType.GOVERNMENT,
          enabledModules: [
            Module.GRIEVANCE, 
            Module.APPOINTMENT, 
            Module.STATUS_TRACKING
            // Note: MULTI_LANGUAGE is always enabled by default
          ],
          isActive: true,
          theme: {
            primaryColor: '#0f4c81',
            secondaryColor: '#1a73e8'
          }
      });
      console.log(`✅ Created Company with ID: ${company._id}`);
    } else {
      console.log(`🏢 Target Company: ${company.name} (${company._id})`);
    }

    // Read Excel
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(sheet);

    console.log(`📊 Found ${data.length} records in Excel`);

    for (const row of data) {
      // Flexible column name matching
      const deptName = (row['Department'] || row['Department Name'] || row['DEPT'] || row['DEPT_NAME'])?.toString().trim();
      const officerName = (row['Name'] || row['Officer Name'] || row['User Name'] || row['FULL NAME'])?.toString().trim();
      const phone = (row['Phone'] || row['WhatsApp Number'] || row['Mobile'] || row['Official Phone Number'] || row['Phone Number'])?.toString().trim();
      const email = (row['Email'] || row['Email Id'] || row['Email ID'] || row['EMAIL'])?.toString().trim().toLowerCase();
      
      if (!deptName || !officerName || !phone) {
        console.log(`⚠️ Skipping incomplete row (missing Dept, Name or Phone): ${JSON.stringify(row)}`);
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

      // 2. Role logic - User said "map the department admin properly"
      // We will assume the first person in each department is the Admin, or if there's only one.
      // Alternatively, we look for a 'Role' or 'Designation' column.
      const designation = (row['Designation'] || row['Role'])?.toString().trim().toLowerCase() || '';
      
      let role = UserRole.OPERATOR;
      if (designation.includes('collector') && !designation.includes('sub')) {
        role = UserRole.COMPANY_ADMIN;
      } else if (designation.includes('admin') || designation.includes('head') || designation.includes('officer-in-charge')) {
        role = UserRole.DEPARTMENT_ADMIN;
      } else {
          // If no designation, and it's the first time we see this dept, we could make them admin?
          // For now, let's stick to OPERATOR unless designation says otherwise, 
          // but if the user said "map department admin properly", maybe there's an 'Admin' label.
          if (row['Role']?.toString().toLowerCase() === 'admin') {
              role = UserRole.DEPARTMENT_ADMIN;
          }
      }

      // 3. Prepare User Data
      const nameParts = officerName.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '.';

      // 4. Check if User Exists
      const existingUser = await User.findOne({
        $or: [
          { phone, companyId: company._id },
          ...(email ? [{ email, companyId: company._id }] : [])
        ]
      });

      if (existingUser) {
        console.log(`⏭️ User already exists: ${officerName} (${phone})`);
        
        // Update department if it's different
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
        console.log(`👤 Seeded User: ${officerName} [${role}] in ${deptName}`);
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
    process.exit(0);
  }
}

seedData();
