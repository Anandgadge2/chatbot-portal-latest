import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User';
import { UserRole } from '../config/constants';
import { connectDatabase, closeDatabase } from '../config/database';
import { logger } from '../config/logger';

// Load environment variables
dotenv.config();

const seedSuperAdmin = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Configuration - allow override from env
    const email = process.env.SUPERADMIN_EMAIL || 'superadmin@platform.com';
    const password = process.env.SUPERADMIN_PASSWORD || '111111';
    const phone = process.env.SUPERADMIN_PHONE || '0000000000';

    // 1. Check if SuperAdmin role already exists
    const adminByRole = await User.findOne({ role: UserRole.SUPER_ADMIN });
    
    // 2. Also check if a user with this email/phone exists (even if not SuperAdmin)
    const adminByEmail = await User.findOne({ 
      $or: [{ email }, { phone }] 
    });

    if (adminByRole || adminByEmail) {
      const existing = adminByRole || adminByEmail;
      logger.info('✅ SuperAdmin or user with credentials already exists:');
      logger.info(`Email: ${existing?.email}`);
      logger.info(`Name: ${existing?.getFullName()}`);
      logger.info(`Role: ${existing?.role}`);
      
      if (existing?.role !== UserRole.SUPER_ADMIN) {
        logger.warn(`⚠️ Warning: User exists but is NOT a SuperAdmin. Check credentials.`);
      }
      return;
    }

    // Create SuperAdmin user
    const superAdmin = await User.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: email,
      phone: phone,
      password: password, 
      role: UserRole.SUPER_ADMIN,
      isActive: true
    });

    logger.info('✅ SuperAdmin created successfully!');
    logger.info('='.repeat(50));
    logger.info(`User ID: ${superAdmin.userId}`);
    logger.info(`Email: ${superAdmin.email}`);
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