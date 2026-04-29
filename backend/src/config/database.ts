import mongoose from 'mongoose';
import { logger } from './logger';
import { installDatabaseSafetyGuards } from '../utils/databaseSafety';

const MAX_CONNECTION_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const CONNECTION_OPTIONS = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 15000,
  autoIndex: process.env.NODE_ENV !== 'production',
  family: 4
} as const;

let connectionPromise: Promise<void> | null = null;
let connectionListenersAttached = false;

const attachConnectionListeners = (): void => {
  if (connectionListenersAttached) {
    return;
  }

  connectionListenersAttached = true;

  mongoose.connection.on('connected', () => {
    logger.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  });

  mongoose.connection.on('error', (error) => {
    logger.error(`MongoDB connection error: ${error.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const connectDatabase = async (attempt = 1): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    const error = new Error('MONGODB_URI is not defined');
    logger.error(error.message);
    throw error;
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (mongoose.connection.readyState === 2 && connectionPromise) {
    logger.info('MongoDB connection already in progress, waiting for existing attempt');
    return connectionPromise;
  }

  attachConnectionListeners();
  mongoose.set('bufferTimeoutMS', 10000);

  logger.info(`Connecting to MongoDB (attempt ${attempt}/${MAX_CONNECTION_RETRIES})`);

  connectionPromise = mongoose.connect(mongoUri, CONNECTION_OPTIONS)
    .then(() => {
      installDatabaseSafetyGuards(mongoose.connection);
      logger.info('MongoDB connection established successfully');
      connectionPromise = null;
    })
    .catch((error: any) => {
      connectionPromise = null;
      logger.error(`MongoDB connection attempt ${attempt} failed: ${error.message}`);
      throw error;
    });

  try {
    await connectionPromise;
  } catch (error: any) {
    if (attempt < MAX_CONNECTION_RETRIES) {
      logger.warn(`Retrying MongoDB connection in ${RETRY_DELAY_MS}ms`);
      await delay(RETRY_DELAY_MS);
      return connectDatabase(attempt + 1);
    }

    logger.error('MongoDB connection failed after maximum retry attempts');

    if (error.reason) {
      logger.error(`MongoDB server selection reason: ${JSON.stringify(error.reason)}`);
    }

    throw error;
  }
};

export const isDatabaseConnected = (): boolean => mongoose.connection.readyState === 1;

export const getDatabaseStatus = () => {
  const stateMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized'
  };

  return {
    connected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    state: stateMap[mongoose.connection.readyState] || 'unknown',
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name
  };
};

export const closeDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed gracefully');
  } catch (error: any) {
    logger.error(`Error closing MongoDB connection: ${error.message}`);
  }
};
