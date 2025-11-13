import { CONTROL_PLANE_URL, requireToken } from './config.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WorkflowDefinition } from './workflowTools.js';

async function loadWorkflowsFromControlPlane(): Promise<WorkflowDefinition[]> {
  const response = await fetch(new URL('/api/workflows', CONTROL_PLANE_URL).toString(), {
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${requireToken()}`
    }
  });

  if (!response.ok) {
    return [];
  }

  const body = (await response.json()) as { data: WorkflowSummary[] };
  const workflows: WorkflowDefinition[] = [];

  for (const summary of body.data) {
    const workflowResponse = await fetch(
      new URL(`/api/workflows/${summary.id}`, CONTROL_PLANE_URL).toString(),
      {
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${requireToken()}`
        }
      }
    );

    if (workflowResponse.ok) {
      const workflowBody = (await workflowResponse.json()) as { data: WorkflowDefinition };
      workflows.push(workflowBody.data);
    }
  }

  return workflows;
}

interface WorkflowSummary {
  id: string;
  slug: string;
  name: string;
}

/**
 * Register workflow prompts - user-controlled templates for common workflow patterns.
 * 
 * Note: MCP SDK v1.21.1 may have different prompt API. This is a placeholder.
 * For now, workflows are exposed as tools that return instructions.
 */
export async function registerWorkflowPrompts(server: McpServer) {
  // TODO: Implement when MCP SDK prompt API is confirmed
  // Prompts would allow users to:
  // - Use slash commands like /workflow-content-loop
  // - Get structured templates for common patterns
  // - Have parameter completion for workflow inputs
  
  console.error('Workflow prompts registration skipped - use workflow tools for now');
}
