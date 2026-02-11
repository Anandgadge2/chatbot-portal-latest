import mongoose from 'mongoose';
import { logger } from './logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      const error = new Error('MONGODB_URI is not defined in environment variables');
      logger.error('❌ ' + error.message);
      logger.error('💡 Please create a .env file in the backend directory with:');
      logger.error('   MONGODB_URI=mongodb://localhost:27017/dashboard');
      logger.error('   or');
      logger.error('   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database');
      throw error;
    }

    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      return;
    }

    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      family: 4,
    };

    await mongoose.connect(mongoUri, options);



  } catch (error: any) {
    logger.error('❌ Failed to connect to MongoDB:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('MONGODB_URI')) {
      // Already handled above
    } else if (error.message.includes('ETIMEOUT') || error.message.includes('querySrv')) {
      logger.error('💡 Network/DNS timeout. Check:');
      logger.error('   1. Internet connection');
      logger.error('   2. VPN/Firewall settings');
      logger.error('   3. MongoDB Atlas cluster status');
    } else if (error.message.includes('IP') || error.message.includes('whitelist')) {
      logger.error('💡 IP Whitelist issue. Fix:');
      logger.error('   1. Go to MongoDB Atlas → Network Access');
      logger.error('   2. Add IP: 0.0.0.0/0 (allow all)');
    } else if (error.message.includes('authentication failed')) {
      logger.error('💡 Authentication failed. Check:');
      logger.error('   1. Username and password in MONGODB_URI');
      logger.error('   2. Database user exists in MongoDB Atlas');
    }
    
    throw error;
  }
};

/**
 * Check if database is connected
 */
export const isDatabaseConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};

// Export closeDatabase for graceful shutdown
export const closeDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('✅ MongoDB connection closed gracefully');
  } catch (error) {
    logger.error('❌ Error closing MongoDB:', error);
  }
};
