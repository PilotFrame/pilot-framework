import { Router } from 'express';

import type { AuthenticatedRequest } from '../auth.js';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  updateProjectStatus,
  deleteProject,
  addEpic,
  addStory,
  updateStoryStatus,
  addComment,
  markCriteriaComplete,
  getStory,
  listStoriesByStatus
} from '../services/projectService.js';
import type { ProjectStatus, StoryStatus } from '../types/project.js';

export const projectsRouter = Router();

// List all projects (with optional status filter)
projectsRouter.get('/', async (req, res) => {
  const status = req.query.status as ProjectStatus | undefined;
  const projects = await listProjects(status);
  res.json({ data: projects });
});

// Get project by ID
projectsRouter.get('/:id', async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json({ data: project });
});

// Create new project
projectsRouter.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.subject || 'unknown';
    
    const projectData = {
      ...req.body,
      createdBy: req.body.createdBy || userId
    };
    
    const created = await createProject(projectData);
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
});

// Update project
projectsRouter.patch('/:id', async (req, res, next) => {
  try {
    const updated = await updateProject(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

// Publish project (change status to published)
projectsRouter.post('/:id/publish', async (req, res, next) => {
  try {
    const updated = await updateProjectStatus(req.params.id, 'published');
    if (!updated) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

// Update project status
projectsRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }
    
    const updated = await updateProjectStatus(req.params.id, status);
    if (!updated) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

// Delete project
projectsRouter.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await deleteProject(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
});

// Add epic to project
projectsRouter.post('/:id/epics', async (req, res, next) => {
  try {
    const updated = await addEpic(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

// Add story to epic
projectsRouter.post('/:projectId/epics/:epicId/stories', async (req, res, next) => {
  try {
    const { projectId, epicId } = req.params;
    const updated = await addStory(projectId, epicId, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Project or epic not found' });
      return;
    }
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

// Get story by ID
projectsRouter.get('/:projectId/stories/:storyId', async (req, res) => {
  const { projectId, storyId } = req.params;
  const story = await getStory(projectId, storyId);
  if (!story) {
    res.status(404).json({ error: 'Story not found' });
    return;
  }
  res.json({ data: story });
});

// Update story status
projectsRouter.patch('/:projectId/stories/:storyId/status', async (req, res, next) => {
  try {
    const { projectId, storyId } = req.params;
    const { status, updatedBy } = req.body;
    
    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }
    
    const updated = await updateStoryStatus(projectId, storyId, status, updatedBy);
    if (!updated) {
      res.status(404).json({ error: 'Project or story not found' });
      return;
    }
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

// Add comment to story
projectsRouter.post('/:projectId/stories/:storyId/comments', async (req, res, next) => {
  try {
    const { projectId, storyId } = req.params;
    const updated = await addComment(projectId, storyId, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Project or story not found' });
      return;
    }
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

// Mark acceptance criteria as complete
projectsRouter.post('/:projectId/stories/:storyId/criteria/:criteriaId/complete', async (req, res, next) => {
  try {
    const { projectId, storyId, criteriaId } = req.params;
    const { verifiedBy, evidence } = req.body;
    
    if (!verifiedBy) {
      res.status(400).json({ error: 'verifiedBy is required' });
      return;
    }
    
    const updated = await markCriteriaComplete(projectId, storyId, criteriaId, verifiedBy, evidence);
    if (!updated) {
      res.status(404).json({ error: 'Project, story, or criteria not found' });
      return;
    }
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

// List stories by status
projectsRouter.get('/stories/by-status/:status', async (req, res) => {
  const status = req.params.status as StoryStatus;
  const projectId = req.query.projectId as string | undefined;
  const stories = await listStoriesByStatus(status, projectId);
  res.json({ data: stories });
});

