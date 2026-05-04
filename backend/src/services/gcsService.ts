import { bucket } from '../config/gcs';
import { logger } from '../config/logger';
import axios from 'axios';
import { randomUUID } from 'crypto';

const MIME_TYPE_MAP: Record<string, string> = {
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'pdf': 'application/pdf',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'mp4': 'video/mp4',
  'csv': 'text/csv'
};

function getProperContentType(fileName: string, currentType: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext && MIME_TYPE_MAP[ext]) {
    return MIME_TYPE_MAP[ext];
  }
  return currentType;
}

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
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
      const destination = `${folder}/${randomUUID()}_${fileName}`;
      const file = bucket.file(destination);
      
      const finalContentType = getProperContentType(fileName, contentType);

      await file.save(buffer, {
        contentType: finalContentType,
        public: true,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination.split('/').map(segment => encodeURIComponent(segment)).join('/')}`;
      logger.info(`✅ GCS upload success: ${publicUrl}`);
      return publicUrl;
    } catch (error: any) {
      attempt++;
      logger.error(`❌ GCS upload failed (Attempt ${attempt}/${maxAttempts}): ${error.message}`);
      if (attempt >= maxAttempts) return null;
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }
  return null;
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
): Promise<{ url: string; mimeType: string; originalName: string } | null> {
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
    // Try to get a clean extension from our map, otherwise fallback to split
    let ext = 'bin';
    for (const [key, value] of Object.entries(MIME_TYPE_MAP)) {
      if (value === mimeType) {
        ext = key;
        break;
      }
    }
    
    // If not found in map, use the second part of mime type but keep it clean
    if (ext === 'bin' && mimeType.includes('/')) {
      ext = mimeType.split('/')[1].split('.').pop() || 'bin';
    }

    const finalFileName = fileName.includes('.') ? fileName : `${fileName}.${ext}`;
    
    const cloudUrl = await uploadBufferToGCS(buffer, finalFileName, mimeType, folder);
    
    return cloudUrl ? {
      url: cloudUrl,
      mimeType,
      originalName: fileName
    } : null;
  } catch (error: any) {
    if (error.response) {
      logger.error(`❌ WhatsApp media to GCS failed (API Error): ${JSON.stringify(error.response.data)}`);
    } else {
      logger.error(`❌ WhatsApp media to GCS failed: ${error.message}`);
    }
    return null;
  }
}
