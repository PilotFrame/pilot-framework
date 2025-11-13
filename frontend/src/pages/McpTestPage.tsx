import { useEffect, useState } from 'react';

import type { ApiConfig } from '../types';
import { buildAuthHeaders } from '../utils';

type McpTestPageProps = {
  config: ApiConfig;
  connectionStatus: 'idle' | 'connected' | 'disconnected';
};

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

interface ToolCallResult {
  tool: string;
  result: {
    content?: Array<{ type: string; text: string }>;
    structuredContent?: Record<string, unknown>;
  };
}

export function McpTestPage({ config, connectionStatus }: McpTestPageProps) {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [resources, setResources] = useState<McpResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [toolInput, setToolInput] = useState<string>('{}');
  const [toolResult, setToolResult] = useState<ToolCallResult | null>(null);
  const [callingTool, setCallingTool] = useState(false);

  const canCallApi = config.baseUrl.trim().length > 0 && config.token.trim().length > 0;

  const loadMcpData = async () => {
    if (!canCallApi) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load tools
      const toolsResponse = await fetch(new URL('/mcp/tools', config.baseUrl).toString(), {
        headers: buildAuthHeaders(config)
      });

      if (!toolsResponse.ok) {
        throw new Error(`Failed to load tools: ${toolsResponse.status} ${toolsResponse.statusText}`);
      }

      const toolsData = (await toolsResponse.json()) as { tools: McpTool[] };
      setTools(toolsData.tools || []);

      // Load resources
      const resourcesResponse = await fetch(new URL('/mcp/resources', config.baseUrl).toString(), {
        headers: buildAuthHeaders(config)
      });

      if (resourcesResponse.ok) {
        const resourcesData = (await resourcesResponse.json()) as { resources: McpResource[] };
        setResources(resourcesData.resources || []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canCallApi && connectionStatus === 'connected') {
      loadMcpData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.baseUrl, config.token, connectionStatus]);

  const handleCallTool = async () => {
    if (!selectedTool) return;

    setCallingTool(true);
    setError(null);
    setToolResult(null);

    try {
      let inputObj = {};
      if (toolInput.trim()) {
        inputObj = JSON.parse(toolInput);
      }

      const response = await fetch(
        new URL(`/mcp/tools/${encodeURIComponent(selectedTool)}`, config.baseUrl).toString(),
        {
          method: 'POST',
          headers: {
            ...buildAuthHeaders(config),
            'content-type': 'application/json'
          },
          body: JSON.stringify({ input: inputObj })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tool call failed: ${response.status} ${errorText}`);
      }

      const result = (await response.json()) as ToolCallResult;
      setToolResult(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCallingTool(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-200">MCP Server Test</h1>
        <button
          type="button"
          onClick={loadMcpData}
          disabled={!canCallApi || loading}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {!canCallApi ? (
        <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-4">
          <div className="flex h-60 items-center justify-center text-sm text-slate-500">
            Configure connection in the header to test MCP endpoint.
          </div>
        </div>
      ) : connectionStatus === 'disconnected' ? (
        <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-4">
          <div className="flex h-60 items-center justify-center text-sm text-red-400">
            Connection failed. Check your URL and token.
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-900/40 bg-red-900/20 p-4">
          <div className="text-sm text-red-300">
            <strong>Error:</strong> {error}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tools Panel */}
          <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              MCP Tools ({tools.length})
            </h2>
            <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto">
              {tools.length === 0 ? (
                <div className="text-xs text-slate-500">No tools found</div>
              ) : (
                tools.map((tool) => (
                  <div
                    key={tool.name}
                    className={`cursor-pointer rounded-md border p-3 transition ${
                      selectedTool === tool.name
                        ? 'border-brand bg-brand/10'
                        : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                    }`}
                    onClick={() => {
                      setSelectedTool(tool.name);
                      setToolResult(null);
                    }}
                  >
                    <div className="font-mono text-xs font-semibold text-brand">{tool.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{tool.description}</div>
                    {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 && (
                      <div className="mt-2 rounded bg-slate-800/60 p-2">
                        <div className="text-xs text-slate-500">Input Schema:</div>
                        <pre className="mt-1 overflow-x-auto text-xs text-slate-300">
                          {JSON.stringify(tool.inputSchema, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tool Call Panel */}
          <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Test Tool Call</h2>

            {selectedTool ? (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Selected Tool</label>
                  <div className="mt-1 font-mono text-sm text-slate-200">{selectedTool}</div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400">Input (JSON)</label>
                  <textarea
                    className="mt-1 min-h-[100px] w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/50"
                    value={toolInput}
                    onChange={(e) => setToolInput(e.target.value)}
                    placeholder='{"filter_by_tag": "seo"}'
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCallTool}
                  disabled={callingTool}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  {callingTool ? 'Calling...' : 'Call Tool'}
                </button>

                {toolResult && (
                  <div className="rounded-md border border-green-900/40 bg-green-900/20 p-3">
                    <div className="text-xs font-semibold text-green-300 mb-2">Result:</div>
                    <pre className="max-h-[300px] overflow-auto text-xs text-green-200">
                      {JSON.stringify(toolResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-60 items-center justify-center text-sm text-slate-500">
                Select a tool from the list to test it
              </div>
            )}
          </div>

          {/* Resources Panel */}
          <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              MCP Resources ({resources.length})
            </h2>
            <div className="flex max-h-[200px] flex-col gap-2 overflow-y-auto">
              {resources.length === 0 ? (
                <div className="text-xs text-slate-500">No resources found</div>
              ) : (
                resources.map((resource) => (
                  <div
                    key={resource.uri}
                    className="rounded-md border border-slate-800 bg-slate-900/40 p-3"
                  >
                    <div className="font-mono text-xs font-semibold text-slate-200">{resource.uri}</div>
                    <div className="mt-1 text-xs text-slate-400">{resource.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{resource.description}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

