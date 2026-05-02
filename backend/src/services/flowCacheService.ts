import { getRedisClient, isRedisConnected } from '../config/redis';
import { IChatbotFlow } from '../models/ChatbotFlow';
import { logger } from '../config/logger';

const FLOW_CACHE_TTL = 10 * 60; // 10 minutes in seconds

export class FlowCacheService {
  /**
   * Get a flow from Redis cache
   */
  static async getCachedFlow(companyId: string, trigger: string): Promise<IChatbotFlow | null> {
    const redis = getRedisClient();
    if (!redis || !isRedisConnected()) return null;

    try {
      const cacheKey = `flow_cache:${companyId}:${trigger.toLowerCase().trim()}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        // logger.info(`🚀 Flow cache hit for ${companyId}:${trigger}`);
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.error('❌ Error reading flow from Redis cache:', error);
    }
    return null;
  }

  /**
   * Set a flow in Redis cache
   */
  static async cacheFlow(companyId: string, trigger: string, flow: IChatbotFlow): Promise<void> {
    const redis = getRedisClient();
    if (!redis || !isRedisConnected() || !flow) return;

    try {
      const cacheKey = `flow_cache:${companyId}:${trigger.toLowerCase().trim()}`;
      await redis.setex(cacheKey, FLOW_CACHE_TTL, JSON.stringify(flow));
      // logger.info(`💾 Cached flow for ${companyId}:${trigger}`);
    } catch (error) {
      logger.error('❌ Error saving flow to Redis cache:', error);
    }
  }

  /**
   * Invalidate flow cache for a company
   * Useful when a flow is updated via dashboard
   */
  static async invalidateCompanyCache(companyId: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis || !isRedisConnected()) return;

    try {
      const pattern = `flow_cache:${companyId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`🧹 Invalidated ${keys.length} cached flows for company ${companyId}`);
      }
    } catch (error) {
      logger.error('❌ Error invalidating flow cache:', error);
    }
  }
}
