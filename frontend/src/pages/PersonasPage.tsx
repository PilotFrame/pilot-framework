import { useCallback, useEffect, useMemo, useState } from 'react';

import { PersonaEditor } from '../components/PersonaEditor';
import { PersonaList } from '../components/PersonaList';
import type { ApiConfig, PersonaSpec, PersonaSummary } from '../types';
import { buildAuthHeaders, createDefaultSpec } from '../utils';

type PersonasPageProps = {
  config: ApiConfig;
  connectionStatus: 'idle' | 'connected' | 'disconnected';
  onConnectionStatusChange: (status: 'idle' | 'connected' | 'disconnected') => void;
};

export function PersonasPage({
  config,
  connectionStatus,
  onConnectionStatusChange
}: PersonasPageProps) {
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [spec, setSpec] = useState<PersonaSpec | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canCallApi = useMemo(() => config.baseUrl.trim().length > 0 && config.token.trim().length > 0, [config.baseUrl, config.token]);

  const refreshPersonas = useCallback(async () => {
    if (!canCallApi) {
      onConnectionStatusChange('disconnected');
      setPersonas([]);
      return;
    }
    try {
      setPersonaLoading(true);
      setErrorMessage(null);
      const response = await fetch(new URL('/api/personas', config.baseUrl).toString(), {
        headers: buildAuthHeaders(config)
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const body = await response.json();
      setPersonas(body.data ?? []);
      onConnectionStatusChange('connected');
    } catch (error) {
      onConnectionStatusChange('disconnected');
      setErrorMessage(`Failed to fetch personas: ${(error as Error).message}`);
      setPersonas([]);
    } finally {
      setPersonaLoading(false);
    }
  }, [config, canCallApi, onConnectionStatusChange]);

  useEffect(() => {
    if (canCallApi) {
      refreshPersonas();
    } else {
      onConnectionStatusChange('disconnected');
      setPersonas([]);
    }
  }, [refreshPersonas, canCallApi, onConnectionStatusChange]);

  const handleSelectPersona = async (slug: string) => {
    if (!canCallApi) {
      return;
    }
    if (slug === 'new') {
      setSelectedPersonaId('new');
      setSpec(createDefaultSpec());
      return;
    }
    try {
      setPersonaLoading(true);
      const response = await fetch(new URL(`/api/personas/${slug}/spec`, config.baseUrl).toString(), {
        headers: buildAuthHeaders(config)
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const body = await response.json();
      setSelectedPersonaId(slug);
      setSpec(body.data as PersonaSpec);
      setSaveStatus(null);
    } catch (error) {
      setErrorMessage(`Failed to load persona spec: ${(error as Error).message}`);
    } finally {
      setPersonaLoading(false);
    }
  };

  const handleCreatePersona = () => {
    setSelectedPersonaId('new');
    setSpec(createDefaultSpec());
  };

  const handleSavePersona = async () => {
    if (!spec) {
      return;
    }
    try {
      setIsSaving(true);
      const response = await fetch(new URL('/api/personas', config.baseUrl).toString(), {
        method: 'POST',
        headers: buildAuthHeaders(config),
        body: JSON.stringify(spec)
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`${response.status} ${response.statusText} - ${body}`);
      }
      setSaveStatus(`Saved ${spec.name || spec.id}`);
      await refreshPersonas();
    } catch (error) {
      setSaveStatus(`Save failed: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {errorMessage ? (
        <div className="rounded-md border border-red-500/40 bg-red-900/20 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
        <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-4">
          <PersonaList
            personas={personas}
            selectedId={selectedPersonaId}
            onSelect={handleSelectPersona}
            onCreate={handleCreatePersona}
          />
          {personaLoading ? (
            <p className="mt-3 text-xs text-slate-500">Loading personas...</p>
          ) : !canCallApi ? (
            <p className="mt-3 text-xs text-slate-500">Configure connection above to load personas.</p>
          ) : connectionStatus === 'disconnected' ? (
            <p className="mt-3 text-xs text-red-400">Connection failed. Check your URL and token.</p>
          ) : personas.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">No personas found. Create one to get started.</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-4">
          {spec ? (
            <PersonaEditor
              value={spec}
              onChange={(next: PersonaSpec) => setSpec(next)}
              onSave={handleSavePersona}
              isSaving={isSaving}
              statusMessage={saveStatus}
            />
          ) : (
            <div className="flex h-60 items-center justify-center text-sm text-slate-500">
              Select a persona to start editing or create a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

