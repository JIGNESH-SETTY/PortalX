import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  sessionSecret: process.env.SESSION_SECRET || 'portalx_default_dev_session_secret_change_me',
  srmBaseUrl: (process.env.SRM_BASE_URL || 'https://student.srmap.edu.in/srmapstudentcorner').replace(/\/+$/, ''),
  srmRequestTimeoutMs: parseInt(process.env.SRM_REQUEST_TIMEOUT_MS, 10) || 15000,
  devMockFallback: process.env.DEV_MOCK_FALLBACK === 'true'
};

