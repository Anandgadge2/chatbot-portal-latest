import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

import { connectDatabase } from '../config/database';

/**
 * Middleware to check and ensure database is connected before processing requests
 * This is especially important for serverless environments like Vercel
 */
export const requireDatabaseConnection = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // If connected, proceed
    if ((mongoose.connection.readyState as any) === 1) {
      return next();
    }

    // If connecting (readyState 2), wait a bit for it to finish
    if ((mongoose.connection.readyState as any) === 2) {
      let attempts = 0;
      while ((mongoose.connection.readyState as any) === 2 && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      if ((mongoose.connection.readyState as any) === 1) {
        return next();
      }
    }

    // If disconnected (0) or still not connected, try to connect
    await connectDatabase();
    
    if ((mongoose.connection.readyState as any) === 1) {
      next();
    } else {
      throw new Error(`Database connection failed (readyState: ${mongoose.connection.readyState})`);
    }
  } catch (error: any) {
    res.status(503).json({
      success: false,
      message: 'Database connection not available. Please try again in a few moments.',
      error: error.message,
      connectionState: mongoose.connection.readyState
    });
  }
};

/**
 * Check database connection status
 */
export const isDatabaseConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};

/**
 * Get database connection status info
 */
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
