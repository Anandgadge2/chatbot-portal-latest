import { getRedisClient, isRedisConnected } from '../config/redis';
import WhatsAppSession from '../models/WhatsAppSession';
import Company from '../models/Company';
import mongoose from 'mongoose';

export interface UserSession {
  companyId: string;
  phoneNumber: string;
  language: 'en' | 'hi' | 'mr' | 'or';
  step: string;
  data: Record<string, any>;
  pendingAction?: string;
  lastActivity: Date;
  hasConsent?: boolean;
}

const SESSION_TTL = 60 * 60; // 60 minutes in seconds
const LOCK_TTL = 10; // Reduced from 30s to 10s for faster recovery
const LOCK_RETRIES = 5; // Allow more retries
const FALLBACK_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds for in-memory fallback

// In-memory fallback if Redis is not available
const memorySessions: Map<string, { session: UserSession; expiresAt: number }> = new Map();

/**
 * Get session key for Redis/MongoDB
 */
function getSessionKey(phoneNumber: string, companyId: string): string {
  return `session:${phoneNumber}:${companyId}`;
}

/**
 * Get lock key for Redis
 */
function getLockKey(phoneNumber: string, companyId: string): string {
  return `lock:${phoneNumber}:${companyId}`;
}

/**
 * Distributed Lock System for Session Management
 * Prevents race conditions during concurrent user messages
 */

// Track current lock value to ensure we only release what we own
const activeLockValues: Map<string, string> = new Map();

/**
 * Acquire a distributed lock for session operations
 */
async function acquireLock(phoneNumber: string, companyId: string, attempts = LOCK_RETRIES): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis || !isRedisConnected()) {
    return true; // No lock if Redis unavailable
  }

  const lockKey = getLockKey(phoneNumber, companyId);
  const lockValue = `${Date.now()}-${Math.random()}`;
  
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await redis.set(lockKey, lockValue, 'EX', LOCK_TTL, 'NX');
      if (result === 'OK') {
        activeLockValues.set(lockKey, lockValue);
        return true;
      }
      
      // Exponential backoff: wait 100ms, 200ms, 300ms...
      if (i < attempts - 1) {
        // console.log(`⏳ Lock contested for ${phoneNumber}, retrying ${i+1}/${attempts}...`);
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 100));
      }
    } catch (error) {
      console.error('❌ Error acquiring lock:', error);
      return false;
    }
  }

  return false;
}

/**
 * Release a distributed lock
 */
async function releaseLock(phoneNumber: string, companyId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !isRedisConnected()) {
    return;
  }

  const lockKey = getLockKey(phoneNumber, companyId);
  const lockValue = activeLockValues.get(lockKey);

  try {
    // Only release if we match the value (standard Redis Distributed Lock pattern)
    // Avoids releasing someone else's lock if ours expired
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    if (lockValue) {
      await redis.eval(script, 1, lockKey, lockValue);
      activeLockValues.delete(lockKey);
    } else {
      await redis.del(lockKey); // Fallback for simple release
    }
  } catch (error) {
    console.error('❌ Error releasing lock:', error);
  }
}

/**
 * Convert companyId string (e.g., "CMP000001") to MongoDB ObjectId
 * by looking up the Company document
 */
async function getCompanyObjectId(companyId: string): Promise<mongoose.Types.ObjectId | null> {
  try {
    // First check if it's already a valid ObjectId (24 hex chars)
    if (mongoose.Types.ObjectId.isValid(companyId) && companyId.length === 24) {
      return new mongoose.Types.ObjectId(companyId);
    }
    
    // Otherwise, look up by companyId string field
    const company = await Company.findOne({ companyId });
    if (company) {
      return company._id as mongoose.Types.ObjectId;
    }
    
    // If not found, try as _id directly (in case it's already an ObjectId string)
    if (mongoose.Types.ObjectId.isValid(companyId)) {
      return new mongoose.Types.ObjectId(companyId);
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error converting companyId to ObjectId:', error);
    return null;
  }
}

/**
 * Get session from MongoDB only (for recovery when Redis returns empty/stale)
 */
export async function getSessionFromMongo(phoneNumber: string, companyId: string): Promise<UserSession | null> {
  try {
    const companyObjectId = await getCompanyObjectId(companyId);
    if (!companyObjectId) return null;
    const dbSession = await WhatsAppSession.findOne({
      phoneNumber,
      companyId: companyObjectId,
      isActive: true,
      expiresAt: { $gt: new Date() }
    });
    if (!dbSession) return null;
    const company = await Company.findById(companyObjectId);
    return {
      companyId: company?.companyId || companyId,
      phoneNumber: dbSession.phoneNumber,
      language: (dbSession.language as 'en' | 'hi' | 'mr') || 'en',
      step: dbSession.currentStep || 'start',
      data: dbSession.sessionData && typeof dbSession.sessionData === 'object' ? dbSession.sessionData : {},
      lastActivity: dbSession.lastMessageAt,
      hasConsent: dbSession.hasConsent
    };
  } catch (error) {
    console.error('❌ Error reading session from MongoDB (recovery):', error);
    return null;
  }
}

/**
 * Get or create session with locking
 */
export async function getSession(phoneNumber: string, companyId: string): Promise<UserSession> {
  const redis = getRedisClient();
  const sessionKey = getSessionKey(phoneNumber, companyId);

  // Try Redis first
  if (redis && isRedisConnected()) {
    try {
      const sessionData = await redis.get(sessionKey);
      if (sessionData) {
        const session: UserSession = JSON.parse(sessionData);
        session.lastActivity = new Date(session.lastActivity);
        // Ensure data is an object (Redis may have stored null/undefined)
        if (session.data == null || typeof session.data !== 'object') {
          session.data = {};
        }
        return session;
      }
    } catch (error) {
      console.error('❌ Error reading session from Redis:', error);
    }
  }

  // Try MongoDB as fallback
  try {
    const companyObjectId = await getCompanyObjectId(companyId);
    if (companyObjectId) {
      const dbSession = await WhatsAppSession.findOne({
        phoneNumber,
        companyId: companyObjectId,
        isActive: true,
        expiresAt: { $gt: new Date() }
      });

      if (dbSession) {
        // Get the companyId string back from the Company document
        const company = await Company.findById(companyObjectId);
        const sessionData = dbSession.sessionData;
        const session: UserSession = {
          companyId: company?.companyId || companyId,
          phoneNumber: dbSession.phoneNumber,
          language: (dbSession.language as 'en' | 'hi' | 'mr') || 'en',
          step: dbSession.currentStep || 'start',
          data: sessionData && typeof sessionData === 'object' ? sessionData : {},
          lastActivity: dbSession.lastMessageAt,
          hasConsent: dbSession.hasConsent
        };

        // Sync to Redis if available
        if (redis && isRedisConnected()) {
          try {
            await redis.setex(sessionKey, SESSION_TTL, JSON.stringify(session));
          } catch (error) {
            console.error('❌ Error syncing session to Redis:', error);
          }
        }

        return session;
      }
    }
  } catch (error) {
    console.error('❌ Error reading session from MongoDB:', error);
  }

  // Check in-memory fallback
  const memoryKey = sessionKey;
  const memoryEntry = memorySessions.get(memoryKey);
  if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
    return memoryEntry.session;
  }

  // Create new session
  const newSession: UserSession = {
    companyId,
    phoneNumber,
    language: 'en',
    step: 'start',
    data: {},
    lastActivity: new Date(),
    hasConsent: null
  };

  // Save to Redis
  if (redis && isRedisConnected()) {
    try {
      await redis.setex(sessionKey, SESSION_TTL, JSON.stringify(newSession));
    } catch (error) {
      console.error('❌ Error saving session to Redis:', error);
    }
  }

  // Save to MongoDB
  try {
    const companyObjectId = await getCompanyObjectId(companyId);
    if (companyObjectId) {
      await WhatsAppSession.findOneAndUpdate(
        { phoneNumber, companyId: companyObjectId },
        {
          phoneNumber,
          companyId: companyObjectId,
          currentStep: 'start',
          sessionData: {},
          language: 'en',
          isActive: true,
          hasConsent: null,
          lastMessageAt: new Date(),
          expiresAt: new Date(Date.now() + SESSION_TTL * 1000)
        },
        { upsert: true, new: true }
      );
    } else {
      console.warn(`⚠️ Could not find Company with companyId: ${companyId}, skipping MongoDB save`);
    }
  } catch (error) {
    console.error('❌ Error saving session to MongoDB:', error);
  }

  // Save to memory fallback
  memorySessions.set(memoryKey, {
    session: newSession,
    expiresAt: Date.now() + FALLBACK_TTL
  });

  return newSession;
}

/**
 * Update session with locking
 */
export async function updateSession(session: UserSession): Promise<void> {
  // Built-in retries in acquireLock
  const lockAcquired = await acquireLock(session.phoneNumber, session.companyId);
  if (!lockAcquired) {
    console.warn(`⚠️ Could not acquire lock for session update (${session.phoneNumber}), proceeding with caution`);
  }

  try {
    session.lastActivity = new Date();
    const sessionKey = getSessionKey(session.phoneNumber, session.companyId);
    const redis = getRedisClient();

    // Update Redis
    if (redis && isRedisConnected()) {
      try {
        await redis.setex(sessionKey, SESSION_TTL, JSON.stringify(session));
      } catch (error) {
        console.error('❌ Error updating session in Redis:', error);
      }
    }

    // Update MongoDB
    try {
      const companyObjectId = await getCompanyObjectId(session.companyId);
      if (companyObjectId) {
        await WhatsAppSession.findOneAndUpdate(
          { phoneNumber: session.phoneNumber, companyId: companyObjectId },
          {
            currentStep: session.step,
            sessionData: session.data,
            language: session.language,
            lastMessageAt: session.lastActivity,
            expiresAt: new Date(Date.now() + SESSION_TTL * 1000),
            isActive: true,
            hasConsent: session.hasConsent
          },
          { upsert: true, new: true }
        );
      } else {
        console.warn(`⚠️ Could not find Company with companyId: ${session.companyId}, skipping MongoDB update`);
      }
    } catch (error) {
      console.error('❌ Error updating session in MongoDB:', error);
    }

    // Update memory fallback
    const memoryKey = sessionKey;
    memorySessions.set(memoryKey, {
      session,
      expiresAt: Date.now() + FALLBACK_TTL
    });
  } finally {
    await releaseLock(session.phoneNumber, session.companyId);
  }
}

/**
 * Clear session
 */
export async function clearSession(phoneNumber: string, companyId: string): Promise<void> {
  const lockAcquired = await acquireLock(phoneNumber, companyId);
  if (!lockAcquired) {
    console.warn(`⚠️ Could not acquire lock for session clear (${phoneNumber})`);
    // Note: We proceed anyway if it's a clear operation, as it's destructive
  }

  try {
    const sessionKey = getSessionKey(phoneNumber, companyId);
    const redis = getRedisClient();

    // Delete from Redis
    if (redis && isRedisConnected()) {
      try {
        await redis.del(sessionKey);
      } catch (error) {
        console.error('❌ Error deleting session from Redis:', error);
      }
    }

    // Delete from MongoDB
    try {
      const companyObjectId = await getCompanyObjectId(companyId);
      if (companyObjectId) {
        await WhatsAppSession.findOneAndUpdate(
          { phoneNumber, companyId: companyObjectId },
          { isActive: false }
        );
      } else {
        console.warn(`⚠️ Could not find Company with companyId: ${companyId}, skipping MongoDB delete`);
      }
    } catch (error) {
      console.error('❌ Error deleting session from MongoDB:', error);
    }

    // Delete from memory
    memorySessions.delete(sessionKey);
  } finally {
    await releaseLock(phoneNumber, companyId);
  }
}

/**
 * Clean up expired in-memory sessions periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memorySessions.entries()) {
    if (entry.expiresAt <= now) {
      memorySessions.delete(key);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes
