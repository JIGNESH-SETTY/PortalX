import { createApp } from './app.js';
import { config } from './config/env.js';
import { captchaService } from './services/captcha.service.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(`🚀 PortalX Backend Server running on port ${config.port}`);
  console.log(`🌐 Local URL:        http://localhost:${config.port}`);
  console.log(`🎓 SRM Target:       ${config.srmBaseUrl}`);
  console.log(`🔧 Environment:      ${config.nodeEnv}`);
  console.log(`🧪 Mock Fallback:    ${config.devMockFallback}`);
  console.log(`====================================================`);
  
  // Pre-warm the Tesseract OCR worker in the background
  captchaService.warmup();
});

// Handle graceful shutdown
const shutdown = (signal) => {
  console.log(`\nReceived ${signal}. Shutting down PortalX gracefully...`);
  server.close(async () => {
    // Release the Tesseract.js WASM worker cleanly
    await captchaService.terminate();
    console.log('PortalX server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

