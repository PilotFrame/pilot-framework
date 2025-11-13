import { useEffect, useState } from 'react';

import type { ApiConfig, PersonaSummary, PersonaSpec, WorkflowSummary } from '../types';
import { buildAuthHeaders } from '../utils';
import {
  formatIdForDisplay,
  getMcpIdError,
  getWorkflowResourceUri,
  getWorkflowToolName,
  isValidMcpId,
  sanitizeMcpId
} from '../utils/mcpValidation';
import { WorkflowPreview } from './WorkflowPreview';

export interface WorkflowStep {
  id: string;
  persona_id: string;
  order: number;
  condition?: string;
  handoff_to?: string;
}

export interface ExecutionSpec {
  description: string;
  flow_pattern?: 'sequential' | 'cycle' | 'parallel' | 'conditional' | 'mixed';
  cycle_details?: {
    cycle_steps: string[];
    exit_condition: string;
    max_iterations?: number;
  };
  parallel_details?: {
    parallel_steps: string[];
    merge_strategy?: 'all' | 'any' | 'majority';
    description?: string;
  };
  conditional_branches?: Array<{
    condition: string;
    target_step: string;
    description?: string;
  }>;
  execution_guidance?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  steps: WorkflowStep[];
  execution_spec?: ExecutionSpec;
  metadata?: Record<string, unknown>;
}

type WorkflowEditorProps = {
  personas: PersonaSummary[];
  apiConfig: ApiConfig;
  workflows: WorkflowSummary[];
  selectedWorkflowId: string | null;
  onSelectWorkflow: (id: string) => void;
  onCreateWorkflow: () => void;
  onWorkflowChange: (workflow: WorkflowDefinition | null) => void;
  workflow: WorkflowDefinition | null;
};

export function WorkflowEditor({
  personas,
  apiConfig,
  workflows,
  selectedWorkflowId,
  onSelectWorkflow,
  onCreateWorkflow,
  onWorkflowChange,
  workflow
}: WorkflowEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [workflowIdError, setWorkflowIdError] = useState<string | null>(null);
  const [personaSpecs, setPersonaSpecs] = useState<Map<string, PersonaSpec>>(new Map());
  const [loadingSpecs, setLoadingSpecs] = useState(false);

  const handleSaveWorkflow = async () => {
    if (!workflow || !workflow.id.trim() || !workflow.name.trim()) {
      return;
    }
    try {
      setIsSaving(true);
      const response = await fetch(new URL('/api/workflows', apiConfig.baseUrl).toString(), {
        method: 'POST',
        headers: buildAuthHeaders(apiConfig),
        body: JSON.stringify(workflow)
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      setStatusMessage(`Saved ${workflow.name}`);
      // Reload workflows list by calling onSelectWorkflow with the saved workflow ID
      onSelectWorkflow(workflow.id);
    } catch (error) {
      setStatusMessage(`Save failed: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const addStep = () => {
    if (!workflow) return;
    const steps = workflow.steps || [];
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      persona_id: personas[0]?.id || '',
      order: steps.length + 1
    };
    onWorkflowChange({ ...workflow, steps: [...steps, newStep] });
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    if (!workflow) return;
    const steps = workflow.steps || [];
    onWorkflowChange({
      ...workflow,
      steps: steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s))
    });
  };

  const removeStep = (stepId: string) => {
    if (!workflow) return;
    const steps = workflow.steps || [];
    onWorkflowChange({
      ...workflow,
      steps: steps.filter((s) => s.id !== stepId).map((s, idx) => ({ ...s, order: idx + 1 }))
    });
  };

  // Ensure workflow has steps array
  useEffect(() => {
    if (workflow && !workflow.steps) {
      onWorkflowChange({ ...workflow, steps: [] });
    }
  }, [workflow]);

  // Load persona specifications for preview
  useEffect(() => {
    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
      setPersonaSpecs(new Map());
      return;
    }

    const loadPersonaSpecs = async () => {
      setLoadingSpecs(true);
      const specs = new Map<string, PersonaSpec>();
      const uniquePersonaIds = [...new Set(workflow.steps.map((s) => s.persona_id).filter(Boolean))];

      for (const personaId of uniquePersonaIds) {
        try {
          const response = await fetch(new URL(`/api/personas/${personaId}/spec`, apiConfig.baseUrl).toString(), {
            headers: buildAuthHeaders(apiConfig)
          });
          if (response.ok) {
            const body = await response.json();
            specs.set(personaId, body.data as PersonaSpec);
          }
        } catch (error) {
          console.warn(`Failed to load persona spec for ${personaId}:`, error);
        }
      }

      setPersonaSpecs(specs);
      setLoadingSpecs(false);
    };

    loadPersonaSpecs();
  }, [workflow, apiConfig]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Workflow Editor</h2>
        {statusMessage ? <span className="text-xs text-slate-400">{statusMessage}</span> : null}
      </div>

      {workflow ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Workflow ID <span className="text-brand">*</span>
              </label>
              <input
                className={`rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/50 ${
                  workflowIdError ? 'border-red-500 bg-slate-950' : 'border-slate-800 bg-slate-950 focus:border-brand'
                }`}
                value={workflow.id}
                onChange={(e) => {
                  const sanitized = sanitizeMcpId(e.target.value);
                  const error = getMcpIdError(sanitized);
                  setWorkflowIdError(error);
                  onWorkflowChange({ ...workflow, id: sanitized });
                }}
                placeholder="e.g., content_loop"
              />
              {workflowIdError ? (
                <p className="text-xs text-red-400">{workflowIdError}</p>
              ) : (
                <p className="text-xs text-slate-500">
                  MCP-compliant ID (lowercase, alphanumeric, underscores/dashes/dots only)
                </p>
              )}
              {workflow.id && isValidMcpId(workflow.id) && (
                <div className="mt-1 rounded-md bg-slate-900/60 px-2 py-1.5 text-xs">
                  <div className="text-slate-400">MCP Tool:</div>
                  <div className="font-mono text-slate-200">{getWorkflowToolName(workflow.id)}</div>
                  <div className="mt-1 text-slate-400">Resource URI:</div>
                  <div className="font-mono text-slate-200">{getWorkflowResourceUri(workflow.id)}</div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Name <span className="text-brand">*</span>
              </label>
              <input
                className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
                value={workflow.name}
                onChange={(e) => onWorkflowChange({ ...workflow, name: e.target.value })}
                placeholder="e.g., Content Creation Loop"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Steps</label>
              <button
                type="button"
                onClick={addStep}
                className="rounded-md bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                + Add Step
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {(workflow.steps || [])
                .sort((a, b) => a.order - b.order)
                .map((step) => (
                  <div key={step.id} className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-400">Persona</label>
                        <select
                          className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
                          value={step.persona_id}
                          onChange={(e) => updateStep(step.id, { persona_id: e.target.value })}
                        >
                          <option value="">Select persona...</option>
                          {personas.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-400">Condition (optional)</label>
                        <input
                          className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
                          value={step.condition || ''}
                          onChange={(e) => updateStep(step.id, { condition: e.target.value || undefined })}
                          placeholder="e.g., score > 0.75"
                        />
                      </div>

                      <div className="flex items-end gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-400">Handoff To (optional)</label>
                          <input
                            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
                            value={step.handoff_to || ''}
                            onChange={(e) => updateStep(step.id, { handoff_to: e.target.value || undefined })}
                            placeholder="Next step ID"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStep(step.id)}
                          className="rounded-md bg-red-900/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-900/60"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Execution Specification Editor */}
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Execution Specification <span className="text-brand">*</span>
              </label>
              <span className="text-xs text-slate-500">
                Describe how the workflow executes - cycles, parallel execution, conditions, etc.
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-300">Flow Pattern</label>
                <select
                  className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
                  value={workflow.execution_spec?.flow_pattern || 'sequential'}
                  onChange={(e) =>
                    onWorkflowChange({
                      ...workflow,
                      execution_spec: {
                        ...(workflow.execution_spec || { description: '' }),
                        flow_pattern: e.target.value as ExecutionSpec['flow_pattern']
                      }
                    })
                  }
                >
                  <option value="sequential">Sequential</option>
                  <option value="cycle">Cycle</option>
                  <option value="parallel">Parallel</option>
                  <option value="conditional">Conditional</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-300">
                  Execution Description <span className="text-brand">*</span>
                </label>
                <textarea
                  className="min-h-[120px] rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
                  value={workflow.execution_spec?.description || ''}
                  onChange={(e) =>
                    onWorkflowChange({
                      ...workflow,
                      execution_spec: {
                        ...(workflow.execution_spec || { description: '' }),
                        description: e.target.value
                      }
                    })
                  }
                  placeholder="Describe how the workflow executes. Include cycles, parallel execution, conditions, etc. Example: 'This workflow starts with collecting requirements, then enters a refinement cycle between content writer and SEO reviewer until both scores exceed 0.8...'"
                />
                <p className="text-xs text-slate-500">
                  This description is what AI agents will read to understand how to execute the workflow.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-300">Execution Guidance (Optional)</label>
                <textarea
                  className="min-h-[80px] rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
                  value={workflow.execution_spec?.execution_guidance || ''}
                  onChange={(e) =>
                    onWorkflowChange({
                      ...workflow,
                      execution_spec: {
                        ...(workflow.execution_spec || { description: '' }),
                        execution_guidance: e.target.value || undefined
                      }
                    })
                  }
                  placeholder="Step-by-step guidance for agents (optional). Example: '1. Start with collect_requirements. 2. Pass to write_content. 3. Enter cycle...'"
                />
              </div>

              {/* Cycle Details */}
              {(workflow.execution_spec?.flow_pattern === 'cycle' ||
                workflow.execution_spec?.flow_pattern === 'mixed') && (
                <div className="rounded-md border border-slate-700 bg-slate-900/40 p-3">
                  <label className="text-xs font-semibold text-slate-300">Cycle Details</label>
                  <div className="mt-2 flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400">Cycle Steps (comma-separated step IDs)</label>
                      <input
                        className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
                        value={workflow.execution_spec?.cycle_details?.cycle_steps?.join(', ') || ''}
                        onChange={(e) =>
                          onWorkflowChange({
                            ...workflow,
                            execution_spec: {
                              ...(workflow.execution_spec || { description: '' }),
                              cycle_details: {
                                ...workflow.execution_spec?.cycle_details,
                                cycle_steps: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                                exit_condition: workflow.execution_spec?.cycle_details?.exit_condition || ''
                              }
                            }
                          })
                        }
                        placeholder="e.g., write_content, seo_review, accuracy_review"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400">Exit Condition</label>
                      <input
                        className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
                        value={workflow.execution_spec?.cycle_details?.exit_condition || ''}
                        onChange={(e) =>
                          onWorkflowChange({
                            ...workflow,
                            execution_spec: {
                              ...(workflow.execution_spec || { description: '' }),
                              cycle_details: {
                                ...workflow.execution_spec?.cycle_details,
                                cycle_steps: workflow.execution_spec?.cycle_details?.cycle_steps || [],
                                exit_condition: e.target.value
                              }
                            }
                          })
                        }
                        placeholder="e.g., seo_score > 0.8 AND accuracy_score > 0.8"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {(workflow.steps || []).length > 0 && (
            <WorkflowPreview workflow={workflow} personas={personas} personaSpecs={personaSpecs} />
          )}

          <div className="flex items-center justify-end gap-3">
            {statusMessage ? <span className="text-xs text-slate-400">{statusMessage}</span> : null}
            <button
              type="button"
              disabled={
                isSaving ||
                workflowIdError !== null ||
                !isValidMcpId(workflow.id) ||
                !workflow.name.trim() ||
                !workflow.execution_spec?.description?.trim()
              }
              onClick={handleSaveWorkflow}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {isSaving ? 'Saving...' : 'Save Workflow'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex h-60 items-center justify-center text-sm text-slate-500">
          Create a new workflow or select one from the list.
        </div>
      )}
    </div>
  );
}

