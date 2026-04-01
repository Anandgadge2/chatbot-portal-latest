import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User';
import { connectDatabase, closeDatabase } from '../config/database';
import { logger } from '../config/logger';
import { normalizePhoneNumber } from '../utils/phoneUtils';

// Load environment variables
dotenv.config();

const seedSuperAdmin = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Specific credentials as requested by user
    const rawPhone = '0000000000';
    const password = '111111';
    const email = 'superadmin@platform.com'; 

    // IMPORTANT: Normalize phone number (adds 91 prefix) to match login logic
    const phone = normalizePhoneNumber(rawPhone);

    logger.info(`Checking for SuperAdmin with phone: ${phone} (raw: ${rawPhone})`);

    // 1. Get the SuperAdmin role ID for proper mapping
    const Role = (await import('../models/Role')).default;
    const saRole = await Role.findOne({ key: 'SUPER_ADMIN', isSystem: true, companyId: null });
    const saRoleId = saRole ? saRole._id : null;

    if (!saRoleId) {
      logger.warn('⚠️ Warning: System SUPER_ADMIN role object not found in database. User will rely only on isSuperAdmin flag.');
    }

    // 2. Check if a user with this phone exists
    const existingUser = await User.findOne({ phone });

    if (existingUser) {
      if (existingUser.isSuperAdmin) {
        logger.info('✅ SuperAdmin with these credentials already exists.');
        
        // Ensure customRoleId is also set for existing superadmins
        if (!existingUser.customRoleId && saRoleId) {
          existingUser.customRoleId = saRoleId as any;
          await existingUser.save();
          logger.info('Updated existing SuperAdmin with proper customRoleId.');
        }

        logger.info(`User ID: ${existingUser.userId}`);
        return;
      } else {
        logger.warn(`⚠️ Warning: A user with phone ${phone} exists but is not a SuperAdmin.`);
        logger.info('Promoting existing user to SuperAdmin...');
        
        existingUser.isSuperAdmin = true;
        existingUser.customRoleId = saRoleId as any;
        existingUser.password = password; // This will be hashed by the pre-save hook
        await existingUser.save();
        
        logger.info('✅ User promoted to SuperAdmin successfully.');
        return;
      }
    }

    // Create New SuperAdmin user
    const superAdmin = await User.create({
      firstName: 'Platform',
      lastName: 'SuperAdmin',
      email: email,
      phone: phone,
      password: password, 
      isSuperAdmin: true,
      customRoleId: saRoleId,
      isActive: true
    });

    logger.info('✅ SuperAdmin created successfully!');
    logger.info('='.repeat(50));
    logger.info(`User ID: ${superAdmin.userId}`);
    logger.info(`Phone: ${superAdmin.phone}`);
    logger.info(`Password: ${password}`);
    logger.info(`Name: ${superAdmin.getFullName()}`);
    logger.info(`Is SuperAdmin: ${superAdmin.isSuperAdmin}`);
    logger.info('='.repeat(50));
    logger.info('⚠️ IMPORTANT: Change the password after first login!');

  } catch (error) {
    logger.error('❌ Failed to seed SuperAdmin:', error);
    process.exit(1);
  } finally {
    // Ensure connection is closed
    await closeDatabase();
    process.exit(0);
  }
};

// Run the seed function
if (require.main === module) {
  seedSuperAdmin();
}

export default seedSuperAdmin;
