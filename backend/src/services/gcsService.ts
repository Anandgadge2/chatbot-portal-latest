import { bucket } from '../config/gcs';
import { logger } from '../config/logger';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

/**
 * Uploads a buffer to Google Cloud Storage
 * 
 * @param buffer The file buffer
 * @param fileName The name to store the file as
 * @param contentType The MIME type of the file
 * @param folder The folder in the bucket
 * @returns The public URL of the uploaded file
 */
export async function uploadBufferToGCS(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  folder: string = 'media'
): Promise<string | null> {
  try {
    const destination = `${folder}/${uuidv4()}_${fileName}`;
    const file = bucket.file(destination);

    await file.save(buffer, {
      contentType: contentType,
      public: true, // Make the file publicly accessible
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
    logger.info(`✅ GCS upload success: ${publicUrl}`);
    return publicUrl;
  } catch (error: any) {
    logger.error('❌ GCS upload failed:', error.message);
    return null;
  }
}

/**
 * Downloads media from WhatsApp and uploads it to GCS
 * 
 * @param mediaId WhatsApp media ID
 * @param accessToken WhatsApp access token
 * @param fileName Desired filename
 * @param folder GCS folder
 * @returns Public URL or null
 */
export async function uploadWhatsAppMediaToGCS(
  mediaId: string,
  accessToken: string,
  fileName: string = 'media_file',
  folder: string = 'whatsapp_media'
): Promise<string | null> {
  try {
    if (!mediaId || !accessToken) {
      logger.error('❌ Missing mediaId or accessToken for GCS upload');
      return null;
    }

    // 1. Get media URL from WhatsApp API
    const mediaResponse = await axios.get(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const downloadUrl = mediaResponse.data.url;
    const mimeType = mediaResponse.data.mime_type || 'application/octet-stream';
    
    // 2. Download the media
    const fileResponse = await axios.get(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer'
    });
    
    const buffer = Buffer.from(fileResponse.data);
    
    // 3. Upload to GCS
    const ext = mimeType.split('/')[1] || 'bin';
    const finalFileName = fileName.includes('.') ? fileName : `${fileName}.${ext}`;
    
    return await uploadBufferToGCS(buffer, finalFileName, mimeType, folder);
  } catch (error: any) {
    logger.error('❌ WhatsApp media to GCS failed:', error.message);
    return null;
  }
}
