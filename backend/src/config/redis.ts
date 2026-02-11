import Redis from 'ioredis';
import { logger } from './logger';

let redisClient: Redis | null = null;

export const connectRedis = async (): Promise<Redis | null> => {
  try {
    const host = process.env.REDIS_HOST;
    const port = parseInt(process.env.REDIS_PORT || '6379');
    const password = process.env.REDIS_PASSWORD;

    if (!host) {
      return null;
    }

    redisClient = new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: 2,
      connectTimeout: 8000, // Reduced from 10s
      retryStrategy: (times: number) => {
        if (times > 2) {
          logger.warn('⚠️  Redis connection failed after 2 retries. Continuing without Redis.');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 1000, 2000);
        logger.info(`   Retry ${times}/2 in ${delay}ms...`);
        return delay;
      },
      reconnectOnError: () => {
        return false; // Don't auto-reconnect on error
      },
      lazyConnect: true, // Don't connect immediately
      enableOfflineQueue: false, // Fail fast if not connected
    });

    // Suppress error events
    redisClient.on('error', () => {});
    redisClient.on('connect', () => {});
    redisClient.on('ready', () => {});
    redisClient.on('close', () => {});
    redisClient.on('reconnecting', () => {});

    try {
      await redisClient.connect();
      await redisClient.ping();
      return redisClient;
    } catch (connectionError: any) {
      throw connectionError;
    }

  } catch (error: any) {
    // Clean up failed connection
    if (redisClient) {
      try {
        redisClient.removeAllListeners(); // Remove all event listeners
        await redisClient.quit();
      } catch (e) {
        // Ignore cleanup errors
        try {
          redisClient.disconnect();
        } catch (e2) {
          // Final attempt to disconnect
        }
      }
      redisClient = null;
    }
    
    return null; // Return null instead of throwing
  }
};

export const getRedisClient = (): Redis | null => {
  return redisClient;
};

export const isRedisConnected = (): boolean => {
  return redisClient !== null && redisClient.status === 'ready';
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    } finally {
      redisClient = null;
    }
  }
};
