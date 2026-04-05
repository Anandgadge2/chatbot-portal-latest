import axios from 'axios';

export async function sendSmsOtp(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const gatewayUrl = process.env.SMS_GATEWAY_URL;
  const gatewayApiKey = process.env.SMS_GATEWAY_API_KEY;

  // Non-production fallback for local/testing environments
  if (!gatewayUrl) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📲 [DEV SMS OTP] ${phone} -> ${otp}`);
      return { success: true };
    }
    return { success: false, error: 'SMS gateway is not configured' };
  }

  try {
    await axios.post(
      gatewayUrl,
      {
        to: phone,
        message: `Your password reset OTP is ${otp}. It expires in 10 minutes.`
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(gatewayApiKey ? { Authorization: `Bearer ${gatewayApiKey}` } : {})
        }
      }
    );

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.message || error?.message || 'Failed to send SMS OTP' };
  }
}
