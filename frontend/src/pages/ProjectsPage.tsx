import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ApiConfig } from '../types';
import { buildAuthHeaders } from '../utils';

type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'published' | 'in_development' | 'completed' | 'archived';
  projectType?: string;
  epicCount: number;
  storyCount: number;
  completedStories: number;
  progressPercentage: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectsPageProps = {
  config: ApiConfig;
  connectionStatus: 'idle' | 'connected' | 'disconnected';
  onConnectionStatusChange: (status: 'idle' | 'connected' | 'disconnected') => void;
};

export function ProjectsPage({
  config,
  connectionStatus,
  onConnectionStatusChange
}: ProjectsPageProps) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const canCallApi = useMemo(
    () => config.baseUrl.trim().length > 0 && config.token.trim().length > 0,
    [config.baseUrl, config.token]
  );

  const refreshProjects = useCallback(async () => {
    if (!canCallApi) {
      onConnectionStatusChange('disconnected');
      setProjects([]);
      return;
    }
    try {
      setLoading(true);
      setErrorMessage(null);
      
      const url = filterStatus === 'all'
        ? new URL('/api/projects', config.baseUrl)
        : new URL(`/api/projects?status=${filterStatus}`, config.baseUrl);
      
      const response = await fetch(url.toString(), {
        headers: buildAuthHeaders(config)
      });
      
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      
      const body = await response.json();
      setProjects(body.data ?? []);
      onConnectionStatusChange('connected');
    } catch (error) {
      onConnectionStatusChange('disconnected');
      setErrorMessage(`Failed to fetch projects: ${(error as Error).message}`);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [canCallApi, filterStatus, config.baseUrl, config, onConnectionStatusChange]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-500';
      case 'published':
        return 'bg-blue-500';
      case 'in_development':
        return 'bg-yellow-500';
      case 'completed':
        return 'bg-green-500';
      case 'archived':
        return 'bg-gray-700';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Projects</h2>
          <p className="text-sm text-slate-400">
            View and manage agent-native projects with requirements and tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshProjects}
            disabled={!canCallApi || loading}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {['all', 'draft', 'published', 'in_development', 'completed', 'archived'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filterStatus === status
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-red-400">
          {errorMessage}
        </div>
      )}

      {/* Connection Status Warning */}
      {!canCallApi && (
        <div className="rounded-lg border border-yellow-800 bg-yellow-900/20 p-4 text-yellow-400">
          Please configure API connection in the header to view projects
        </div>
      )}

      {/* Projects List */}
      {canCallApi && !loading && projects.length === 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
          <p className="text-slate-400">
            {filterStatus === 'all'
              ? 'No projects found. Create one using the AI Assistant!'
              : `No ${filterStatus} projects found.`}
          </p>
        </div>
      )}

      {canCallApi && projects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-left transition-colors hover:border-slate-700 hover:bg-slate-900/80 hover:cursor-pointer"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="truncate text-lg font-semibold text-white" title={project.name}>
                    {project.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {project.projectType || 'unspecified'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium text-white ${getStatusBadgeColor(
                    project.status
                  )}`}
                >
                  {project.status}
                </span>
              </div>

              {/* Description */}
              <p className="line-clamp-2 text-sm text-slate-400">
                {project.description}
              </p>

              {/* Progress Bar */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Progress</span>
                  <span className="font-medium text-slate-300">
                    {project.progressPercentage}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${project.progressPercentage}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-slate-800/50 px-2 py-1">
                  <div className="text-slate-500">Epics</div>
                  <div className="font-medium text-white">{project.epicCount}</div>
                </div>
                <div className="rounded bg-slate-800/50 px-2 py-1">
                  <div className="text-slate-500">Stories</div>
                  <div className="font-medium text-white">
                    {project.completedStories}/{project.storyCount}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-800 pt-3">
                <p className="text-xs text-slate-500">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500"></div>
        </div>
      )}
    </div>
  );
}

