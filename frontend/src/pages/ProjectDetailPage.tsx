import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { ApiConfig } from '../types';
import { buildAuthHeaders } from '../utils';

type AcceptanceCriteria = {
  id: string;
  description: string;
  completed: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  evidence?: string;
  isBlocking: boolean;
};

type Story = {
  id: string;
  title: string;
  description: string;
  status: string;
  assignedPersonas: string[];
  acceptanceCriteria: AcceptanceCriteria[];
  priority: string;
  tags: string[];
  comments: Array<{ id: string; content: string; author: string; createdAt: string }>;
};

type Epic = {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  stories: Story[];
  completedStories: number;
};

type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
  projectType?: string;
  estimatedComplexity?: string;
  conversationId?: string;
  workflowId?: string;
  epics: Epic[];
  tags: string[];
  createdAt: string;
  createdBy: string;
};

type ProjectDetailPageProps = {
  config: ApiConfig;
};

export function ProjectDetailPage({ config }: ProjectDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());

  const canCallApi = useMemo(
    () => config.baseUrl.trim().length > 0 && config.token.trim().length > 0,
    [config.baseUrl, config.token]
  );

  const loadProject = useCallback(async () => {
    if (!canCallApi || !id) return;

    try {
      setLoading(true);
      setErrorMessage(null);

      const response = await fetch(new URL(`/api/projects/${id}`, config.baseUrl).toString(), {
        headers: buildAuthHeaders(config)
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const body = await response.json();
      setProject(body.data);
    } catch (error) {
      setErrorMessage(`Failed to load project: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [canCallApi, id, config]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const toggleEpic = (epicId: string) => {
    setExpandedEpics(prev => {
      const next = new Set(prev);
      if (next.has(epicId)) {
        next.delete(epicId);
      } else {
        next.add(epicId);
      }
      return next;
    });
  };

  const toggleStory = (storyId: string) => {
    setExpandedStories(prev => {
      const next = new Set(prev);
      if (next.has(storyId)) {
        next.delete(storyId);
      } else {
        next.add(storyId);
      }
      return next;
    });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'draft':
      case 'pending':
        return 'bg-gray-500';
      case 'published':
      case 'ready':
        return 'bg-blue-500';
      case 'in_development':
      case 'in_progress':
        return 'bg-yellow-500';
      case 'completed':
      case 'done':
        return 'bg-green-500';
      case 'blocked':
        return 'bg-red-500';
      case 'review':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-red-400';
      case 'high':
        return 'text-orange-400';
      case 'medium':
        return 'text-yellow-400';
      case 'low':
        return 'text-green-400';
      default:
        return 'text-slate-400';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500"></div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <span>←</span> Back to Projects
        </button>
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-red-400">
          {errorMessage}
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const totalStories = project.epics.reduce((sum, epic) => sum + epic.stories.length, 0);
  const completedStories = project.epics.reduce((sum, epic) => sum + epic.completedStories, 0);
  const progressPercentage = totalStories > 0 ? Math.round((completedStories / totalStories) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <button
            onClick={() => navigate('/projects')}
            className="mb-2 flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            <span>←</span> Back to Projects
          </button>
          <h2 className="text-3xl font-bold text-white">{project.name}</h2>
          <p className="mt-2 text-slate-300">{project.description}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-white ${getStatusBadgeColor(project.status)}`}>
          {project.status}
        </span>
      </div>

      {/* Metadata */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-sm text-slate-400">Type</div>
          <div className="mt-1 font-medium text-white">{project.projectType || 'Unspecified'}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-sm text-slate-400">Complexity</div>
          <div className="mt-1 font-medium text-white">{project.estimatedComplexity || 'Unknown'}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-sm text-slate-400">Epics</div>
          <div className="mt-1 font-medium text-white">{project.epics.length}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-sm text-slate-400">Stories</div>
          <div className="mt-1 font-medium text-white">{completedStories}/{totalStories}</div>
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-300">Overall Progress</span>
          <span className="text-sm font-bold text-white">{progressPercentage}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Tags */}
      {project.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {project.tags.map(tag => (
            <span key={tag} className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Epics */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xl font-bold text-white">Epics</h3>
        {project.epics.map((epic, epicIndex) => {
          const isExpanded = expandedEpics.has(epic.id);
          const epicProgress = epic.stories.length > 0
            ? Math.round((epic.completedStories / epic.stories.length) * 100)
            : 0;

          return (
            <div key={epic.id} className="rounded-lg border border-slate-800 bg-slate-900/50">
              {/* Epic Header */}
              <button
                onClick={() => toggleEpic(epic.id)}
                className="w-full p-4 text-left transition-colors hover:bg-slate-900/80"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Epic {epicIndex + 1}</span>
                      <h4 className="text-lg font-semibold text-white">{epic.title}</h4>
                      <span className={`ml-2 text-sm font-medium ${getPriorityColor(epic.priority)}`}>
                        {epic.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{epic.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium text-white ${getStatusBadgeColor(epic.status)}`}>
                      {epic.status}
                    </span>
                    <span className="text-slate-400">{isExpanded ? '▼' : '▶'}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{epic.completedStories}/{epic.stories.length} stories</span>
                    <span className="font-medium text-slate-300">{epicProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{ width: `${epicProgress}%` }}
                    />
                  </div>
                </div>
              </button>

              {/* Stories */}
              {isExpanded && (
                <div className="border-t border-slate-800 p-4">
                  <div className="flex flex-col gap-3">
                    {epic.stories.map((story, storyIndex) => {
                      const isStoryExpanded = expandedStories.has(story.id);
                      const completedCriteria = story.acceptanceCriteria.filter(c => c.completed).length;

                      return (
                        <div key={story.id} className="rounded-lg border border-slate-700 bg-slate-800/50">
                          {/* Story Header */}
                          <button
                            onClick={() => toggleStory(story.id)}
                            className="w-full p-3 text-left transition-colors hover:bg-slate-800/80"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500">
                                    {epicIndex + 1}.{storyIndex + 1}
                                  </span>
                                  <h5 className="font-medium text-white">{story.title}</h5>
                                  <span className={`ml-2 text-xs font-medium ${getPriorityColor(story.priority)}`}>
                                    {story.priority}
                                  </span>
                                </div>
                                {story.assignedPersonas.length > 0 && (
                                  <div className="mt-1 text-xs text-slate-500">
                                    Assigned: {story.assignedPersonas.join(', ')}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${getStatusBadgeColor(story.status)}`}>
                                  {story.status}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {completedCriteria}/{story.acceptanceCriteria.length} ✓
                                </span>
                                <span className="text-slate-400">{isStoryExpanded ? '▼' : '▶'}</span>
                              </div>
                            </div>
                          </button>

                          {/* Story Details */}
                          {isStoryExpanded && (
                            <div className="border-t border-slate-700 p-3">
                              <p className="mb-3 text-sm text-slate-300">{story.description}</p>

                              {/* Acceptance Criteria */}
                              <div className="mb-3">
                                <h6 className="mb-2 text-xs font-semibold uppercase text-slate-400">
                                  Acceptance Criteria
                                </h6>
                                <div className="flex flex-col gap-1.5">
                                  {story.acceptanceCriteria.map((criteria, idx) => (
                                    <div
                                      key={criteria.id}
                                      className={`flex items-start gap-2 rounded p-2 text-sm ${
                                        criteria.completed ? 'bg-green-900/20' : 'bg-slate-900/50'
                                      }`}
                                    >
                                      <span className={criteria.completed ? 'text-green-400' : 'text-slate-500'}>
                                        {criteria.completed ? '✅' : '⬜'}
                                      </span>
                                      <div className="flex-1">
                                        <div className="text-slate-300">
                                          {idx + 1}. {criteria.description}
                                          {criteria.isBlocking && (
                                            <span className="ml-2 text-xs text-orange-400">(blocking)</span>
                                          )}
                                        </div>
                                        {criteria.completed && criteria.verifiedBy && (
                                          <div className="mt-1 text-xs text-slate-500">
                                            Verified by {criteria.verifiedBy}
                                            {criteria.evidence && ` - ${criteria.evidence}`}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Tags */}
                              {story.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {story.tags.map(tag => (
                                    <span key={tag} className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

