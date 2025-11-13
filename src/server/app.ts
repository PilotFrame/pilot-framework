import cors from 'cors';
import express, { json, urlencoded } from 'express';
import helmet from 'helmet';

import { requireAuth } from './auth.js';
import { appConfig } from './config.js';
import { assistantRouter } from './routes/assistant.js';
import { healthRouter } from './routes/health.js';
import { invokeRouter } from './routes/invoke.js';
import { mcpRouter } from './routes/mcp.js';
import { personasRouter } from './routes/personas.js';
import { workflowsRouter } from './routes/workflows.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', true);

  app.use(helmet());
  app.use(
    cors({
      origin: appConfig.NODE_ENV === 'development' ? '*' : false
    })
  );
  
  // Middleware to normalize Content-Type header (handle duplicate headers)
  app.use((req, res, next) => {
    const contentType = req.get('content-type');
    if (contentType && contentType.includes(',')) {
      // If Content-Type has multiple values, take the first one
      const normalized = contentType.split(',')[0].trim();
      req.headers['content-type'] = normalized;
    }
    next();
  });
  
  // Body parsing middleware - must be before routes
  // Configure JSON parser to handle various content types
  app.use(json({ 
    limit: '2mb',
    type: ['application/json', 'application/json; charset=utf-8']
  }));
  app.use(urlencoded({ extended: false, limit: '2mb' }));

  app.use('/health', healthRouter);

  app.use('/mcp', mcpRouter);

  // Auth middleware for /api routes
  app.use('/api', requireAuth);
  app.use('/api/personas', personasRouter);
  app.use('/api/workflows', workflowsRouter);
  app.use('/api/invoke', invokeRouter);
  app.use('/api/assistant', assistantRouter);

  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('Unhandled error', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  );

  return app;
}

