import crypto from 'crypto';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

// Get Cloudinary upload signature
export const getSignature = (req, res) => {
  try {
    // Fallback values in case environment variables aren't set
    const apiSecret = process.env.CLOUDINARY_API_SECRET || 'your_default_api_secret';
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Log for debugging
    console.log('Generating Cloudinary signature with timestamp:', timestamp);
    console.log('Using API Secret found:', apiSecret ? 'Yes (masked)' : 'No');
    
    // Two options for signature creation
    let signature;
    
    // Option 1: Use cloudinary utils if available
    if (cloudinary.utils) {
      try {
        signature = cloudinary.utils.api_sign_request(
          { timestamp },
          apiSecret
        );
        console.log('Signature generated with cloudinary utils');
      } catch (utilsError) {
        console.error('Error using cloudinary utils:', utilsError);
        // Fall back to manual signature calculation
      }
    }
    
    // Option 2: Manual signature calculation as fallback
    if (!signature) {
      signature = crypto
        .createHash('sha1')
        .update(`timestamp=${timestamp}${apiSecret}`)
        .digest('hex');
      console.log('Signature generated manually with crypto');
    }
    
    res.status(200).json({
      success: true,
      timestamp,
      signature
    });
  } catch (error) {
    console.error('Signature generation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}; 