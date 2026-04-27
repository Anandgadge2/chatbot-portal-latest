import mongoose from 'mongoose';
import { logger } from './logger';

let connectionPromise: Promise<void> | null = null;

export const connectDatabase = async (retryCount = 1): Promise<void> => {
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
      serverSelectionTimeoutMS: 15000, // Increased for more reliability during cold starts
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000, // Increased to allow more time for handshake
      autoIndex: true,
      family: 4 // Force IPv4 to prevent resolution issues
    };

    logger.info(`🔌 Connecting to MongoDB (v${mongoose.version})...`);
    
    // Set global buffer timeout shorter for serverless
    mongoose.set('bufferTimeoutMS', 10000);

    connectionPromise = mongoose.connect(mongoUri, options).then(() => {
      logger.info('✅ MongoDB connected successfully');
      connectionPromise = null;
    });

    await connectionPromise;

  } catch (error: any) {
    connectionPromise = null;
    
    if (retryCount > 0) {
      logger.warn(`⚠️ MongoDB connection attempt failed. Retrying in 2 seconds... (${retryCount} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return connectDatabase(retryCount - 1);
    }

    logger.error('❌ Failed to connect to MongoDB:', error.message);
    
    if (error.reason) {
      logger.error('🔍 Server Selection Reason:', JSON.stringify(error.reason, null, 2));
    }

    if (error.message.includes('IP') || error.message.includes('whitelist') || error.message.includes('selection')) {
      logger.error('💡 Connection Issue: If this persists, verify your MongoDB Atlas IP Whitelist (0.0.0.0/0 recommended for dynamic IPs).');
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
