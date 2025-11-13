import { CONTROL_PLANE_URL, requireToken } from './config.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PersonaSpec } from './personaLoader.js';

/**
 * Register persona resources - read-only specifications that applications can retrieve.
 * These are application-controlled (app decides when to include them as context).
 * 
 * Note: MCP SDK v1.21.1 may have different resource API. This is a placeholder
 * for when resources are properly supported. For now, use persona tools instead.
 */
export async function registerPersonaResources(server: McpServer, personas: PersonaSpec[]) {
  // TODO: Implement when MCP SDK resource API is confirmed
  // Resources would allow applications to:
  // - Browse personas in a tree/list view
  // - Search/filter by tags
  // - Include persona specs as context automatically
  
  console.error('Persona resources registration skipped - use persona tools for now');
}
