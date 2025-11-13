import { useState } from 'react';

import type { ApiConfig } from '../types';
import { buildAuthHeaders } from '../utils';

type ConfigPanelProps = {
  value: ApiConfig;
  onChange: (config: ApiConfig) => void;
};

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'error';

export function ConfigPanel({ value, onChange }: ConfigPanelProps) {
  const [draft, setDraft] = useState<ApiConfig>(value);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionMessage, setConnectionMessage] = useState<string>('');

  const testConnection = async (): Promise<boolean> => {
    if (!draft.baseUrl.trim()) {
      setConnectionStatus('error');
      setConnectionMessage('Please enter a Control Plane URL');
      return false;
    }

    setConnectionStatus('testing');
    setConnectionMessage('Testing connection...');

    try {
      const response = await fetch(new URL('/health', draft.baseUrl).toString(), {
        method: 'GET',
        headers: {
          'content-type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }

      // Test authenticated endpoint if token is provided
      if (draft.token.trim()) {
        const authResponse = await fetch(new URL('/api/personas', draft.baseUrl).toString(), {
          headers: buildAuthHeaders(draft)
        });

        if (!authResponse.ok) {
          if (authResponse.status === 401) {
            throw new Error('Authentication failed: Invalid token');
          }
          throw new Error(`API check failed: ${authResponse.status} ${authResponse.statusText}`);
        }
      }

      setConnectionStatus('connected');
      setConnectionMessage('Connection successful!');
      return true;
    } catch (error) {
      setConnectionStatus('error');
      setConnectionMessage((error as Error).message);
      return false;
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Test connection before saving (but allow saving even if test fails)
    const isConnected = await testConnection();
    
    // Always save, but show appropriate message
    onChange(draft);
    if (isConnected) {
      setConnectionMessage('Connection saved successfully!');
    } else {
      // Keep the error message from testConnection
      // It will show the specific error that occurred
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-400 border-green-500/40 bg-green-900/20';
      case 'error':
        return 'text-red-400 border-red-500/40 bg-red-900/20';
      case 'testing':
        return 'text-yellow-400 border-yellow-500/40 bg-yellow-900/20';
      default:
        return 'text-slate-400 border-slate-500/40 bg-slate-900/20';
    }
  };

  return (
    <div className="rounded-xl bg-slate-900/80 p-4 shadow-md ring-1 ring-slate-800">
      <form onSubmit={handleSubmit} className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-3 md:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">Control Plane URL</span>
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
              value={draft.baseUrl}
              onChange={(event) => {
                setDraft((prev) => ({ ...prev, baseUrl: event.target.value }));
                setConnectionStatus('idle');
                setConnectionMessage('');
              }}
              placeholder="http://localhost:4000"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">Bearer Token</span>
            <input
              type="password"
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
              value={draft.token}
              onChange={(event) => {
                setDraft((prev) => ({ ...prev, token: event.target.value }));
                setConnectionStatus('idle');
                setConnectionMessage('');
              }}
              placeholder="Paste JWT token"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={testConnection}
              disabled={connectionStatus === 'testing' || !draft.baseUrl.trim()}
              className="mt-4 inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              type="submit"
              disabled={connectionStatus === 'testing'}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Connection
            </button>
          </div>
        </div>
        
        {connectionMessage && (
          <div className={`rounded-md border px-4 py-2 text-sm ${getStatusColor()}`}>
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' && (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {connectionStatus === 'error' && (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              {connectionStatus === 'testing' && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              <span>{connectionMessage}</span>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

