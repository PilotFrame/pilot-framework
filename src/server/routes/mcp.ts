import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { requireAuth } from '../auth.js';
import { appConfig } from '../config.js';

const router = express.Router();

// Types
interface PersonaSpec {
  id: string;
  name: string;
  tags?: string[];
  specification: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  steps: Array<{
    id: string;
    persona_id: string;
    order: number;
    condition?: string;
  }>;
  execution_spec?: {
    description?: string;
    execution_guidance?: string;
    cycle_details?: {
      cycle_steps: string[];
      exit_condition: string;
      max_iterations?: number;
    };
    parallel_details?: {
      parallel_steps: string[];
      merge_strategy?: string;
    };
  };
}

// Cache for personas
let personasCache: PersonaSpec[] | null = null;

async function loadPersonas(): Promise<PersonaSpec[]> {
  if (personasCache) {
    return personasCache;
  }
  const personaSpecDir = path.join(process.cwd(), 'examples', 'personas');
  const entries = await fs.readdir(personaSpecDir, { withFileTypes: true });

  const specs: PersonaSpec[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }
    const fullPath = path.join(personaSpecDir, entry.name);
    const raw = await fs.readFile(fullPath, 'utf-8');
    try {
      const parsed = JSON.parse(raw) as PersonaSpec;
      if (!parsed.id || !parsed.specification) {
        continue;
      }
      specs.push(parsed);
    } catch (error) {
      console.warn(`Failed to parse persona spec ${entry.name}:`, error);
    }
  }

  personasCache = specs;
  return specs;
}

/**
 * POST /mcp - MCP protocol endpoint (handles JSON-RPC style requests)
 * This is the main endpoint Cursor uses for MCP over HTTP
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { method, params, id } = req.body;

    // Handle initialize request
    if (method === 'initialize') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
          serverInfo: {
            name: 'pilotframe-mcp',
            version: '0.1.0'
          }
        }
      });
    }

    // Handle tools/list request
    if (method === 'tools/list') {
      const personas = await loadPersonas();
      
      const tools: Array<{
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
      }> = [
        {
          name: 'persona.list',
          description: 'List all available personas with their IDs, names, and tags.',
          inputSchema: {
            type: 'object',
            properties: {
              filter_by_tag: {
                type: 'string',
                description: 'Optional tag to filter personas'
              }
            }
          }
        },
        ...personas.map((p) => ({
          name: `persona.${p.id}.get_specification`,
          description: `Get the specification and instructions for persona: ${p.name}`,
          inputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'string',
                description: 'Optional context or input for the persona'
              }
            }
          }
        }))
      ];

      // Add workflow tools
      try {
        const controlPlaneUrl = appConfig.NODE_ENV === 'development' ? 'http://localhost:4000' : process.env.CONTROL_PLANE_URL || 'http://localhost:4000';
        const response = await fetch(new URL('/api/workflows', controlPlaneUrl).toString(), {
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${req.headers.authorization?.substring(7) || ''}`
          }
        });
        if (response.ok) {
          const body = (await response.json()) as { data: Array<{ id: string; name: string }> };
          const workflowTools = body.data.map((wf) => ({
            name: `workflow.${wf.id}`,
            description: `Get the complete workflow definition and execution guide for: ${wf.name}`,
            inputSchema: {
              type: 'object',
              properties: {
                input: {
                  type: 'object',
                  description: 'Optional context or input for the workflow'
                }
              }
            }
          }));
          tools.push(...workflowTools);
        }
      } catch (error) {
        console.warn('Could not load workflow tools:', error);
      }

      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools
        }
      });
    }

    // Handle tools/call request
    if (method === 'tools/call') {
      const { name, arguments: args } = params || {};
      const personas = await loadPersonas();

      // Handle persona.list
      if (name === 'persona.list') {
        const filterTag = args?.filter_by_tag;
        let filtered = personas;
        if (filterTag) {
          filtered = personas.filter((p) => p.tags?.includes(filterTag));
        }
        const personaList = filtered.map((p) => ({
          id: p.id,
          name: p.name,
          tags: p.tags || [],
          tool_name: `persona.${p.id}.get_specification`
        }));
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `Available Personas:\n\n${personaList.map((p) => `- **${p.name}** (${p.id})\n  Tags: ${p.tags.join(', ') || 'none'}\n  Tool: \`${p.tool_name}\``).join('\n\n')}`
              }
            ],
            isError: false
          }
        });
      }

      // Handle persona.{id}.get_specification
      if (name?.startsWith('persona.') && name.endsWith('.get_specification')) {
        const personaId = name.replace('persona.', '').replace('.get_specification', '');
        const persona = personas.find((p) => p.id === personaId);
        
        if (!persona) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Persona ${personaId} not found`
            }
          });
        }

        const specText = JSON.stringify(persona.specification, null, 2);
        const webSearchEnabled = (persona.metadata?.web_search_enabled as boolean) || false;
        
        let instructions = `# Persona: ${persona.name}\n\n## Specification\n\n${specText}\n\n`;
        
        if (webSearchEnabled) {
          instructions += `## Web Search Capability\n\n`;
          instructions += `**IMPORTANT**: This persona has web search enabled. When executing tasks as this persona:\n\n`;
          instructions += `- Use web search to gather current, real-time information when needed\n`;
          instructions += `- Verify facts, statistics, and claims using web search\n`;
          instructions += `- Look up recent developments, trends, or updates relevant to the task\n`;
          instructions += `- Cross-reference information from multiple sources when accuracy is critical\n`;
          instructions += `- Cite sources when providing information gathered from web search\n\n`;
          instructions += `Web search should be used proactively to ensure the information you provide is accurate, current, and well-researched.\n\n`;
        }
        
        instructions += `Use this specification to guide your actions when working as this persona.`;

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: instructions
              }
            ],
            isError: false
          }
        });
      }

      // Handle workflow.{id}
      if (name?.startsWith('workflow.')) {
        const workflowId = name.replace('workflow.', '');
        const controlPlaneUrl = appConfig.NODE_ENV === 'development' ? 'http://localhost:4000' : process.env.CONTROL_PLANE_URL || 'http://localhost:4000';
        
        const response = await fetch(new URL(`/api/workflows/${workflowId}`, controlPlaneUrl).toString(), {
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${req.headers.authorization?.substring(7) || ''}`
          }
        });

        if (!response.ok) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Workflow ${workflowId} not found`
            }
          });
        }

        const body = (await response.json()) as { data: WorkflowDefinition };
        const workflow = body.data;
        const personas = await loadPersonas();

        // Build workflow execution guide
        const executionSpec = workflow.execution_spec;
        const sortedSteps = workflow.steps.sort((a, b) => a.order - b.order);
        
        let guide = `# Workflow: ${workflow.name}\n\n`;
        
        if (executionSpec?.description) {
          guide += `${executionSpec.description}\n\n`;
        }

        guide += `## Execution Flow\n\n`;
        
        if (executionSpec?.execution_guidance) {
          guide += `${executionSpec.execution_guidance}\n\n`;
        } else if (executionSpec?.description) {
          guide += `${executionSpec.description}\n\n`;
        }

        if (executionSpec?.cycle_details) {
          const cycle = executionSpec.cycle_details;
          guide += `### Refinement Cycle\n\n`;
          guide += `This workflow includes a refinement cycle involving: ${cycle.cycle_steps.join(', ')}.\n\n`;
          guide += `- **Exit Condition**: ${cycle.exit_condition}\n`;
          guide += `- **Max Iterations**: ${cycle.max_iterations || 10}\n\n`;
        }

        if (executionSpec?.parallel_details) {
          const parallel = executionSpec.parallel_details;
          guide += `### Parallel Execution\n\n`;
          guide += `The following steps can execute in parallel: ${parallel.parallel_steps.join(', ')}.\n`;
          guide += `- **Merge Strategy**: ${parallel.merge_strategy || 'all'}\n\n`;
        }

        guide += `## Workflow Steps\n\n`;
        sortedSteps.forEach((step) => {
          const persona = personas.find((p) => p.id === step.persona_id);
          guide += `### Step ${step.order}: ${step.id}\n\n`;
          guide += `**Persona**: ${persona?.name || step.persona_id} (\`${step.persona_id}\`)\n\n`;
          guide += `**Tool to Call**: \`persona.${step.persona_id}.get_specification\`\n\n`;
          if (step.condition) {
            guide += `**Step Condition**: ${step.condition}\n\n`;
          }
          guide += `---\n\n`;
        });

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: guide
              }
            ],
            isError: false
          }
        });
      }

      return res.json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${name}`
        }
      });
    }

    // Handle resources/list request
    if (method === 'resources/list') {
      const personas = await loadPersonas();
      
      const resources = personas.map((p) => ({
        uri: `persona://${p.id}`,
        name: p.name,
        description: `Persona specification for ${p.name}`,
        mimeType: 'application/json'
      }));

      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          resources
        }
      });
    }

    // Handle resources/read request
    if (method === 'resources/read') {
      const { uri } = params || {};
      
      if (uri?.startsWith('persona://')) {
        const personaId = uri.replace('persona://', '');
        const personas = await loadPersonas();
        const persona = personas.find((p) => p.id === personaId);
        
        if (!persona) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Persona ${personaId} not found`
            }
          });
        }

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(persona, null, 2)
              }
            ]
          }
        });
      }

      return res.json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: `Resource ${uri} not found`
        }
      });
    }

    // Unknown method
    return res.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      }
    });
  } catch (error) {
    console.error('Error handling MCP request:', error);
    return res.json({
      jsonrpc: '2.0',
      id: req.body.id || null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: (error as Error).message
      }
    });
  }
});

/**
 * GET /mcp - MCP server information (for testing/debugging)
 */
router.get('/', requireAuth, (_req: Request, res: Response) => {
  res.json({
    name: 'pilotframe-mcp',
    version: '0.1.0',
    description: 'PilotFrame MCP server exposing personas and workflows',
    protocol: 'HTTP/JSON-RPC',
    endpoints: {
      mcp: 'POST /mcp',
      tools: 'GET /mcp/tools',
      resources: 'GET /mcp/resources'
    }
  });
});

/**
 * GET /mcp/tools - List all available MCP tools (for testing/debugging)
 */
router.get('/tools', requireAuth, async (_req: Request, res: Response) => {
  try {
    const personas = await loadPersonas();
    
    const tools: Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }> = [
      {
        name: 'persona.list',
        description: 'List all available personas with their IDs, names, and tags.',
        inputSchema: {
          type: 'object',
          properties: {
            filter_by_tag: {
              type: 'string',
              description: 'Optional tag to filter personas'
            }
          }
        }
      },
      ...personas.map((p) => ({
        name: `persona.${p.id}.get_specification`,
        description: `Get the specification and instructions for persona: ${p.name}`,
        inputSchema: {
          type: 'object',
          properties: {
            context: {
              type: 'string',
              description: 'Optional context or input for the persona'
            }
          }
        }
      }))
    ];

    // Add workflow tools
    try {
      const controlPlaneUrl = appConfig.NODE_ENV === 'development' ? 'http://localhost:4000' : process.env.CONTROL_PLANE_URL || 'http://localhost:4000';
      const response = await fetch(new URL('/api/workflows', controlPlaneUrl).toString(), {
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${_req.headers.authorization?.substring(7) || ''}`
        }
      });
      if (response.ok) {
        const body = (await response.json()) as { data: Array<{ id: string; name: string }> };
        const workflowTools = body.data.map((wf) => ({
          name: `workflow.${wf.id}`,
          description: `Get the complete workflow definition and execution guide for: ${wf.name}`,
          inputSchema: {
            type: 'object',
            properties: {
              input: {
                type: 'object',
                description: 'Optional context or input for the workflow'
              }
            }
          }
        }));
        tools.push(...workflowTools);
      }
    } catch (error) {
      console.warn('Could not load workflow tools:', error);
    }

    res.json({ tools });
  } catch (error) {
    console.error('Error listing MCP tools:', error);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

/**
 * GET /mcp/resources - List all available MCP resources (for testing/debugging)
 */
router.get('/resources', requireAuth, async (_req: Request, res: Response) => {
  try {
    const personas = await loadPersonas();
    
    const resources = personas.map((p) => ({
      uri: `persona://${p.id}`,
      name: p.name,
      description: `Persona specification for ${p.name}`,
      mimeType: 'application/json'
    }));

    res.json({ resources });
  } catch (error) {
    console.error('Error listing MCP resources:', error);
    res.status(500).json({ error: 'Failed to list resources' });
  }
});

export const mcpRouter = router;
