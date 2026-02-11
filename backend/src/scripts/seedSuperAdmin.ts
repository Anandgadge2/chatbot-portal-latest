import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User';
import { UserRole } from '../config/constants';
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

    // 1. Check if a user with this phone exists
    const existingUser = await User.findOne({ phone });

    if (existingUser) {
      if (existingUser.role === UserRole.SUPER_ADMIN) {
        logger.info('✅ SuperAdmin with these credentials already exists.');
        
        // Optional: Update password if needed, but usually seeding shouldn't override existing data unless requested
        // For now, we'll just report it exists
        logger.info(`User ID: ${existingUser.userId}`);
        return;
      } else {
        logger.warn(`⚠️ Warning: A user with phone ${phone} exists but has role: ${existingUser.role}`);
        logger.info('Promoting existing user to SuperAdmin...');
        
        existingUser.role = UserRole.SUPER_ADMIN;
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
      role: UserRole.SUPER_ADMIN,
      isActive: true
    });

    logger.info('✅ SuperAdmin created successfully!');
    logger.info('='.repeat(50));
    logger.info(`User ID: ${superAdmin.userId}`);
    logger.info(`Phone: ${superAdmin.phone}`);
    logger.info(`Password: ${password}`);
    logger.info(`Name: ${superAdmin.getFullName()}`);
    logger.info(`Role: ${superAdmin.role}`);
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
