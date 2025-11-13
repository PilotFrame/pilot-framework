import { Fragment } from 'react';

import type { PersonaSummary } from '../types';
import { getPersonaToolName } from '../utils/mcpValidation';

type PersonaListProps = {
  personas: PersonaSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
};

export function PersonaList({ personas, selectedId, onSelect, onCreate }: PersonaListProps) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Persona Registry</h2>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-md border border-brand/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand hover:bg-brand/10"
        >
          + New Persona
        </button>
      </div>
      <div className="flex-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60">
        <ul className="divide-y divide-slate-800">
          {personas.length === 0 && (
            <li className="p-4 text-sm text-slate-500">No personas found. Create one or configure connection.</li>
          )}
          {personas.map((persona) => {
            const isActive = persona.slug === selectedId || persona.id === selectedId;
            return (
              <Fragment key={persona.slug}>
                <li
                  className={`cursor-pointer px-4 py-3 transition ${
                    isActive ? 'bg-brand/20 text-white' : 'hover:bg-slate-800/60'
                  }`}
                  onClick={() => onSelect(persona.slug)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{persona.name}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    <div className="font-mono">{persona.id}</div>
                    <div className="mt-0.5 text-slate-500">Tool: {getPersonaToolName(persona.id)}</div>
                    {persona.updated_at ? (
                      <div className="mt-0.5">Updated {new Date(persona.updated_at).toLocaleDateString()}</div>
                    ) : null}
                  </div>
                </li>
              </Fragment>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

