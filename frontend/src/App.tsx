import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ConfigPanel } from './components/ConfigPanel';
import { Navigation } from './components/Navigation';
import { AssistantPage } from './pages/AssistantPage';
import { PersonasPage } from './pages/PersonasPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { McpTestPage } from './pages/McpTestPage';
import type { ApiConfig } from './types';
import { loadConfig, saveConfig } from './utils';

export default function App() {
  const [config, setConfig] = useState<ApiConfig>(() => loadConfig());
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'disconnected'>('idle');

  const handleConfigChange = (nextConfig: ApiConfig) => {
    setConfig(nextConfig);
    saveConfig(nextConfig);
    setConnectionStatus('idle');
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950">
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-white">PilotFrame Control Plane</h1>
                <p className="text-sm text-slate-400">Author persona specifications and workflows</p>
              </div>
              <Navigation connectionStatus={connectionStatus} />
            </div>
            <ConfigPanel value={config} onChange={handleConfigChange} />
          </div>
        </header>

        <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
          <Routes>
            <Route
              path="/personas"
              element={
                <PersonasPage
                  config={config}
                  connectionStatus={connectionStatus}
                  onConnectionStatusChange={setConnectionStatus}
                />
              }
            />
            <Route
              path="/workflows"
              element={<WorkflowsPage config={config} connectionStatus={connectionStatus} />}
            />
            <Route
              path="/projects"
              element={
                <ProjectsPage
                  config={config}
                  connectionStatus={connectionStatus}
                  onConnectionStatusChange={setConnectionStatus}
                />
              }
            />
            <Route
              path="/projects/:id"
              element={<ProjectDetailPage config={config} />}
            />
            <Route
              path="/mcp-test"
              element={<McpTestPage config={config} connectionStatus={connectionStatus} />}
            />
            <Route
              path="/assistant"
              element={<AssistantPage config={config} connectionStatus={connectionStatus} />}
            />
            <Route path="/" element={<Navigate to="/personas" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
