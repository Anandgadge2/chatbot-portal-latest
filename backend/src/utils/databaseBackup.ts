import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../config/logger';

const execFileAsync = promisify(execFile);

export const runMongoBackup = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined');
  }

  logger.warn('Running MongoDB backup before risky write operation');

  try {
    await execFileAsync('mongodump', [
      `--uri=${mongoUri}`,
      '--archive=backup.gz',
      '--gzip'
    ]);
    logger.info('MongoDB backup completed successfully');
  } catch (error: any) {
    logger.error(`MongoDB backup failed: ${error.message}`);
    throw new Error(`MongoDB backup failed: ${error.message}`);
  }
};
