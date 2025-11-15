import { useEffect, useState } from 'react';

import type { PersonaSpec } from '../types';
import {
  formatIdForDisplay,
  getMcpIdError,
  getPersonaResourceUri,
  getPersonaToolName,
  isValidMcpId,
  sanitizeMcpId
} from '../utils/mcpValidation';

type PersonaEditorProps = {
  value: PersonaSpec;
  onChange: (spec: PersonaSpec) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  statusMessage: string | null;
};

type SpecificationForm = {
  mission: string;
  inputs: string[];
  workflow: string[];
  success_criteria: string[];
  constraints: string[];
};

// Complex fields that should be preserved as-is (not edited in form view)
const COMPLEX_FIELDS = [
  'handoff_expectations',
  'interaction_prompts',
  'acceptance_tests',
  'tools',
  'error_handling',
  'authorization',
  'provenance_rules',
  'scoring',
  'locale_handling',
  'safety',
  'expected_inputs_schema'
] as const;

function parseSpecification(spec: Record<string, unknown>): {
  form: SpecificationForm;
  complexFields: Record<string, unknown>;
} {
  const form: SpecificationForm = {
    mission: (spec.mission as string) || '',
    inputs: Array.isArray(spec.inputs) 
      ? spec.inputs.map(item => typeof item === 'string' ? item : JSON.stringify(item))
      : [],
    workflow: Array.isArray(spec.workflow) 
      ? spec.workflow.map(item => typeof item === 'string' ? item : JSON.stringify(item))
      : [],
    success_criteria: Array.isArray(spec.success_criteria) 
      ? spec.success_criteria.map(item => typeof item === 'string' ? item : JSON.stringify(item))
      : [],
    constraints: Array.isArray(spec.constraints) 
      ? spec.constraints.map(item => typeof item === 'string' ? item : JSON.stringify(item))
      : []
  };

  // Preserve complex fields
  const complexFields: Record<string, unknown> = {};
  for (const field of COMPLEX_FIELDS) {
    if (spec[field] !== undefined) {
      complexFields[field] = spec[field];
    }
  }

  return { form, complexFields };
}

function buildSpecification(form: SpecificationForm, complexFields: Record<string, unknown>): Record<string, unknown> {
  const spec: Record<string, unknown> = { ...complexFields };
  
  if (form.mission.trim()) spec.mission = form.mission.trim();
  if (form.inputs.length > 0) {
    spec.inputs = form.inputs
      .filter((i) => i.trim())
      .map(item => {
        // Try to parse as JSON, if fails return as string
        try {
          return JSON.parse(item);
        } catch {
          return item;
        }
      });
  }
  if (form.workflow.length > 0) {
    spec.workflow = form.workflow
      .filter((w) => w.trim())
      .map(item => {
        try {
          return JSON.parse(item);
        } catch {
          return item;
        }
      });
  }
  if (form.success_criteria.length > 0) {
    spec.success_criteria = form.success_criteria
      .filter((s) => s.trim())
      .map(item => {
        try {
          return JSON.parse(item);
        } catch {
          return item;
        }
      });
  }
  if (form.constraints.length > 0) {
    spec.constraints = form.constraints
      .filter((c) => c.trim())
      .map(item => {
        try {
          return JSON.parse(item);
        } catch {
          return item;
        }
      });
  }
  
  return spec;
}

export function PersonaEditor({ value, onChange, onSave, isSaving, statusMessage }: PersonaEditorProps) {
  const [id, setId] = useState(value.id || '');
  const [name, setName] = useState(value.name || '');
  const [tags, setTags] = useState(value.tags?.join(', ') || '');
  const [webSearchEnabled, setWebSearchEnabled] = useState(
    (value.metadata?.web_search_enabled as boolean) || false
  );
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form');
  const [parsedSpec, setParsedSpec] = useState(() => parseSpecification(value.specification || {}));
  const [specForm, setSpecForm] = useState<SpecificationForm>(parsedSpec.form);
  const [complexFields, setComplexFields] = useState<Record<string, unknown>>(parsedSpec.complexFields);
  const [specText, setSpecText] = useState(JSON.stringify(value.specification || {}, null, 2));
  const [specError, setSpecError] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);

  useEffect(() => {
    setId(value.id || '');
    setName(value.name || '');
    setTags(value.tags?.join(', ') || '');
    setWebSearchEnabled((value.metadata?.web_search_enabled as boolean) || false);
    const parsed = parseSpecification(value.specification || {});
    setParsedSpec(parsed);
    setSpecForm(parsed.form);
    setComplexFields(parsed.complexFields);
    setSpecText(JSON.stringify(value.specification || {}, null, 2));
    setSpecError(null);
  }, [value]);

  const handleIdChange = (newId: string) => {
    const sanitized = sanitizeMcpId(newId);
    setId(sanitized);
    const error = getMcpIdError(sanitized);
    setIdError(error);
    onChange({ ...value, id: sanitized });
  };

  const handleNameChange = (newName: string) => {
    setName(newName);
    onChange({ ...value, name: newName });
  };

  const handleTagsChange = (tagsStr: string) => {
    setTags(tagsStr);
    const tagArray = tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    onChange({ ...value, tags: tagArray });
  };

  const handleWebSearchChange = (enabled: boolean) => {
    setWebSearchEnabled(enabled);
    onChange({
      ...value,
      metadata: {
        ...value.metadata,
        web_search_enabled: enabled
      }
    });
  };

  const handleSpecFormChange = (field: keyof SpecificationForm, fieldValue: string | string[]) => {
    const updated = { ...specForm, [field]: fieldValue };
    setSpecForm(updated);
    const spec = buildSpecification(updated, complexFields);
    onChange({ ...value, specification: spec });
  };

  const handleArrayItemAdd = (field: keyof SpecificationForm) => {
    const current = (specForm[field] || []) as string[];
    handleSpecFormChange(field, [...current, '']);
  };

  const handleArrayItemChange = (field: keyof SpecificationForm, index: number, value: string) => {
    const current = specForm[field] as string[];
    const updated = [...current];
    updated[index] = value;
    handleSpecFormChange(field, updated);
  };

  const handleArrayItemRemove = (field: keyof SpecificationForm, index: number) => {
    const current = specForm[field] as string[];
    const updated = current.filter((_, i) => i !== index);
    handleSpecFormChange(field, updated);
  };

  const handleSpecTextChange = (text: string) => {
    setSpecText(text);
    try {
      const parsed = JSON.parse(text);
      onChange({ ...value, specification: parsed });
      setSpecError(null);
      // Sync form view if user switches back
      const parsedSpec = parseSpecification(parsed);
      setParsedSpec(parsedSpec);
      setSpecForm(parsedSpec.form);
      setComplexFields(parsedSpec.complexFields);
    } catch (error) {
      setSpecError((error as Error).message);
    }
  };

  const handleViewModeChange = (mode: 'form' | 'json') => {
    if (mode === 'json') {
      // Update JSON text from current form and complex fields
      const spec = buildSpecification(specForm, complexFields);
      setSpecText(JSON.stringify(spec, null, 2));
    } else {
      // Update form from JSON text
      try {
        const parsed = JSON.parse(specText);
        const parsedSpec = parseSpecification(parsed);
        setParsedSpec(parsedSpec);
        setSpecForm(parsedSpec.form);
        setComplexFields(parsedSpec.complexFields);
        setSpecError(null);
      } catch (error) {
        // Keep showing error, don't switch
        return;
      }
    }
    setViewMode(mode);
  };

  const handleSave = async () => {
    if (specError || idError || !isValidMcpId(id)) {
      return;
    }
    await onSave();
  };

  const renderArrayField = (
    field: keyof SpecificationForm,
    label: string,
    hint: string,
    placeholder: string
  ) => {
    const items = (specForm[field] || []) as string[];
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
          <button
            type="button"
            onClick={() => handleArrayItemAdd(field)}
            className="text-xs text-brand hover:text-brand-light"
          >
            + Add Item
          </button>
        </div>
        <p className="text-xs text-slate-500">{hint}</p>
        <div className="flex flex-col gap-2">
          {items.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-500">
              No items yet. Click "+ Add Item" to add one.
            </div>
          ) : (
            items.map((item, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
                  value={item}
                  onChange={(e) => handleArrayItemChange(field, index, e.target.value)}
                  placeholder={placeholder}
                />
                <button
                  type="button"
                  onClick={() => handleArrayItemRemove(field, index)}
                  className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Persona Editor</h2>
          {statusMessage ? <span className="text-xs text-slate-400">{statusMessage}</span> : null}
        </div>
        <div className="flex gap-2 rounded-md border border-slate-800 bg-slate-950 p-1">
          <button
            type="button"
            onClick={() => handleViewModeChange('form')}
            className={`rounded px-3 py-1 text-xs font-semibold transition ${
              viewMode === 'form'
                ? 'bg-brand text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Form View
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange('json')}
            className={`rounded px-3 py-1 text-xs font-semibold transition ${
              viewMode === 'json'
                ? 'bg-brand text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            JSON View
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            ID <span className="text-brand">*</span>
          </label>
          <input
            className={`rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/50 ${
              idError ? 'border-red-500 bg-slate-950' : 'border-slate-800 bg-slate-950 focus:border-brand'
            }`}
            value={id}
            onChange={(e) => handleIdChange(e.target.value)}
            placeholder="e.g., seo_specialist"
          />
          {idError ? (
            <p className="text-xs text-red-400">{idError}</p>
          ) : (
            <p className="text-xs text-slate-500">
              MCP-compliant ID (lowercase, alphanumeric, underscores/dashes/dots only)
            </p>
          )}
          {id && isValidMcpId(id) && (
            <div className="mt-1 rounded-md bg-slate-900/60 px-2 py-1.5 text-xs">
              <div className="text-slate-400">MCP Tool:</div>
              <div className="font-mono text-slate-200">{getPersonaToolName(id)}</div>
              <div className="mt-1 text-slate-400">Resource URI:</div>
              <div className="font-mono text-slate-200">{getPersonaResourceUri(id)}</div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Name <span className="text-brand">*</span>
          </label>
          <input
            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g., SEO Specialist"
          />
          <p className="text-xs text-slate-500">Human-friendly display name</p>
        </div>

        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tags</label>
          <input
            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
            value={tags}
            onChange={(e) => handleTagsChange(e.target.value)}
            placeholder="seo, content, review (comma-separated)"
          />
          <p className="text-xs text-slate-500">Optional tags for filtering/grouping</p>
        </div>

        <div className="flex flex-col gap-1 md:col-span-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="web-search-enabled"
              checked={webSearchEnabled}
              onChange={(e) => handleWebSearchChange(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-brand focus:ring-2 focus:ring-brand/50"
            />
            <label htmlFor="web-search-enabled" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Enable Web Search
            </label>
          </div>
          <p className="text-xs text-slate-500 ml-6">
            When enabled, the executing agent will be instructed to use web search to gather current information and verify facts.
          </p>
        </div>
      </div>

      {viewMode === 'form' ? (
        <div className="flex flex-col gap-6 rounded-xl border border-slate-900 bg-slate-950/60 p-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Mission <span className="text-brand">*</span>
            </label>
            <p className="text-xs text-slate-500">
              Define the persona's primary purpose and role. What is this persona designed to do?
            </p>
            <textarea
              className="min-h-[80px] rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
              value={specForm.mission}
              onChange={(e) => handleSpecFormChange('mission', e.target.value)}
              placeholder="e.g., Provide structured SEO review instructions for long-form content."
            />
          </div>

          {renderArrayField(
            'inputs',
            'Inputs',
            'List what inputs or data this persona expects to receive. What information does it need to work?',
            'e.g., Draft text, Target keyword'
          )}

          {renderArrayField(
            'workflow',
            'Workflow Steps',
            'Define the step-by-step process this persona follows. How does it approach the task?',
            'e.g., Scan the brief to understand the target audience...'
          )}

          {renderArrayField(
            'success_criteria',
            'Success Criteria',
            'Specify what success looks like. What conditions must be met for the task to be considered successful?',
            'e.g., Draft addresses target keyword intent within the first 150 words'
          )}

          {renderArrayField(
            'constraints',
            'Constraints',
            'List any limitations, rules, or boundaries. What should this persona avoid or never do?',
            'e.g., Avoid suggesting black-hat tactics'
          )}

          {Object.keys(complexFields).length > 0 && (
            <div className="rounded-md border border-amber-700/50 bg-amber-900/20 p-3">
              <div className="mb-2 flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <label className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                  Complex Fields (JSON View Only)
                </label>
              </div>
              <p className="mb-2 text-xs text-amber-200/80">
                This persona contains complex structured fields that are preserved but not editable in Form View:
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(complexFields).map((field) => (
                  <span
                    key={field}
                    className="rounded bg-amber-900/40 px-2 py-1 text-xs font-mono text-amber-200"
                  >
                    {field}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-amber-200/80">
                Switch to <strong>JSON View</strong> to edit these fields: handoff_expectations, interaction_prompts,
                acceptance_tests, tools, error_handling, etc.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Specification (JSON) <span className="text-brand">*</span>
          </label>
          <textarea
            className="h-[50vh] w-full rounded-md border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
            value={specText}
            onChange={(e) => handleSpecTextChange(e.target.value)}
            placeholder='{"mission": "...", "workflow": [...], "success_criteria": [...]}'
          />
          {specError ? (
            <p className="text-xs text-red-400">JSON Error: {specError}</p>
          ) : (
            <p className="text-xs text-slate-500">
              Advanced: Edit the specification as raw JSON. Switch to Form View for a guided experience.
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={isSaving || specError !== null || idError !== null || !isValidMcpId(id) || !name.trim()}
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          {isSaving ? 'Saving...' : 'Save Persona'}
        </button>
      </div>
    </div>
  );
}
