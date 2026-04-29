import express, { Request, Response } from 'express';
import { getDatabaseStatus } from '../middleware/dbConnection';
import { getUsersCollectionCount } from '../utils/databaseSafety';

const router = express.Router();

router.get('/', async (_req: Request, res: Response) => {
  const dbStatus = getDatabaseStatus();
  const usersCollectionCount = dbStatus.connected ? await getUsersCollectionCount() : 0;

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      ...dbStatus,
      usersCollectionCount
    }
  });
});

router.get('/db', async (_req: Request, res: Response) => {
  const dbStatus = getDatabaseStatus();
  const usersCollectionCount = dbStatus.connected ? await getUsersCollectionCount() : 0;

  if (dbStatus.connected) {
    res.json({
      success: true,
      message: 'Database is connected',
      data: {
        connectionStatus: dbStatus,
        usersCollectionCount
      }
    });
    return;
  }

  res.status(503).json({
    success: false,
    message: 'Database is not connected',
    data: {
      connectionStatus: dbStatus,
      usersCollectionCount
    }
  });
});

export default router;
