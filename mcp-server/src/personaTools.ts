import { z } from 'zod';

import { CONTROL_PLANE_URL, requireToken } from './config.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PersonaSpec } from './personaLoader.js';

/**
 * Register persona tools - standalone tools that agents can use independently.
 * These are model-controlled (LLM decides when to use them).
 * 
 * Hierarchical structure:
 * - persona.list - List all available personas
 * - persona.{id}.get_specification - Get specification for a specific persona
 */
export async function registerPersonaTools(server: McpServer, personas: PersonaSpec[]) {
  // Tool: List available personas (helper for discovery)
  server.registerTool(
    'persona.list',
    {
      title: 'List Available Personas',
      description: 'List all available personas with their IDs, names, and tags. Useful for discovering which personas you can use.',
      inputSchema: {
        filter_by_tag: z.string().optional().describe('Optional tag to filter personas (e.g., "seo", "content")')
      }
    },
    async (args = {}) => {
      const filterTag = args.filter_by_tag;
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

      return {
        content: [
          {
            type: 'text',
            text: `Available Personas:\n\n${personaList.map((p) => `- **${p.name}** (${p.id})\n  Tags: ${p.tags.join(', ') || 'none'}\n  Tool: \`${p.tool_name}\``).join('\n\n')}`
          }
        ],
        structuredContent: {
          personas: personaList,
          total: personaList.length
        }
      };
    }
  );

  // Tool: Get persona specification (returns instructions)
  for (const persona of personas) {
    const toolName = `persona.${persona.id}.get_specification`;
    const description = `Get the specification and instructions for persona: ${persona.name}. Use this to understand how to work as this persona.`;

    server.registerTool(
      toolName,
      {
        title: `${persona.name} - Get Specification`,
        description,
        inputSchema: {
          context: z.string().optional().describe('Optional context or input for the persona to consider')
        }
      },
      async (args = {}) => {
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

        return {
          content: [
            {
              type: 'text',
              text: instructions
            }
          ],
          structuredContent: {
            persona_id: persona.id,
            persona_name: persona.name,
            specification: persona.specification,
            tags: persona.tags || [],
            web_search_enabled: webSearchEnabled
          }
        };
      }
    );
  }
}
