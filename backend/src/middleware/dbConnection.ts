import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { connectDatabase, getDatabaseStatus, isDatabaseConnected } from '../config/database';

export const requireDatabaseConnection = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (Number(mongoose.connection.readyState) === 1) {
      return next();
    }

    if (Number(mongoose.connection.readyState) === 2) {
      let attempts = 0;
      while (Number(mongoose.connection.readyState) === 2 && attempts < 10) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        attempts += 1;
      }

      if (Number(mongoose.connection.readyState) === 1) {
        return next();
      }
    }

    await connectDatabase();

    if (Number(mongoose.connection.readyState) === 1) {
      next();
      return;
    }

    throw new Error(`Database connection failed (readyState: ${mongoose.connection.readyState})`);
  } catch (error: any) {
    res.status(503).json({
      success: false,
      message: 'Database connection not available. Please try again in a few moments.',
      error: error.message,
      connectionState: mongoose.connection.readyState
    });
  }
};

export { getDatabaseStatus, isDatabaseConnected };
