import { Router } from 'express';

import { hasDatabase } from '../config.js';
import { getPool } from '../db.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const status = {
    status: 'ok' as const,
    dependencies: {
      database: hasDatabase ? 'configured' : 'not_configured'
    },
    timestamp: new Date().toISOString()
  };

  if (hasDatabase) {
    try {
      await getPool()?.query('select 1 as ok');
      status.dependencies.database = 'reachable';
    } catch (error) {
      status.dependencies.database = 'error';
      res.status(503).json({ ...status, error: (error as Error).message });
      return;
    }
  }

  res.json(status);
});

