import express, { Request, Response } from 'express';
import { getDatabaseStatus } from '../middleware/dbConnection';
import { getUsersCollectionCount } from '../utils/databaseSafety';

const router = express.Router();

router.get('/', async (_req: Request, res: Response) => {
  const dbStatus = getDatabaseStatus();
  const usersCollectionCount = dbStatus.connected ? await getUsersCollectionCount() : 0;

  // System is in maintenance mode if:
  // 1. Database is disconnected
  // 2. Database is connected but users collection is empty (catastrophic data loss)
  const isDisconnected = !dbStatus.connected;
  const isUsersEmpty = usersCollectionCount === 0;
  const maintenanceMode = isDisconnected || isUsersEmpty;

  res.json({
    status: maintenanceMode ? 'MAINTENANCE' : 'OK',
    maintenance: maintenanceMode,
    maintenanceReason: maintenanceMode 
      ? (isDisconnected ? 'Database Disconnected' : 'Users Collection Empty')
      : null,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      ...dbStatus,
      usersCollectionCount
    },
    message: maintenanceMode 
      ? `System is currently under maintenance: ${isDisconnected ? 'DB Connection' : 'Empty Data'}` 
      : 'All systems operational'
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
