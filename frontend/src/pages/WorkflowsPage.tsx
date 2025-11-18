import { useEffect, useState, useCallback } from 'react';

import { WorkflowEditor } from '../components/WorkflowEditor';
import { WorkflowList } from '../components/WorkflowList';
import { AIPilot } from '../components/AIPilot';
import type { ApiConfig, PersonaSummary, WorkflowSummary } from '../types';
import { buildAuthHeaders } from '../utils';
import type { WorkflowDefinition } from '../components/WorkflowEditor';

type WorkflowsPageProps = {
  config: ApiConfig;
  connectionStatus: 'idle' | 'connected' | 'disconnected';
};

export function WorkflowsPage({ config, connectionStatus }: WorkflowsPageProps) {
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showAIPilot, setShowAIPilot] = useState(false);

  const canCallApi = config.baseUrl.trim().length > 0 && config.token.trim().length > 0;

  useEffect(() => {
    if (canCallApi) {
      const loadPersonas = async () => {
        try {
          setPersonaLoading(true);
          const response = await fetch(new URL('/api/personas', config.baseUrl).toString(), {
            headers: buildAuthHeaders(config)
          });
          if (response.ok) {
            const body = await response.json();
            setPersonas(body.data ?? []);
          }
        } catch (error) {
          console.error('Failed to load personas:', error);
        } finally {
          setPersonaLoading(false);
        }
      };
      loadPersonas();

      const loadWorkflows = async () => {
        try {
          setWorkflowLoading(true);
          console.log('Loading workflows from:', config.baseUrl);
          const response = await fetch(new URL('/api/workflows', config.baseUrl).toString(), {
            headers: buildAuthHeaders(config)
          });
          console.log('Workflows API response status:', response.status);
          if (response.ok) {
            const body = await response.json();
            console.log('Loaded workflows:', body.data);
            setWorkflows(body.data ?? []);
          } else {
            const errorText = await response.text();
            console.error('Failed to load workflows:', response.status, response.statusText, errorText);
          }
        } catch (error) {
          console.error('Failed to load workflows:', error);
        } finally {
          setWorkflowLoading(false);
        }
      };
      loadWorkflows();
    }
  }, [config, canCallApi]);

  const handleSelectWorkflow = async (id: string) => {
    if (id === 'new') {
      setSelectedWorkflowId('new');
      setWorkflow({
        id: '',
        name: '',
        steps: []
      });
      return;
    }
    try {
      const response = await fetch(new URL(`/api/workflows/${id}`, config.baseUrl).toString(), {
        headers: buildAuthHeaders(config)
      });
      if (response.ok) {
        const body = await response.json();
        const workflowData = body.data;
        // Ensure workflow has required fields
        if (!workflowData.steps) {
          workflowData.steps = [];
        }
        // Ensure execution_spec exists if workflow has one
        if (workflowData.execution_spec && !workflowData.execution_spec.description) {
          workflowData.execution_spec.description = '';
        }
        setSelectedWorkflowId(id);
        setWorkflow(workflowData);
      } else {
        const errorText = await response.text();
        console.error('Failed to load workflow:', response.status, response.statusText, errorText);
        setStatusMessage(`Failed to load workflow: ${response.status} ${response.statusText}`);
        setTimeout(() => setStatusMessage(null), 5000);
      }
    } catch (error) {
      console.error('Failed to load workflow:', error);
      setStatusMessage(`Failed to load workflow: ${(error as Error).message}`);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleCreateWorkflow = () => {
    setSelectedWorkflowId('new');
    setWorkflow({
      id: '',
      name: '',
      steps: []
    });
  };

  const reloadWorkflows = async () => {
    try {
      const response = await fetch(new URL('/api/workflows', config.baseUrl).toString(), {
        headers: buildAuthHeaders(config)
      });
      if (response.ok) {
        const body = await response.json();
        setWorkflows(body.data ?? []);
      }
    } catch (error) {
      console.error('Failed to reload workflows:', error);
    }
  };

  const handleAIPilotSpecUpdate = useCallback((updatedSpec: Record<string, unknown>) => {
    setWorkflow(updatedSpec as WorkflowDefinition);
    setStatusMessage('Workflow updated by AI Pilot');
    setTimeout(() => setStatusMessage(null), 3000);
  }, []);

  const handleAIPilotSpecApply = useCallback((appliedSpec: Record<string, unknown>) => {
    setWorkflow(appliedSpec as WorkflowDefinition);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {statusMessage && (
        <div className="rounded-lg border border-blue-800 bg-blue-900/20 p-4 text-blue-400">
          {statusMessage}
        </div>
      )}

      {/* AI Pilot Toggle Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Workflows</h2>
        <button
          onClick={() => setShowAIPilot(!showAIPilot)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            showAIPilot
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          {showAIPilot ? 'Hide' : 'Show'} AI Pilot
        </button>
      </div>

      {!canCallApi ? (
        <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-4">
          <div className="flex h-60 items-center justify-center text-sm text-slate-500">
            Configure connection in the header to create workflows.
          </div>
        </div>
      ) : connectionStatus === 'disconnected' ? (
        <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-4">
          <div className="flex h-60 items-center justify-center text-sm text-red-400">
            Connection failed. Check your URL and token.
          </div>
        </div>
      ) : (
        <div className={`grid gap-6 ${showAIPilot ? 'lg:grid-cols-[280px,1fr,400px]' : 'lg:grid-cols-[280px,1fr]'}`}>
          <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-4">
            <WorkflowList
              workflows={workflows}
              selectedId={selectedWorkflowId}
              onSelect={handleSelectWorkflow}
              onCreate={handleCreateWorkflow}
            />
            {workflowLoading ? (
              <p className="mt-3 text-xs text-slate-500">Loading workflows...</p>
            ) : workflows.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">No workflows found. Create one to get started.</p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-4">
            {personaLoading ? (
              <div className="flex h-60 items-center justify-center text-sm text-slate-500">
                Loading personas...
              </div>
            ) : (
              <WorkflowEditor
                personas={personas}
                apiConfig={config}
                workflows={workflows}
                selectedWorkflowId={selectedWorkflowId}
                onSelectWorkflow={async (id) => {
                  await handleSelectWorkflow(id);
                  await reloadWorkflows();
                }}
                onCreateWorkflow={handleCreateWorkflow}
                onWorkflowChange={setWorkflow}
                workflow={workflow}
              />
            )}
          </div>

          {/* AI Pilot Panel */}
          {showAIPilot && (
            <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-4">
              <AIPilot
                config={config}
                entityType="workflow"
                currentSpec={workflow || undefined}
                onSpecUpdate={handleAIPilotSpecUpdate}
                onSpecApply={handleAIPilotSpecApply}
                title="Workflow AI Pilot"
                description={
                  workflow
                    ? 'Ask me to update specific parts of this workflow'
                    : 'Describe the workflow you want to create'
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

