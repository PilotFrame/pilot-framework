# MCP SDK UI Rules and Naming Conventions

This document outlines the UI rules and naming conventions implemented in the PilotFrame frontend to ensure compliance with MCP SDK standards.

## Naming Conventions

### ID Format
- **Pattern**: `^[a-z0-9]+(?:[._-][a-z0-9]+)*$`
- **Rules**:
  - Lowercase only
  - Alphanumeric characters
  - Allowed separators: underscore (`_`), dash (`-`), dot (`.`)
  - Maximum length: 64 characters
  - Examples:
    - ✅ `seo_specialist`
    - ✅ `content-writer`
    - ✅ `api.v1`
    - ❌ `SEO_Specialist` (uppercase)
    - ❌ `seo specialist` (spaces)
    - ❌ `seo@specialist` (invalid character)

### Tool Names
- **Pattern**: `namespace.entity.action`
- **Persona Tools**: `persona.{id}.get_specification`
  - Example: `persona.seo_specialist.get_specification`
- **Workflow Tools**: `workflow.{id}`
  - Example: `workflow.content_loop`
- **Control Plane Tools**: `control_plane.{action}`
  - Example: `control_plane.health`

### Resource URIs
- **Pattern**: `scheme://namespace/entity`
- **Persona Resources**: `pilotframe://persona/{id}`
  - Example: `pilotframe://persona/seo_specialist`
- **Workflow Resources**: `pilotframe://workflow/{id}`
  - Example: `pilotframe://workflow/content_loop`
- **Resource Templates**: `pilotframe://persona/by-tag/{tag}`
  - Example: `pilotframe://persona/by-tag/seo`

### Prompt Names
- **Pattern**: `workflow-{id}`
- **Example**: `workflow-content_loop`

## UI Validation Rules

### Real-time Validation
1. **ID Input Field**:
   - Automatically sanitizes input (converts to lowercase, removes invalid characters)
   - Shows error message if ID doesn't match MCP pattern
   - Disables save button if ID is invalid
   - Visual indicator: Red border for invalid IDs

2. **MCP Tool Preview**:
   - Shows generated MCP tool name when ID is valid
   - Displays resource URI for reference
   - Helps users understand what will be exposed via MCP

3. **Save Button State**:
   - Disabled if:
     - ID is empty or invalid
     - Name is empty
     - JSON specification has syntax errors
   - Enabled only when all MCP compliance checks pass

### Validation Functions

Located in `frontend/src/utils/mcpValidation.ts`:

- `isValidMcpId(id: string)`: Checks if ID matches MCP pattern
- `getMcpIdError(id: string)`: Returns error message for invalid IDs
- `sanitizeMcpId(input: string)`: Sanitizes user input to be MCP-compliant
- `getPersonaToolName(personaId: string)`: Generates MCP tool name
- `getPersonaResourceUri(personaId: string)`: Generates resource URI
- `getWorkflowToolName(workflowId: string)`: Generates workflow tool name
- `getWorkflowResourceUri(workflowId: string)`: Generates workflow resource URI

## UI Components

### PersonaEditor
- **ID Field**:
  - Real-time validation and sanitization
  - Error message display
  - MCP tool name preview
  - Resource URI preview

- **Visual Indicators**:
  - Red border for invalid IDs
  - Green preview box showing MCP tool name and resource URI
  - Disabled save button for invalid states

### WorkflowEditor
- **Workflow ID Field**:
  - Same validation rules as PersonaEditor
  - Shows workflow tool name and resource URI

- **Step Configuration**:
  - Persona selection dropdown (shows available personas)
  - Condition field (optional)
  - Handoff field (optional)

### PersonaList
- **Display**:
  - Shows persona ID in monospace font
  - Displays MCP tool name for each persona
  - Shows last updated date

## Best Practices

1. **Consistent Naming**: Use `snake_case` for IDs (e.g., `seo_specialist`, `content_writer`)
2. **Descriptive IDs**: Choose IDs that clearly describe the persona/workflow purpose
3. **Namespace Separation**: Use dots for hierarchical organization (e.g., `api.v1`, `api.v2`)
4. **Validation First**: Always validate IDs before saving to prevent MCP server errors
5. **User Feedback**: Show clear error messages and previews to guide users

## Examples

### Valid Persona IDs
```
seo_specialist
content_writer
creative_director
frontend_engineer
api.v1.persona
```

### Valid Workflow IDs
```
content_loop
code_review_workflow
api-deployment-pipeline
```

### Generated MCP Tool Names
```
persona.seo_specialist.get_specification
persona.content_writer.get_specification
workflow.content_loop
workflow.code_review_workflow
```

### Generated Resource URIs
```
pilotframe://persona/seo_specialist
pilotframe://persona/content_writer
pilotframe://workflow/content_loop
pilotframe://workflow/code_review_workflow
```

## References

- [MCP SDK Naming Conventions](https://modelcontextprotocol.io/docs/learn/server-concepts)
- [MCP Specification](https://modelcontextprotocol.io/specification/2024-11-05/server)

