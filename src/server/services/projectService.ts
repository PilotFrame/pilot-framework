import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import type {
  Project,
  ProjectSummary,
  Epic,
  Story,
  AcceptanceCriteria,
  Comment,
  ProjectStatus,
  StoryStatus
} from '../types/project.js';

// Initialize AJV validator
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const schemaPath = path.join(process.cwd(), 'schemas', 'project-definition.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
const validateProjectSpec = ajv.compile(schema);

interface ProjectRecord {
  slug: string;
  project: Project;
  createdAt: string;
  updatedAt: string;
}

const dataProjectDir = path.join(process.cwd(), 'data', 'projects');
const exampleProjectDir = path.join(process.cwd(), 'examples', 'projects');

const projectCache: Map<string, ProjectRecord> = new Map();

// Validate project spec against JSON schema
function ensureValidProject(project: Partial<Project>): void {
  const isValid = validateProjectSpec(project);
  if (!isValid) {
    const message = ajv.errorsText(validateProjectSpec.errors, { separator: '\n  ' });
    const error = new Error(`Project validation failed:\n  ${message}`);
    throw error;
  }
}

// Ensure data directory exists
function ensureDataDir(): void {
  if (!fs.existsSync(dataProjectDir)) {
    fs.mkdirSync(dataProjectDir, { recursive: true });
    console.log(`[ProjectService] Created data directory: ${dataProjectDir}`);
  }
}

// Load projects from both data/ and examples/ directories
function loadProjects(): void {
  const dirs = [
    { path: exampleProjectDir, label: 'examples' },
    { path: dataProjectDir, label: 'data' }
  ];

  dirs.forEach(({ path: dir, label }) => {
    if (!fs.existsSync(dir)) {
      return;
    }

    const files = fs.readdirSync(dir).filter((file) => file.endsWith('.json'));

    files.forEach((file) => {
      try {
        const project = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as Project;
        const slug = project.id;
        
        projectCache.set(slug, {
          slug,
          project,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        });
      } catch (error) {
        console.error(`[ProjectService] Failed to load project from ${label}/${file}:`, error);
      }
    });
  });

  console.log(`[ProjectService] Loaded ${projectCache.size} projects`);
}

// Initialize
ensureDataDir();
loadProjects();

// Save project to data directory
function saveProjectToFile(project: Project): void {
  const filePath = path.join(dataProjectDir, `${project.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8');
}

// Calculate progress percentage
function calculateProgress(completedCount: number, totalCount: number): number {
  if (totalCount === 0) return 0;
  return Math.round((completedCount / totalCount) * 100);
}

// List all projects
export async function listProjects(status?: ProjectStatus): Promise<ProjectSummary[]> {
  const projects = Array.from(projectCache.values())
    .filter(record => !status || record.project.status === status)
    .map(record => {
      const project = record.project;
      const storyCount = project.epics.reduce((sum, epic) => sum + epic.stories.length, 0);
      const completedStories = project.epics.reduce(
        (sum, epic) => sum + epic.stories.filter(s => s.status === 'done').length,
        0
      );

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        projectType: project.projectType,
        epicCount: project.epics.length,
        storyCount,
        completedStories,
        progressPercentage: calculateProgress(completedStories, storyCount),
        createdBy: project.createdBy,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return projects;
}

// Get project by ID
export async function getProject(id: string): Promise<Project | null> {
  const record = projectCache.get(id);
  return record ? record.project : null;
}

// Create new project
export async function createProject(projectData: Partial<Project>): Promise<Project> {
  const now = new Date().toISOString();
  
  // Normalize the project data - add defaults for fields AI won't generate
  const normalizedProject: Project = {
    id: projectData.id || randomUUID(),
    name: projectData.name || 'Untitled Project',
    description: projectData.description || '',
    status: projectData.status || 'draft',
    projectType: projectData.projectType,
    conversationId: projectData.conversationId,
    workflowId: projectData.workflowId,
    createdBy: projectData.createdBy || 'system',
    technicalLead: projectData.technicalLead,
    estimatedComplexity: projectData.estimatedComplexity,
    targetLaunchDate: projectData.targetLaunchDate,
    actualLaunchDate: projectData.actualLaunchDate,
    tags: projectData.tags || [],
    publishedAt: projectData.publishedAt,
    startedAt: projectData.startedAt,
    completedAt: projectData.completedAt,
    createdAt: now,
    updatedAt: now,
    epics: (projectData.epics || []).map(epic => ({
      id: epic.id || randomUUID(),
      title: epic.title,
      description: epic.description,
      priority: epic.priority,
      status: epic.status || 'pending',
      completedStories: epic.completedStories || 0,
      estimatedStories: epic.estimatedStories,
      createdAt: epic.createdAt || now,
      startedAt: epic.startedAt,
      completedAt: epic.completedAt,
      updatedAt: epic.updatedAt || now,
      stories: (epic.stories || []).map(story => ({
        id: story.id || randomUUID(),
        title: story.title,
        description: story.description,
        status: story.status || 'draft',
        assignedPersonas: story.assignedPersonas || [],
        assignedAgents: story.assignedAgents,
        priority: story.priority,
        storyPoints: story.storyPoints,
        estimatedHours: story.estimatedHours,
        tags: story.tags || [],
        dependencies: story.dependencies,
        relatedStories: story.relatedStories,
        comments: story.comments || [],
        createdAt: story.createdAt || now,
        startedAt: story.startedAt,
        completedAt: story.completedAt,
        updatedAt: story.updatedAt || now,
        acceptanceCriteria: (story.acceptanceCriteria || []).map(criteria => ({
          id: criteria.id || randomUUID(),
          description: criteria.description,
          completed: criteria.completed || false,
          verifiedBy: criteria.verifiedBy,
          verifiedAt: criteria.verifiedAt,
          evidence: criteria.evidence,
          isBlocking: criteria.isBlocking || false
        }))
      }))
    }))
  };

  // Validate normalized project against schema
  ensureValidProject(normalizedProject);

  // Save to file
  saveProjectToFile(normalizedProject);

  // Update cache
  projectCache.set(normalizedProject.id, {
    slug: normalizedProject.id,
    project: normalizedProject,
    createdAt: now,
    updatedAt: now
  });

  console.log(`[ProjectService] Created project: ${normalizedProject.id}`);
  return normalizedProject;
}

// Update project
export async function updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
  const record = projectCache.get(id);
  if (!record) {
    return null;
  }

  const now = new Date().toISOString();
  const updatedProject: Project = {
    ...record.project,
    ...updates,
    id: record.project.id, // Don't allow ID change
    createdAt: record.project.createdAt, // Don't allow createdAt change
    updatedAt: now
  };

  // Validate updated project against schema
  ensureValidProject(updatedProject);

  // Save to file
  saveProjectToFile(updatedProject);

  // Update cache
  projectCache.set(id, {
    ...record,
    project: updatedProject,
    updatedAt: now
  });

  console.log(`[ProjectService] Updated project: ${id}`);
  return updatedProject;
}

// Update project status
export async function updateProjectStatus(id: string, status: ProjectStatus): Promise<Project | null> {
  const updates: Partial<Project> = { status };

  // Set timestamps based on status
  if (status === 'published') {
    updates.publishedAt = new Date().toISOString();
  } else if (status === 'in_development') {
    updates.startedAt = new Date().toISOString();
  } else if (status === 'completed') {
    updates.completedAt = new Date().toISOString();
  }

  return updateProject(id, updates);
}

// Delete project
export async function deleteProject(id: string): Promise<boolean> {
  const record = projectCache.get(id);
  if (!record) {
    return false;
  }

  // Delete file
  const filePath = path.join(dataProjectDir, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Remove from cache
  projectCache.delete(id);

  console.log(`[ProjectService] Deleted project: ${id}`);
  return true;
}

// Add epic to project
export async function addEpic(projectId: string, epicData: Omit<Epic, 'id' | 'createdAt' | 'updatedAt' | 'completedStories'>): Promise<Project | null> {
  const project = await getProject(projectId);
  if (!project) {
    return null;
  }

  const now = new Date().toISOString();
  const epic: Epic = {
    id: randomUUID(),
    ...epicData,
    completedStories: 0,
    createdAt: now,
    updatedAt: now
  };

  project.epics.push(epic);
  return updateProject(projectId, { epics: project.epics });
}

// Add story to epic
export async function addStory(
  projectId: string,
  epicId: string,
  storyData: Omit<Story, 'id' | 'createdAt' | 'updatedAt' | 'comments'>
): Promise<Project | null> {
  const project = await getProject(projectId);
  if (!project) {
    return null;
  }

  const epic = project.epics.find(e => e.id === epicId);
  if (!epic) {
    return null;
  }

  const now = new Date().toISOString();
  const story: Story = {
    id: randomUUID(),
    ...storyData,
    comments: [],
    createdAt: now,
    updatedAt: now
  };

  epic.stories.push(story);
  return updateProject(projectId, { epics: project.epics });
}

// Update story status
export async function updateStoryStatus(
  projectId: string,
  storyId: string,
  status: StoryStatus,
  updatedBy?: string
): Promise<Project | null> {
  const project = await getProject(projectId);
  if (!project) {
    return null;
  }

  let storyFound = false;
  const now = new Date().toISOString();

  for (const epic of project.epics) {
    const story = epic.stories.find(s => s.id === storyId);
    if (story) {
      story.status = status;
      story.updatedAt = now;

      // Set timestamps
      if (status === 'in_progress' && !story.startedAt) {
        story.startedAt = now;
      } else if (status === 'done' && !story.completedAt) {
        story.completedAt = now;
      }

      // Add comment if updatedBy provided
      if (updatedBy) {
        const comment: Comment = {
          id: randomUUID(),
          content: `Status changed to: ${status}`,
          author: updatedBy,
          authorType: updatedBy.includes('_') ? 'persona' : 'agent',
          type: 'update',
          createdAt: now
        };
        story.comments.push(comment);
      }

      // Update epic completed stories count
      epic.completedStories = epic.stories.filter(s => s.status === 'done').length;

      // Update epic status
      if (epic.completedStories === 0) {
        epic.status = 'pending';
      } else if (epic.completedStories < epic.stories.length) {
        epic.status = 'in_progress';
      } else {
        epic.status = 'completed';
      }

      storyFound = true;
      break;
    }
  }

  if (!storyFound) {
    return null;
  }

  return updateProject(projectId, { epics: project.epics });
}

// Add comment to story
export async function addComment(
  projectId: string,
  storyId: string,
  commentData: Omit<Comment, 'id' | 'createdAt'>
): Promise<Project | null> {
  const project = await getProject(projectId);
  if (!project) {
    return null;
  }

  let storyFound = false;
  const now = new Date().toISOString();

  for (const epic of project.epics) {
    const story = epic.stories.find(s => s.id === storyId);
    if (story) {
      const comment: Comment = {
        id: randomUUID(),
        ...commentData,
        createdAt: now
      };
      story.comments.push(comment);
      storyFound = true;
      break;
    }
  }

  if (!storyFound) {
    return null;
  }

  return updateProject(projectId, { epics: project.epics });
}

// Mark acceptance criteria as complete
export async function markCriteriaComplete(
  projectId: string,
  storyId: string,
  criteriaId: string,
  verifiedBy: string,
  evidence?: string
): Promise<Project | null> {
  const project = await getProject(projectId);
  if (!project) {
    return null;
  }

  let criteriaFound = false;
  const now = new Date().toISOString();

  for (const epic of project.epics) {
    const story = epic.stories.find(s => s.id === storyId);
    if (story) {
      const criteria = story.acceptanceCriteria.find(c => c.id === criteriaId);
      if (criteria) {
        criteria.completed = true;
        criteria.verifiedBy = verifiedBy;
        criteria.verifiedAt = now;
        if (evidence) {
          criteria.evidence = evidence;
        }
        criteriaFound = true;
        break;
      }
    }
  }

  if (!criteriaFound) {
    return null;
  }

  return updateProject(projectId, { epics: project.epics });
}

// Get story by ID
export async function getStory(projectId: string, storyId: string): Promise<Story | null> {
  const project = await getProject(projectId);
  if (!project) {
    return null;
  }

  for (const epic of project.epics) {
    const story = epic.stories.find(s => s.id === storyId);
    if (story) {
      return story;
    }
  }

  return null;
}

// List stories by status
export async function listStoriesByStatus(status: StoryStatus, projectId?: string): Promise<Story[]> {
  const projects = projectId
    ? [await getProject(projectId)].filter(Boolean) as Project[]
    : Array.from(projectCache.values()).map(r => r.project);

  const stories: Story[] = [];
  for (const project of projects) {
    for (const epic of project.epics) {
      stories.push(...epic.stories.filter(s => s.status === status));
    }
  }

  return stories;
}

