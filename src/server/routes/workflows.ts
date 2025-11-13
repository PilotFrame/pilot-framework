import { Router } from 'express';

import type { AuthenticatedRequest } from '../auth.js';
import {
  createWorkflow,
  getWorkflow,
  listWorkflows,
  type WorkflowDefinition
} from '../services/workflowService.js';

export const workflowsRouter = Router();

workflowsRouter.get('/', async (_req, res) => {
  const workflows = await listWorkflows();
  res.json({ data: workflows });
});

workflowsRouter.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const created = await createWorkflow(req.body as WorkflowDefinition);
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
});

workflowsRouter.get('/:id', async (req, res) => {
  const workflow = await getWorkflow(req.params.id);
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  res.json({ data: workflow });
});

