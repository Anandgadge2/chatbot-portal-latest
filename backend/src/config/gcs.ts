import { Storage } from '@google-cloud/storage';
import path from 'path';
import { logger } from './logger';

const storageOptions: any = {
  projectId: process.env.GCP_PROJECT_ID,
};

// Support for environment-variable-based credentials (required for Vercel)
if (process.env.GCP_SERVICE_ACCOUNT_JSON) {
  try {
    storageOptions.credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON);
    logger.info('🔑 Using GCS credentials from environment variable');
  } catch (err: any) {
    logger.error('❌ Failed to parse GCP_SERVICE_ACCOUNT_JSON:', err.message);
  }
} else {
  storageOptions.keyFilename = path.resolve(process.cwd(), process.env.GCP_KEY_FILE_PATH || 'gcs-service-account.json');
  logger.info(`📂 Using GCS credentials from file: ${storageOptions.keyFilename}`);
}

const storage = new Storage(storageOptions);

export const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || 'chatbot-media-storage-490106');

/**
 * Ensures the GCS bucket exists, has correct CORS, and is public
 */
export const configureGCS = async (): Promise<void> => {
  try {
    const [exists] = await bucket.exists();
    if (!exists) {
      logger.info(`🏗️ Creating GCS bucket: ${bucket.name}`);
      await bucket.create({
        location: 'ASIA', // Optimized for India (JHARSGUDA context)
        storageClass: 'STANDARD',
      });
      logger.info(`✅ GCS bucket ${bucket.name} created`);
    }

    // Always ensure CORS configuration is set
    logger.info(`⚙️ Configuring CORS for ${bucket.name}...`);
    await bucket.setCorsConfiguration([
      {
        maxAgeSeconds: 3600,
        method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
        origin: ['*'], // Allow all origins for the portal dashboard
        responseHeader: [
          'Content-Type',
          'Authorization',
          'Content-Length',
          'User-Agent',
          'x-goog-resumable',
          'ETag',
        ],
      },
    ]);

    // Ensure the bucket has public read access for citizen media
    // Note: If Uniform Bucket Level Access is enabled, makePublic() sets IAM roles.
    // If Fine-grained access is enabled, it sets ACLs.
    try {
      await bucket.makePublic();
      logger.info(`🔓 GCS bucket ${bucket.name} is now public (allUsers: Storage Object Viewer)`);
    } catch (e: any) {
      logger.warn(`⚠️ Could not make bucket public (might already be public or have IAM restrictions): ${e.message}`);
    }

    logger.info(`✅ GCS configuration completed for ${bucket.name}`);
  } catch (error: any) {
    logger.error('❌ Failed to configure GCS:', error.message);
  }
};

export default storage;