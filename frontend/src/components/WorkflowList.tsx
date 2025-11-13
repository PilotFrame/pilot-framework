import type { WorkflowSummary } from '../types';

type WorkflowListProps = {
  workflows: WorkflowSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
};

export function WorkflowList({ workflows, selectedId, onCreate, onSelect }: WorkflowListProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Workflows</h3>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-md bg-brand/20 px-2 py-1 text-xs font-semibold text-brand hover:bg-brand/30"
        >
          + New
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onSelect('new')}
          className={`rounded-md px-3 py-2 text-left text-sm transition ${
            selectedId === 'new'
              ? 'bg-brand/20 text-brand'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <div className="font-medium">Create New Workflow</div>
        </button>
        {workflows.map((wf) => (
          <button
            key={wf.id}
            type="button"
            onClick={() => onSelect(wf.id)}
            className={`rounded-md px-3 py-2 text-left text-sm transition ${
              selectedId === wf.id
                ? 'bg-brand/20 text-brand'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <div className="font-medium">{wf.name}</div>
            <div className="text-xs text-slate-500">{wf.id}</div>
          </button>
        ))}
        {workflows.length === 0 && (
          <div className="px-3 py-2 text-xs text-slate-500">No workflows found</div>
        )}
      </div>
    </div>
  );
}

