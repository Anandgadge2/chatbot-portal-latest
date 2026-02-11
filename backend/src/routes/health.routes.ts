import express, { Request, Response } from 'express';
import { getDatabaseStatus } from '../middleware/dbConnection';
import mongoose from 'mongoose';

const router = express.Router();

// @route   GET /api/health
// @desc    Health check endpoint with database status
// @access  Public
router.get('/', (_req: Request, res: Response) => {
  const dbStatus = getDatabaseStatus();
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      connected: dbStatus.connected,
      state: dbStatus.state,
      host: dbStatus.host,
      port: dbStatus.port,
      name: dbStatus.name,
      readyState: dbStatus.readyState
    },
    mongodb: {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
      states: {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      }
    }
  });
});

// @route   GET /api/health/db
// @desc    Database connection status only
// @access  Public
router.get('/db', (_req: Request, res: Response) => {
  const dbStatus = getDatabaseStatus();
  
  if (dbStatus.connected) {
    res.json({
      success: true,
      message: 'Database is connected',
      data: dbStatus
    });
  } else {
    res.status(503).json({
      success: false,
      message: 'Database is not connected',
      data: dbStatus
    });
  }
});

export default router;
