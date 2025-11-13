import { Router } from 'express';
import { z } from 'zod';

import { createInvocation } from '../services/invocationService.js';

export const invokeRouter = Router();

const InvokeSchema = z.object({
  personaId: z.string().min(1),
  methodId: z.string().min(1),
  input: z.record(z.unknown()),
  dryRun: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional()
});

invokeRouter.post('/', async (req, res, next) => {
  try {
    const payload = InvokeSchema.parse(req.body);
    const invocation = await createInvocation(payload);
    res.status(202).json({ data: invocation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request payload', details: error.errors });
      return;
    }
    next(error);
  }
});

