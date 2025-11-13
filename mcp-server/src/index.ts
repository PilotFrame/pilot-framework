import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import {
  CONTROL_PLANE_URL,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  PERSONA_SPEC_DIR
} from './config.js';
import { loadPersonaSpecs, type PersonaSpec } from './personaLoader.js';
import { registerPersonaResources } from './personaResources.js';
import { registerPersonaTools } from './personaTools.js';
import { registerWorkflowPrompts } from './workflowPrompts.js';
import { registerWorkflowResources } from './workflowResources.js';
import { registerWorkflowTools } from './workflowTools.js';

async function main() {
  console.error(`Loading persona specs from ${PERSONA_SPEC_DIR}`);
  console.error(`Using control plane at ${CONTROL_PLANE_URL}`);

  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION
  });

  // Load personas once for all registrations
  const personas = await loadPersonaSpecs(PERSONA_SPEC_DIR);

  // Register health tool
  server.registerTool(
    'control_plane.health',
    {
      description: 'Fetch control plane health information.'
    },
    async () => {
      const response = await fetch(new URL('/health', CONTROL_PLANE_URL).toString());
      const body = await response.text();
      return {
        content: [
          {
            type: 'text',
            text: body
          }
        ]
      };
    }
  );

  // Register hierarchical tools:
  // 1. Persona tools (standalone, can be used independently)
  await registerPersonaTools(server, personas);

  // 2. Workflow tools (orchestrate multiple personas)
  await registerWorkflowTools(server, personas);

  // Register resources (application-controlled context):
  // 3. Persona resources (read-only specifications)
  await registerPersonaResources(server, personas);

  // 4. Workflow resources (read-only workflow definitions)
  await registerWorkflowResources(server);

  // Register prompts (user-controlled templates):
  // 5. Workflow prompts (common workflow patterns)
  await registerWorkflowPrompts(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PilotFrame MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
