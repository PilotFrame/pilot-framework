import express, { type Request, type Response } from 'express';

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

/**
 * POST /pm/mcp - Project Management MCP protocol endpoint (handles JSON-RPC style requests)
 * Separate from main /mcp endpoint to keep project management tools isolated
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
            resources: {}
          },
          serverInfo: {
            name: 'pilotframe-pm-mcp',
            version: '0.1.0'
          }
        }
      });
    }

    // Handle tools/list request
    if (method === 'tools/list') {
      const tools = [
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

      // Normalize method name (handle VS Code MCP prefix)
      const normalizeMethodName = (methodName: string): string => {
        let normalized = methodName;
        if (normalized.startsWith('mcp_pilotframe_pm_')) {
          normalized = normalized.replace('mcp_pilotframe_pm_', '');
        }
        if (normalized.startsWith('mcp_')) {
          normalized = normalized.replace('mcp_', '');
        }
        return normalized;
      };

      const normalizedName = normalizeMethodName(name || '');

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
      const projects = await listProjects();
      
      const resources = projects.map((p) => ({
        uri: `project://${p.id}`,
        name: p.name,
        description: `Project: ${p.name} (${p.status}, ${p.progressPercentage}% complete)`,
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
    console.error('Error handling PM MCP request:', error);
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
 * GET /pm/mcp - PM MCP server information (for testing/debugging)
 */
router.get('/', requireAuth, (_req: Request, res: Response) => {
  res.json({
    name: 'pilotframe-pm-mcp',
    version: '0.1.0',
    description: 'PilotFrame Project Management MCP server',
    protocol: 'HTTP/JSON-RPC',
    endpoints: {
      mcp: 'POST /pm/mcp'
    }
  });
});

export const pmMcpRouter = router;

