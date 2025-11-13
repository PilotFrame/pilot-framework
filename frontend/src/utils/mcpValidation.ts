/**
 * MCP SDK Naming Conventions and Validation Utilities
 * 
 * Based on MCP SDK standards:
 * - Tool names: namespace.entity.action (e.g., persona.seo_specialist.get_specification)
 * - Resource URIs: scheme://namespace/entity (e.g., pilotframe://persona/seo_specialist)
 * - IDs: lowercase, alphanumeric, underscores/dashes only
 */

// MCP ID pattern: lowercase, alphanumeric, underscores, dashes, dots allowed
export const MCP_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

// MCP tool name pattern: namespace.entity.action
export const MCP_TOOL_NAME_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9]+(?:[._-][a-z0-9]+)*)+$/;

// MCP resource URI pattern: scheme://namespace/entity
export const MCP_RESOURCE_URI_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/[a-z0-9]+(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/;

/**
 * Validate if an ID follows MCP naming conventions
 */
export function isValidMcpId(id: string): boolean {
  if (!id || id.trim().length === 0) {
    return false;
  }
  return MCP_ID_PATTERN.test(id);
}

/**
 * Get validation error message for MCP ID
 */
export function getMcpIdError(id: string): string | null {
  if (!id || id.trim().length === 0) {
    return 'ID is required';
  }
  if (!MCP_ID_PATTERN.test(id)) {
    return 'ID must be lowercase, alphanumeric, with underscores, dashes, or dots only (e.g., seo_specialist, content-writer, api.v1)';
  }
  if (id.length > 64) {
    return 'ID must be 64 characters or less';
  }
  return null;
}

/**
 * Generate MCP tool name for a persona
 */
export function getPersonaToolName(personaId: string): string {
  return `persona.${personaId}.get_specification`;
}

/**
 * Generate MCP resource URI for a persona
 */
export function getPersonaResourceUri(personaId: string): string {
  return `pilotframe://persona/${personaId}`;
}

/**
 * Generate MCP tool name for a workflow
 */
export function getWorkflowToolName(workflowId: string): string {
  return `workflow.${workflowId}`;
}

/**
 * Generate MCP resource URI for a workflow
 */
export function getWorkflowResourceUri(workflowId: string): string {
  return `pilotframe://workflow/${workflowId}`;
}

/**
 * Generate MCP prompt name for a workflow
 */
export function getWorkflowPromptName(workflowId: string): string {
  return `workflow-${workflowId}`;
}

/**
 * Format ID for display (capitalize first letter, replace underscores with spaces)
 */
export function formatIdForDisplay(id: string): string {
  return id
    .split(/[._-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Sanitize user input to be MCP-compliant
 */
export function sanitizeMcpId(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]/g, '_') // Replace invalid chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^[._-]+|[._-]+$/g, ''); // Remove leading/trailing separators
}

