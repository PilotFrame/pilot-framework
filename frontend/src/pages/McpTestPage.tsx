import { useEffect, useState } from 'react';

import type { ApiConfig } from '../types';
import { buildAuthHeaders } from '../utils';

type McpTestPageProps = {
  config: ApiConfig;
  connectionStatus: 'idle' | 'connected' | 'disconnected';
};

type McpEndpoint = 'unified';

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

interface TestHistory {
  timestamp: Date;
  endpoint: McpEndpoint;
  tool: string;
  input: string;
  success: boolean;
  result?: ToolCallResult;
  error?: string;
}

// Example inputs for common tools
const TOOL_EXAMPLES: Record<string, string> = {
  // Persona/Workflow MCP (/mcp)
  persona_list: '{"filter_by_tag": "seo"}',
  persona_get: '{"persona_id": "code_reviewer"}',
  workflow_list: '{}',
  workflow_get: '{"workflow_id": "content_production_workflow"}',
  
  // Project Management MCP (/pm/mcp)
  project_list: '{"status": "draft"}',
  project_get: '{"projectId": "your-project-id-here"}',
  story_get: '{"projectId": "your-project-id", "storyId": "your-story-id"}',
  story_list_by_status: '{"status": "ready"}',
  story_update_status: '{"projectId": "proj-id", "storyId": "story-id", "status": "in_progress", "updatedBy": "agent-name"}',
  story_add_comment: '{"projectId": "proj-id", "storyId": "story-id", "content": "Your comment", "author": "agent-name", "authorType": "agent", "type": "update"}',
  story_mark_criteria_complete: '{"projectId": "proj-id", "storyId": "story-id", "criteriaId": "ac-id", "verifiedBy": "agent-name", "evidence": "Test passed"}'
};

export function McpTestPage({ config, connectionStatus }: McpTestPageProps) {
  const [activeEndpoint] = useState<McpEndpoint>('unified');
  const [tools, setTools] = useState<McpTool[]>([]);
  const [resources, setResources] = useState<McpResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [toolInput, setToolInput] = useState<string>('{}');
  const [toolResult, setToolResult] = useState<ToolCallResult | null>(null);
  const [callingTool, setCallingTool] = useState(false);
  const [history, setHistory] = useState<TestHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [resourceContent, setResourceContent] = useState<string | null>(null);
  const [loadingResource, setLoadingResource] = useState(false);

  const canCallApi = config.baseUrl.trim().length > 0 && config.token.trim().length > 0;

  const getEndpointPath = (_endpoint: McpEndpoint) => {
    return '/mcp'; // All tools now available at unified endpoint
  };

  const loadMcpData = async () => {
    if (!canCallApi) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const basePath = getEndpointPath(activeEndpoint);
      
      // Load tools - using JSON-RPC protocol
      const toolsResponse = await fetch(new URL(basePath, config.baseUrl).toString(), {
        method: 'POST',
        headers: {
          ...buildAuthHeaders(config),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/list'
        })
      });

      if (!toolsResponse.ok) {
        throw new Error(`Failed to load tools: ${toolsResponse.status} ${toolsResponse.statusText}`);
      }

      const toolsData = await toolsResponse.json() as { result?: { tools: McpTool[] } };
      setTools(toolsData.result?.tools || []);

      // Load resources
      const resourcesResponse = await fetch(new URL(basePath, config.baseUrl).toString(), {
        method: 'POST',
        headers: {
          ...buildAuthHeaders(config),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'resources/list'
        })
      });

      if (resourcesResponse.ok) {
        const resourcesData = await resourcesResponse.json() as { result?: { resources: McpResource[] } };
        setResources(resourcesData.result?.resources || []);
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
  }, [config.baseUrl, config.token, connectionStatus, activeEndpoint]);

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

      const basePath = getEndpointPath(activeEndpoint);
      const response = await fetch(new URL(basePath, config.baseUrl).toString(), {
        method: 'POST',
        headers: {
          ...buildAuthHeaders(config),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: selectedTool,
            arguments: inputObj
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tool call failed: ${response.status} ${errorText}`);
      }

      const result = await response.json() as { 
        result?: { content?: Array<{ type: string; text: string }>; structuredContent?: Record<string, unknown> }; 
        error?: { message: string } 
      };
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      const toolCallResult: ToolCallResult = {
        tool: selectedTool,
        result: result.result || { content: [] }
      };
      
      setToolResult(toolCallResult);
      
      // Add to history
      setHistory(prev => [{
        timestamp: new Date(),
        endpoint: activeEndpoint,
        tool: selectedTool,
        input: toolInput,
        success: true,
        result: toolCallResult
      }, ...prev.slice(0, 19)]); // Keep last 20 items
      
    } catch (err) {
      const errorMsg = (err as Error).message;
      setError(errorMsg);
      
      // Add error to history
      setHistory(prev => [{
        timestamp: new Date(),
        endpoint: activeEndpoint,
        tool: selectedTool,
        input: toolInput,
        success: false,
        error: errorMsg
      }, ...prev.slice(0, 19)]);
    } finally {
      setCallingTool(false);
    }
  };

  const handleLoadResource = async (uri: string) => {
    setLoadingResource(true);
    setResourceContent(null);
    setSelectedResource(uri);

    try {
      const basePath = getEndpointPath(activeEndpoint);
      const response = await fetch(new URL(basePath, config.baseUrl).toString(), {
        method: 'POST',
        headers: {
          ...buildAuthHeaders(config),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'resources/read',
          params: { uri }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to load resource: ${response.status}`);
      }

      const result = await response.json() as { result?: { contents: Array<{ text: string }> } };
      const content = result.result?.contents?.[0]?.text || 'No content';
      setResourceContent(content);
    } catch (err) {
      setResourceContent(`Error: ${(err as Error).message}`);
    } finally {
      setLoadingResource(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const loadExampleInput = (toolName: string) => {
    const example = TOOL_EXAMPLES[toolName];
    if (example) {
      setToolInput(example);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-200">MCP Server Tester</h1>
          <p className="mt-1 text-sm text-slate-400">
            Test MCP tools and resources across persona and project management endpoints
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700"
          >
            {showHistory ? 'Hide' : 'Show'} History ({history.length})
          </button>
          <button
            type="button"
            onClick={loadMcpData}
            disabled={!canCallApi || loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Endpoint Selector */}
      <div className="rounded-lg border border-blue-900/40 bg-blue-900/20 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-900/40 text-lg">
            🔧
          </div>
          <div>
            <h3 className="font-semibold text-blue-100">Unified MCP Endpoint</h3>
            <p className="text-sm text-blue-300">
              All tools (personas, workflows, & project management) available at <code className="rounded bg-blue-900/30 px-1.5 py-0.5 font-mono text-xs">/mcp</code>
            </p>
          </div>
        </div>
      </div>

      {!canCallApi ? (
        <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-8">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="text-4xl">🔌</div>
            <div className="text-sm font-medium text-slate-300">Connection Required</div>
            <div className="text-xs text-slate-500">
              Configure Control Plane URL and Bearer Token in the header to test MCP endpoints
            </div>
          </div>
        </div>
      ) : connectionStatus === 'disconnected' ? (
        <div className="rounded-xl border border-red-900/40 bg-red-900/20 p-8">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="text-4xl">⚠️</div>
            <div className="text-sm font-medium text-red-300">Connection Failed</div>
            <div className="text-xs text-red-400">
              Check your Control Plane URL and Bearer Token configuration
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-900/40 bg-red-900/20 p-4">
          <div className="text-sm text-red-300">
            <strong>Error:</strong> {error}
          </div>
        </div>
      ) : (
        <>
          {/* History Panel */}
          {showHistory && history.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Test History
                </h2>
                <button
                  onClick={() => setHistory([])}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Clear All
                </button>
              </div>
              <div className="max-h-[300px] space-y-2 overflow-y-auto">
                {history.map((item, index) => (
                  <div
                    key={index}
                    className={`rounded-md border p-3 ${
                      item.success
                        ? 'border-green-900/40 bg-green-900/10'
                        : 'border-red-900/40 bg-red-900/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${
                            item.success ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {item.success ? '✓' : '✗'}
                          </span>
                          <code className="text-xs font-mono text-slate-300">{item.tool}</code>
                          <span className="text-xs text-slate-500">
                            [{item.endpoint}]
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedTool(item.tool);
                          setToolInput(item.input);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Rerun
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Tools List */}
            <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                Available Tools ({tools.length})
              </h2>
              <div className="flex max-h-[600px] flex-col gap-2 overflow-y-auto">
                {tools.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No tools available
                  </div>
                ) : (
                  tools.map((tool) => (
                    <button
                      key={tool.name}
                      onClick={() => {
                        setSelectedTool(tool.name);
                        setToolResult(null);
                        loadExampleInput(tool.name);
                      }}
                      className={`rounded-md border p-3 text-left transition ${
                        selectedTool === tool.name
                          ? 'border-blue-600 bg-blue-600/10 ring-1 ring-blue-600/50'
                          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="font-mono text-xs font-semibold text-blue-400">
                        {tool.name}
                      </div>
                      <div className="mt-1 text-xs leading-relaxed text-slate-400">
                        {tool.description}
                      </div>
                      {TOOL_EXAMPLES[tool.name] && (
                        <div className="mt-2 text-xs text-green-500">
                          ✓ Example available
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Tool Testing Panel */}
            <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 lg:col-span-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                Tool Testing
              </h2>

              {selectedTool ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400">Selected Tool</label>
                    <div className="mt-1 flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2">
                      <code className="font-mono text-sm text-slate-200">{selectedTool}</code>
                      {TOOL_EXAMPLES[selectedTool] && (
                        <button
                          onClick={() => loadExampleInput(selectedTool)}
                          className="text-xs text-green-400 hover:text-green-300"
                        >
                          Load Example
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Input Schema */}
                  {(() => {
                    const tool = tools.find(t => t.name === selectedTool);
                    if (tool?.inputSchema && Object.keys(tool.inputSchema).length > 0) {
                      return (
                        <div>
                          <label className="text-xs font-semibold text-slate-400">
                            Input Schema
                          </label>
                          <pre className="mt-1 overflow-x-auto rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
                            {JSON.stringify(tool.inputSchema, null, 2)}
                          </pre>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div>
                    <label className="text-xs font-semibold text-slate-400">
                      Input Arguments (JSON)
                    </label>
                    <textarea
                      className="mt-1 min-h-[120px] w-full rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 font-mono text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/50"
                      value={toolInput}
                      onChange={(e) => setToolInput(e.target.value)}
                      placeholder='{"key": "value"}'
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleCallTool}
                    disabled={callingTool}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-700"
                  >
                    {callingTool ? 'Calling Tool...' : 'Call Tool'}
                  </button>

                  {toolResult && (
                    <div className="rounded-md border border-green-900/40 bg-green-900/20 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs font-semibold text-green-300">Result</div>
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(toolResult, null, 2))}
                          className="text-xs text-green-400 hover:text-green-300"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="max-h-[400px] overflow-auto text-xs text-green-100">
                        {JSON.stringify(toolResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-96 items-center justify-center text-center text-sm text-slate-500">
                  <div>
                    <div className="text-4xl mb-3">🔧</div>
                    <div>Select a tool from the list to test it</div>
                  </div>
                </div>
              )}
            </div>

            {/* Resources Panel */}
            <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 lg:col-span-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                MCP Resources ({resources.length})
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto">
                  {resources.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No resources available
                    </div>
                  ) : (
                    resources.map((resource) => (
                      <button
                        key={resource.uri}
                        onClick={() => handleLoadResource(resource.uri)}
                        className={`rounded-md border p-3 text-left transition ${
                          selectedResource === resource.uri
                            ? 'border-purple-600 bg-purple-600/10 ring-1 ring-purple-600/50'
                            : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="font-mono text-xs font-semibold text-purple-400">
                          {resource.uri}
                        </div>
                        <div className="mt-1 text-xs text-slate-300">{resource.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{resource.description}</div>
                      </button>
                    ))
                  )}
                </div>
                <div>
                  {selectedResource ? (
                    <div className="rounded-md border border-slate-800 bg-slate-900/60 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-300">
                          Resource Content
                        </div>
                        {resourceContent && (
                          <button
                            onClick={() => copyToClipboard(resourceContent)}
                            className="text-xs text-purple-400 hover:text-purple-300"
                          >
                            Copy
                          </button>
                        )}
                      </div>
                      {loadingResource ? (
                        <div className="py-8 text-center text-xs text-slate-500">
                          Loading resource...
                        </div>
                      ) : resourceContent ? (
                        <pre className="max-h-[250px] overflow-auto text-xs text-slate-300">
                          {resourceContent}
                        </pre>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-md border border-slate-800 bg-slate-900/60 p-8 text-center text-xs text-slate-500">
                      Select a resource to view its content
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
