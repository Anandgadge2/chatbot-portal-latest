import mongoose from 'mongoose';
import { logger } from './logger';

let connectionPromise: Promise<void> | null = null;

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      const error = new Error('MONGODB_URI is not defined');
      logger.error('❌ ' + error.message);
      throw error;
    }

    // 1. If already connected, return immediately
    if (mongoose.connection.readyState === 1) {
      return;
    }

    // 2. If connecting, wait for the existing promise
    if (mongoose.connection.readyState === 2 && connectionPromise) {
      logger.info('⏳ Database connection already in progress, waiting...');
      return connectionPromise;
    }

    // 3. Start a new connection
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 45000, 
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      autoIndex: true,
    };

    logger.info(`🔌 Connecting to MongoDB (v${mongoose.version})...`);
    
    // Set global buffer timeout longer for serverless
    mongoose.set('bufferTimeoutMS', 30000);

    connectionPromise = mongoose.connect(mongoUri, options).then(() => {
      logger.info('✅ MongoDB connected successfully');
      connectionPromise = null;
    });

    await connectionPromise;

  } catch (error: any) {
    connectionPromise = null;
    logger.error('❌ Failed to connect to MongoDB:', error.message);
    
    if (error.reason) {
      logger.error('🔍 Server Selection Reason:', error.reason);
    }

    if (error.message.includes('IP') || error.message.includes('whitelist')) {
      logger.error('💡 IP Whitelist issue. Ensure 0.0.0.0/0 is added to MongoDB Atlas.');
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
