import axios from 'axios';
import { cloudinary } from '../config/cloudinary';
import { logger } from '../config/logger';

/**
 * Uploads media from WhatsApp to Cloudinary
 * 
 * @param mediaId The WhatsApp media ID
 * @param accessToken The WhatsApp access token
 * @param folder The Cloudinary folder to store the media in
 * @returns The secure URL of the uploaded media or null if failed
 */
export async function uploadWhatsAppMediaToCloudinary(
  mediaId: string, 
  accessToken: string,
  folder: string = 'ZP Amravati'
): Promise<string | null> {
  try {
    if (!mediaId || !accessToken) {
      logger.error('❌ Missing mediaId or accessToken for upload');
      return null;
    }

    logger.info(`📥 Downloading WhatsApp media: ${mediaId}`);

    // 1. Get media URL from WhatsApp API
    const mediaResponse = await axios.get(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const downloadUrl = mediaResponse.data.url;
    if (!downloadUrl) {
      logger.error('❌ WhatsApp media URL not found in response');
      return null;
    }
    
    // 2. Download the media
    const fileResponse = await axios.get(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer'
    });
    
    const buffer = Buffer.from(fileResponse.data);
    
    // 3. Upload to Cloudinary using a buffer stream
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: 'auto',
          tags: ['whatsapp-chatbot', folder]
        },
        (error: any, result: any) => {
          if (error) {
            logger.error('❌ Cloudinary upload failed:', error);
            resolve(null);
          } else {
            logger.info('✅ Cloudinary upload success:', result?.secure_url);
            resolve(result?.secure_url || null);
          }
        }
      );
      
      uploadStream.end(buffer);
    });
  } catch (error: any) {
    logger.error('❌ WhatsApp media upload to Cloudinary failed:', error.message);
    if (error.response) {
      logger.error('API Error Response:', JSON.stringify(error.response.data));
    }
    return null;
  }
}
