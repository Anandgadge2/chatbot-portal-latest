import { Storage } from '@google-cloud/storage';
import path from 'path';
import { logger } from './logger';

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.cwd(), process.env.GCP_KEY_FILE_PATH || 'gcs-service-account.json'),
});

export const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || 'chatbot-media-storage-490106');

/**
 * Ensures the GCS bucket exists and is public
 */
export const configureGCS = async (): Promise<void> => {
  try {
    const [exists] = await bucket.exists();
    if (!exists) {
      logger.info(`🏗️ Creating GCS bucket: ${bucket.name}`);
      await bucket.create({
        location: 'US', // You can change this to 'ASIA' or 'EU' based on your preference
        storageClass: 'STANDARD',
      });
      
      // Make the bucket public (allUsers can read)
      await bucket.makePublic();
      logger.info(`✅ GCS bucket ${bucket.name} created and made public`);
    } else {
      logger.info(`✅ GCS bucket ${bucket.name} already exists`);
    }
  } catch (error: any) {
    logger.error('❌ Failed to configure GCS:', error.message);
    // We don't throw here to avoid crashing the server if GCS is down, 
    // but in production you might want to.
  }
};

export default storage;
