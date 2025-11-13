import type { PersonaSummary, PersonaSpec } from '../types';
import type { WorkflowDefinition, WorkflowStep } from './WorkflowEditor';

type WorkflowPreviewProps = {
  workflow: WorkflowDefinition;
  personas: PersonaSummary[];
  personaSpecs: Map<string, PersonaSpec>;
};

export function WorkflowPreview({ workflow, personas, personaSpecs }: WorkflowPreviewProps) {
  const sortedSteps = (workflow.steps || []).sort((a, b) => a.order - b.order);
  const executionSpec = workflow.execution_spec;
  
  // Create persona map for quick lookup
  const personaMap = new Map<string, PersonaSummary>();
  personas.forEach((p) => personaMap.set(p.id, p));

  const getStepDetails = (step: WorkflowStep) => {
    const persona = personaMap.get(step.persona_id);
    const personaSpec = personaSpecs.get(step.persona_id);
    const spec = personaSpec?.specification as Record<string, unknown> | undefined;
    
    return {
      personaName: persona?.name || step.persona_id,
      stepId: step.id,
      order: step.order,
      condition: step.condition,
      mission: spec?.mission as string | undefined,
      inputs: spec?.inputs as string[] | undefined,
      handoffExpectations: spec?.handoff_expectations as string[] | undefined,
      workflowSteps: spec?.workflow as string[] | undefined
    };
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Workflow Execution Preview</h3>
      
      {executionSpec?.description && (
        <div className="rounded-md border border-blue-900/40 bg-blue-900/20 p-3 mb-4">
          <div className="text-xs font-semibold text-blue-300 mb-2">Execution Specification:</div>
          <div className="text-xs text-blue-200 whitespace-pre-wrap">{executionSpec.description}</div>
          {executionSpec.execution_guidance && (
            <div className="mt-3 pt-3 border-t border-blue-900/40">
              <div className="text-xs font-semibold text-blue-300 mb-2">Execution Guidance:</div>
              <div className="text-xs text-blue-200 whitespace-pre-wrap">{executionSpec.execution_guidance}</div>
            </div>
          )}
        </div>
      )}

      {executionSpec?.cycle_details && (
        <div className="rounded-md border border-purple-900/40 bg-purple-900/20 p-3 mb-4">
          <div className="text-xs font-semibold text-purple-300 mb-2">Cycle Details:</div>
          <div className="text-xs text-purple-200">
            <div>Cycle Steps: {executionSpec.cycle_details.cycle_steps.join(', ')}</div>
            <div className="mt-1">Exit Condition: {executionSpec.cycle_details.exit_condition}</div>
            <div className="mt-1">Max Iterations: {executionSpec.cycle_details.max_iterations || 10}</div>
          </div>
        </div>
      )}

      {executionSpec?.parallel_details && (
        <div className="rounded-md border border-green-900/40 bg-green-900/20 p-3 mb-4">
          <div className="text-xs font-semibold text-green-300 mb-2">Parallel Execution:</div>
          <div className="text-xs text-green-200">
            <div>Parallel Steps: {executionSpec.parallel_details.parallel_steps.join(', ')}</div>
            <div className="mt-1">Merge Strategy: {executionSpec.parallel_details.merge_strategy || 'all'}</div>
            {executionSpec.parallel_details.description && (
              <div className="mt-1">{executionSpec.parallel_details.description}</div>
            )}
          </div>
        </div>
      )}

      <div className="text-xs text-slate-400 mb-3">
        The workflow steps are listed below. Refer to the execution specification above for how these steps interact (cycles, parallel execution, conditions, etc.).
      </div>

      <div className="flex flex-col gap-4">
        {sortedSteps.map((step) => {
          const details = getStepDetails(step);

          return (
            <div key={step.id} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/20 text-sm font-semibold text-brand">
                {step.order}
              </div>
              <div className="flex-1 rounded-md border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-200">{details.stepId}</h4>
                  {details.condition && (
                    <span className="rounded bg-yellow-900/30 px-2 py-0.5 text-xs text-yellow-400">
                      Condition: {details.condition}
                    </span>
                  )}
                </div>
                
                <div className="mt-2 text-xs">
                  <div className="text-slate-400">
                    <span className="font-medium">Persona:</span> {details.personaName}
                  </div>
                  <div className="mt-1 text-slate-500">
                    Tool: <code className="rounded bg-slate-800 px-1 py-0.5">persona.{step.persona_id}.get_specification</code>
                  </div>
                </div>

                {details.mission && (
                  <div className="mt-3 rounded-md border border-slate-700 bg-slate-900/40 p-2">
                    <div className="text-xs font-semibold text-slate-300">Purpose:</div>
                    <div className="mt-1 text-xs text-slate-400">{details.mission}</div>
                  </div>
                )}

                {details.workflowSteps && details.workflowSteps.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-slate-300">What This Step Does:</div>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-slate-400">
                      {details.workflowSteps.map((ws, idx) => (
                        <li key={idx}>{ws}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {details.inputs && details.inputs.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-slate-300">Expected Inputs:</div>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-slate-400">
                      {details.inputs.map((input, idx) => (
                        <li key={idx}>{input}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {details.handoffExpectations && details.handoffExpectations.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-slate-300">Output/Handoff:</div>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-slate-400">
                      {details.handoffExpectations.map((expectation, idx) => (
                        <li key={idx}>{expectation}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 rounded-md border border-blue-900/40 bg-blue-900/20 p-3">
        <p className="text-xs text-blue-300">
          <strong>Note:</strong> When an AI agent calls this workflow via MCP, it will receive detailed instructions including:
          what each persona does, their expected inputs/outputs, and how to execute each step. The agent will call{' '}
          <code className="rounded bg-blue-900/40 px-1 py-0.5">persona.{'{id}'}.get_specification</code> for each step
          to get the full persona instructions.
        </p>
      </div>
    </div>
  );
}

