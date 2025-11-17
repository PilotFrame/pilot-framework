// Project Management Types
// Projects, Epics, Stories, and Acceptance Criteria data structures

export type ProjectStatus = 'draft' | 'published' | 'in_development' | 'completed' | 'archived';
export type ProjectType = 'website' | 'api' | 'mobile-app' | 'desktop-app' | 'data-pipeline' | 'other';
export type ComplexityLevel = 'low' | 'medium' | 'high';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type EpicStatus = 'pending' | 'in_progress' | 'completed';
export type StoryStatus = 'draft' | 'ready' | 'in_progress' | 'review' | 'blocked' | 'done';
export type CommentAuthorType = 'user' | 'persona' | 'agent';
export type CommentType = 'update' | 'question' | 'decision' | 'blocker' | 'note';

export interface AcceptanceCriteria {
  id: string;
  description: string;
  completed: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  evidence?: string;
  isBlocking: boolean;
}

export interface Comment {
  id: string;
  content: string;
  author: string;
  authorType: CommentAuthorType;
  type: CommentType;
  createdAt: string;
  updatedAt?: string;
}

export interface Story {
  id: string;
  title: string;
  description: string;
  status: StoryStatus;
  assignedPersonas: string[];
  assignedAgents?: string[];
  acceptanceCriteria: AcceptanceCriteria[];
  storyPoints?: number;
  estimatedHours?: number;
  priority: Priority;
  tags: string[];
  dependencies?: string[];
  relatedStories?: string[];
  comments: Comment[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface Epic {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: EpicStatus;
  stories: Story[];
  estimatedStories?: number;
  completedStories: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  projectType?: ProjectType;
  conversationId?: string;
  workflowId?: string;
  createdBy: string;
  technicalLead?: string;
  epics: Epic[];
  estimatedComplexity?: ComplexityLevel;
  targetLaunchDate?: string;
  actualLaunchDate?: string;
  tags: string[];
  createdAt: string;
  publishedAt?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

// Summary types for list views
export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  projectType?: ProjectType;
  epicCount: number;
  storyCount: number;
  completedStories: number;
  progressPercentage: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EpicSummary {
  id: string;
  title: string;
  priority: Priority;
  status: EpicStatus;
  storyCount: number;
  completedStories: number;
  progressPercentage: number;
}

