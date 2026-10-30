import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import timetableRoutes from './routes/timetable.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import marksRoutes from './routes/marks.routes.js';
import markAttendanceRoutes from './routes/markAttendance.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

export function createApp() {
  const app = express();

  // 1. Security Headers via Helmet
  // Configured to permit Google Fonts and inline styles/scripts used by the frontend
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"]
        }
      }
    })
  );

  // 2. Request Parsers
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 3. User Session Management
  // Provides HTTP-only, isolated PortalX user sessions
  app.use(
    session({
      name: 'portalx_sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: config.isProduction, // In production, require HTTPS
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    })
  );

  // 4. Serve Static Frontend
  app.use(express.static(publicDir));

  // 5. Mount API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/student', profileRoutes);
  app.use('/api/timetable', timetableRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/marks', marksRoutes);
  app.use('/api/mark-attendance', markAttendanceRoutes);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      ok: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        mode: config.nodeEnv,
        srmBaseUrl: config.srmBaseUrl
      },
      message: 'PortalX backend is operational.'
    });
  });

  // 6. Handle unmatched 404 API routes (Express 5 syntax)
  app.use('/api', (req, res) => {
    res.status(404).json({
      ok: false,
      data: null,
      message: `API route ${req.method} ${req.originalUrl} not found.`,
      code: 'ROUTE_NOT_FOUND'
    });
  });

  // Catch-all: serve index.html for SPA frontend navigation
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts('html')) {
      return res.sendFile(path.join(publicDir, 'index.html'));
    }
    next();
  });

  // 7. Central Error Handling Middleware
  app.use(errorHandler);

  return app;
}
