import express, { Request, Response } from 'express';
import { getDatabaseStatus } from '../middleware/dbConnection';

const router = express.Router();

router.get('/', async (_req: Request, res: Response) => {
  const dbStatus = getDatabaseStatus();

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      ...dbStatus
    }
  });
});

router.get('/db', async (_req: Request, res: Response) => {
  const dbStatus = getDatabaseStatus();

  if (dbStatus.connected) {
    res.json({
      success: true,
      message: 'Database is connected',
      data: {
        connectionStatus: dbStatus,
          
      }
    });
    return;
  }

  res.status(503).json({
    success: false,
    message: 'Database is not connected',
    data: {
      connectionStatus: dbStatus,
        
    }
  });
});

export default router;
