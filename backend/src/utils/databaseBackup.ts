import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../config/logger';

const execFileAsync = promisify(execFile);

export const runMongoBackup = async (): Promise<void> => {
  // Disabled as requested to improve application performance
  // logger.info('MongoDB backup is currently disabled.');
  return;
};
