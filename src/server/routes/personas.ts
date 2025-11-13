import { Router } from 'express';

import type { AuthenticatedRequest } from '../auth.js';
import { createPersonaSpec, getPersonaSpec, listPersonas } from '../services/personaService.js';

export const personasRouter = Router();

personasRouter.get('/', async (_req, res) => {
  const personas = await listPersonas();
  res.json({ data: personas });
});

personasRouter.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const created = await createPersonaSpec(req.body);
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
});

personasRouter.get('/:id/spec', async (req, res) => {
  const spec = await getPersonaSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: 'Persona spec not found' });
    return;
  }
  res.json({ data: spec });
});

