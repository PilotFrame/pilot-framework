import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { requireAuth } from '../auth.js';
import { appConfig } from '../config.js';
import {
  listProjects,
  getProject,
  getStory,
  listStoriesByStatus,
  updateStoryStatus,
  addComment,
  markCriteriaComplete
} from '../services/projectService.js';
import type { ProjectStatus, StoryStatus } from '../types/project.js';

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
          name: 'persona_list',
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
          name: `persona_${p.id}_get_specification`,
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
            name: `workflow_${wf.id}`,
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

      // Add project management tools
      const pmTools = [
        {
          name: 'project_list',
          description: 'List all projects with optional status filter. Returns project summaries with progress information.',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['draft', 'published', 'in_development', 'completed', 'archived'],
                description: 'Filter projects by status'
              }
            }
          }
        },
        {
          name: 'project_get',
          description: 'Get complete project details including all epics, stories, and acceptance criteria.',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'Project ID'
              }
            },
            required: ['projectId']
          }
        },
        {
          name: 'story_get',
          description: 'Get a specific story with full details including acceptance criteria and comments.',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'Project ID'
              },
              storyId: {
                type: 'string',
                description: 'Story ID'
              }
            },
            required: ['projectId', 'storyId']
          }
        },
        {
          name: 'story_list_by_status',
          description: 'List all stories filtered by status. Use this to find stories that are ready to work on.',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['draft', 'ready', 'in_progress', 'review', 'blocked', 'done'],
                description: 'Story status to filter by'
              },
              projectId: {
                type: 'string',
                description: 'Optional: limit to specific project'
              }
            },
            required: ['status']
          }
        },
        {
          name: 'story_update_status',
          description: 'Update the status of a story. Use this to track progress as you work on stories.',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'Project ID'
              },
              storyId: {
                type: 'string',
                description: 'Story ID'
              },
              status: {
                type: 'string',
                enum: ['draft', 'ready', 'in_progress', 'review', 'blocked', 'done'],
                description: 'New status'
              },
              updatedBy: {
                type: 'string',
                description: 'Your persona or agent identifier'
              }
            },
            required: ['projectId', 'storyId', 'status', 'updatedBy']
          }
        },
        {
          name: 'story_add_comment',
          description: 'Add a comment to a story. Use this to log updates, decisions, or questions.',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'Project ID'
              },
              storyId: {
                type: 'string',
                description: 'Story ID'
              },
              content: {
                type: 'string',
                description: 'Comment text (markdown supported)'
              },
              author: {
                type: 'string',
                description: 'Your persona or agent identifier'
              },
              authorType: {
                type: 'string',
                enum: ['user', 'persona', 'agent'],
                description: 'Type of author'
              },
              type: {
                type: 'string',
                enum: ['update', 'question', 'decision', 'blocker', 'note'],
                description: 'Comment type',
                default: 'update'
              }
            },
            required: ['projectId', 'storyId', 'content', 'author', 'authorType']
          }
        },
        {
          name: 'story_mark_criteria_complete',
          description: 'Mark an acceptance criteria as complete with verification details.',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'Project ID'
              },
              storyId: {
                type: 'string',
                description: 'Story ID'
              },
              criteriaId: {
                type: 'string',
                description: 'Acceptance criteria ID'
              },
              verifiedBy: {
                type: 'string',
                description: 'Your persona or agent identifier'
              },
              evidence: {
                type: 'string',
                description: 'Optional: How the criteria was verified or evidence of completion'
              }
            },
            required: ['projectId', 'storyId', 'criteriaId', 'verifiedBy']
          }
        }
      ];
      tools.push(...pmTools);

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

      // Normalize method name: strip VS Code MCP prefix
      // Handles: mcp_pilotframe_persona_list -> persona_list
      //          persona_list -> persona_list
      const normalizeMethodName = (methodName: string): string => {
        let normalized = methodName;
        // Strip common VS Code MCP prefixes
        if (normalized.startsWith('mcp_pilotframe_')) {
          normalized = normalized.replace('mcp_pilotframe_', '');
        }
        if (normalized.startsWith('mcp_')) {
          normalized = normalized.replace('mcp_', '');
        }
        return normalized;
      };

      const normalizedName = normalizeMethodName(name || '');

      // Handle persona_list
      if (normalizedName === 'persona_list') {
        const filterTag = args?.filter_by_tag;
        let filtered = personas;
        if (filterTag) {
          filtered = personas.filter((p) => p.tags?.includes(filterTag));
        }
        const personaList = filtered.map((p) => ({
          id: p.id,
          name: p.name,
          tags: p.tags || [],
          tool_name: `persona_${p.id}_get_specification`
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

      // Handle persona_{id}_get_specification
      if (normalizedName.startsWith('persona_') && normalizedName.endsWith('_get_specification')) {
        const personaId = normalizedName.replace('persona_', '').replace('_get_specification', '');
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

      // Handle workflow_{id}
      if (normalizedName.startsWith('workflow_')) {
        const workflowId = normalizedName.replace('workflow_', '');
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
          guide += `**Tool to Call**: \`persona_${step.persona_id}_get_specification\`\n\n`;
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

      // Handle project_list
      if (normalizedName === 'project_list') {
        const status = args?.status as ProjectStatus | undefined;
        const projects = await listProjects(status);
        
        const formattedList = projects.map(p => {
          return `**${p.name}** (${p.id})
  Status: ${p.status}
  Type: ${p.projectType || 'unspecified'}
  Progress: ${p.progressPercentage}% (${p.completedStories}/${p.storyCount} stories)
  Epics: ${p.epicCount}
  Created: ${new Date(p.createdAt).toLocaleDateString()}`;
        }).join('\n\n');

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `# Projects\n\n${formattedList || 'No projects found'}\n\nUse \`project_get\` tool to get full project details.`
              }
            ],
            isError: false
          }
        });
      }

      // Handle project_get
      if (normalizedName === 'project_get') {
        const projectId = args?.projectId;
        if (!projectId) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: 'projectId is required'
            }
          });
        }

        const project = await getProject(projectId);
        if (!project) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Project ${projectId} not found`
            }
          });
        }

        // Format project as markdown for readability
        let markdown = `# ${project.name}\n\n${project.description}\n\n`;
        markdown += `**Status**: ${project.status}\n`;
        markdown += `**Type**: ${project.projectType || 'unspecified'}\n`;
        markdown += `**Complexity**: ${project.estimatedComplexity || 'unknown'}\n`;
        if (project.workflowId) {
          markdown += `**Workflow**: ${project.workflowId}\n`;
        }
        markdown += `\n## Epics\n\n`;

        project.epics.forEach((epic, epicIndex) => {
          markdown += `### Epic ${epicIndex + 1}: ${epic.title} (${epic.status})\n\n`;
          markdown += `${epic.description}\n\n`;
          markdown += `**Priority**: ${epic.priority} | **Stories**: ${epic.stories.length} (${epic.completedStories} done)\n\n`;
          
          markdown += `#### Stories:\n\n`;
          epic.stories.forEach((story, storyIndex) => {
            markdown += `##### ${epicIndex + 1}.${storyIndex + 1}. ${story.title} [${story.status}]\n\n`;
            markdown += `ID: \`${story.id}\`\n\n`;
            markdown += `${story.description}\n\n`;
            
            if (story.assignedPersonas.length > 0) {
              markdown += `**Assigned Personas**: ${story.assignedPersonas.join(', ')}\n\n`;
            }
            
            markdown += `**Acceptance Criteria**:\n\n`;
            story.acceptanceCriteria.forEach((criteria, criIndex) => {
              const status = criteria.completed ? '✓' : '○';
              markdown += `${status} ${criIndex + 1}. ${criteria.description}\n`;
              if (criteria.completed && criteria.verifiedBy) {
                markdown += `   Verified by: ${criteria.verifiedBy}\n`;
                if (criteria.evidence) {
                  markdown += `   Evidence: ${criteria.evidence}\n`;
                }
              }
            });
            markdown += `\n`;
          });
        });

        markdown += `\n---\n\nTo work on stories, use:\n`;
        markdown += `- \`story_get\` to get story details\n`;
        markdown += `- \`story_update_status\` to update story progress\n`;
        markdown += `- \`story_add_comment\` to log updates\n`;
        markdown += `- \`story_mark_criteria_complete\` to mark acceptance criteria done\n`;

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: markdown
              }
            ],
            isError: false
          }
        });
      }

      // Handle story_get
      if (normalizedName === 'story_get') {
        const { projectId, storyId } = args || {};
        if (!projectId || !storyId) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: 'projectId and storyId are required'
            }
          });
        }

        const story = await getStory(projectId, storyId);
        if (!story) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Story ${storyId} not found in project ${projectId}`
            }
          });
        }

        let markdown = `# ${story.title}\n\n`;
        markdown += `**Status**: ${story.status}\n`;
        markdown += `**Priority**: ${story.priority}\n`;
        if (story.assignedPersonas.length > 0) {
          markdown += `**Assigned Personas**: ${story.assignedPersonas.join(', ')}\n`;
        }
        markdown += `\n## Description\n\n${story.description}\n\n`;
        
        markdown += `## Acceptance Criteria\n\n`;
        story.acceptanceCriteria.forEach((criteria, index) => {
          const status = criteria.completed ? '✅' : '⬜';
          const blocking = criteria.isBlocking ? ' (blocking)' : '';
          markdown += `${status} ${index + 1}. ${criteria.description}${blocking}\n`;
          if (criteria.completed) {
            markdown += `   Verified by: ${criteria.verifiedBy} at ${criteria.verifiedAt}\n`;
            if (criteria.evidence) {
              markdown += `   Evidence: ${criteria.evidence}\n`;
            }
          }
        });

        if (story.comments.length > 0) {
          markdown += `\n## Activity Log\n\n`;
          story.comments.forEach(comment => {
            markdown += `**[${comment.type}]** ${comment.author} (${comment.authorType}) - ${new Date(comment.createdAt).toLocaleString()}\n`;
            markdown += `${comment.content}\n\n`;
          });
        }

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: markdown
              }
            ],
            isError: false
          }
        });
      }

      // Handle story_list_by_status
      if (normalizedName === 'story_list_by_status') {
        const { status, projectId } = args || {};
        if (!status) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: 'status is required'
            }
          });
        }

        const stories = await listStoriesByStatus(status as StoryStatus, projectId);
        
        const formatted = stories.map(s => {
          return `**${s.title}** (${s.id})
  Status: ${s.status}
  Priority: ${s.priority}
  Assigned: ${s.assignedPersonas.join(', ') || 'none'}
  Acceptance Criteria: ${s.acceptanceCriteria.filter(c => c.completed).length}/${s.acceptanceCriteria.length} complete`;
        }).join('\n\n');

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `# Stories with status: ${status}\n\n${formatted || 'No stories found'}\n\nUse \`story_get\` to get full story details.`
              }
            ],
            isError: false
          }
        });
      }

      // Handle story_update_status
      if (normalizedName === 'story_update_status') {
        const { projectId, storyId, status, updatedBy } = args || {};
        if (!projectId || !storyId || !status || !updatedBy) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: 'projectId, storyId, status, and updatedBy are required'
            }
          });
        }

        const updated = await updateStoryStatus(projectId, storyId, status, updatedBy);
        if (!updated) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Failed to update story ${storyId}`
            }
          });
        }

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `✅ Story status updated to: ${status}`
              }
            ],
            isError: false
          }
        });
      }

      // Handle story_add_comment
      if (normalizedName === 'story_add_comment') {
        const { projectId, storyId, content, author, authorType, type } = args || {};
        if (!projectId || !storyId || !content || !author || !authorType) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: 'projectId, storyId, content, author, and authorType are required'
            }
          });
        }

        const updated = await addComment(projectId, storyId, {
          content,
          author,
          authorType,
          type: type || 'update'
        });

        if (!updated) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Failed to add comment to story ${storyId}`
            }
          });
        }

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `✅ Comment added to story`
              }
            ],
            isError: false
          }
        });
      }

      // Handle story_mark_criteria_complete
      if (normalizedName === 'story_mark_criteria_complete') {
        const { projectId, storyId, criteriaId, verifiedBy, evidence } = args || {};
        if (!projectId || !storyId || !criteriaId || !verifiedBy) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: 'projectId, storyId, criteriaId, and verifiedBy are required'
            }
          });
        }

        const updated = await markCriteriaComplete(projectId, storyId, criteriaId, verifiedBy, evidence);
        if (!updated) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Failed to mark criteria ${criteriaId} complete`
            }
          });
        }

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `✅ Acceptance criteria marked complete`
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
          message: `Method not found: ${name} (normalized: ${normalizedName})`
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

      // Add project resources
      const projects = await listProjects();
      const projectResources = projects.map((p) => ({
        uri: `project://${p.id}`,
        name: p.name,
        description: `Project: ${p.name} (${p.status}, ${p.progressPercentage}% complete)`,
        mimeType: 'application/json'
      }));
      resources.push(...projectResources);

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

      if (uri?.startsWith('project://')) {
        const projectId = uri.replace('project://', '');
        const project = await getProject(projectId);
        
        if (!project) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Project ${projectId} not found`
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
                text: JSON.stringify(project, null, 2)
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
    version: '0.2.0',
    description: 'PilotFrame MCP server exposing personas, workflows, and project management',
    protocol: 'HTTP/JSON-RPC',
    endpoints: {
      mcp: 'POST /mcp',
      tools: 'GET /mcp/tools',
      resources: 'GET /mcp/resources'
    },
    features: {
      personas: 'Load and execute AI personas',
      workflows: 'Multi-step persona orchestration',
      projects: 'Project backlog management and story tracking'
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
        name: 'persona_list',
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
        name: `persona_${p.id}_get_specification`,
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
            name: `workflow_${wf.id}`,
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

    // Add project management tools
    const pmTools = [
      {
        name: 'project_list',
        description: 'List all projects with optional status filter',
        inputSchema: { type: 'object', properties: { status: { type: 'string' } } }
      },
      {
        name: 'project_get',
        description: 'Get complete project details',
        inputSchema: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] }
      },
      {
        name: 'story_get',
        description: 'Get story details',
        inputSchema: { type: 'object', properties: { projectId: { type: 'string' }, storyId: { type: 'string' } }, required: ['projectId', 'storyId'] }
      },
      {
        name: 'story_list_by_status',
        description: 'List stories by status',
        inputSchema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] }
      },
      {
        name: 'story_update_status',
        description: 'Update story status',
        inputSchema: { type: 'object', required: ['projectId', 'storyId', 'status', 'updatedBy'] }
      },
      {
        name: 'story_add_comment',
        description: 'Add comment to story',
        inputSchema: { type: 'object', required: ['projectId', 'storyId', 'content', 'author', 'authorType'] }
      },
      {
        name: 'story_mark_criteria_complete',
        description: 'Mark acceptance criteria complete',
        inputSchema: { type: 'object', required: ['projectId', 'storyId', 'criteriaId', 'verifiedBy'] }
      }
    ];
    tools.push(...pmTools);

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

    // Add project resources
    const projects = await listProjects();
    const projectResources = projects.map((p) => ({
      uri: `project://${p.id}`,
      name: p.name,
      description: `Project: ${p.name} (${p.status}, ${p.progressPercentage}% complete)`,
      mimeType: 'application/json'
    }));
    resources.push(...projectResources);

    res.json({ resources });
  } catch (error) {
    console.error('Error listing MCP resources:', error);
    res.status(500).json({ error: 'Failed to list resources' });
  }
});

export const mcpRouter = router;
