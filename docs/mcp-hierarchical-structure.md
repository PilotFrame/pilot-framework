# PilotFrame MCP Hierarchical Structure

Based on [MCP Server Concepts](https://modelcontextprotocol.io/docs/learn/server-concepts), we've implemented a hierarchical tool organization that follows MCP best practices.

## Architecture Overview

Our MCP server exposes three types of capabilities following MCP's hierarchical control plane:

| Feature | Control | Purpose | Implementation Status |
|---------|---------|---------|----------------------|
| **Tools** | Model-controlled | Functions LLMs can call autonomously | ✅ Implemented |
| **Resources** | Application-controlled | Read-only context for applications | 🔄 Placeholder (SDK API pending) |
| **Prompts** | User-controlled | Pre-built instruction templates | 🔄 Placeholder (SDK API pending) |

## Hierarchical Tool Structure

### 1. Persona Tools (Standalone)

**Namespace:** `persona.*`

These are **standalone tools** that agents can use independently, without needing a workflow:

#### `persona.list`
- **Purpose**: Discover available personas
- **Input**: Optional `filter_by_tag` (e.g., "seo", "content")
- **Output**: List of personas with IDs, names, tags, and tool names
- **Use Case**: Agent wants to find which personas are available for a task

#### `persona.{id}.get_specification`
- **Purpose**: Get specification/instructions for a specific persona
- **Input**: Optional `context` string
- **Output**: Structured persona specification with instructions
- **Use Case**: Agent needs to understand how to work as a specific persona

**Example Tool Names:**
- `persona.seo_specialist.get_specification`
- `persona.content_writer.get_specification`
- `persona.creative_director.get_specification`

### 2. Workflow Tools (Orchestration)

**Namespace:** `workflow.*`

These tools orchestrate multiple personas in sequence:

#### `workflow.{id}`
- **Purpose**: Get workflow definition and step-by-step instructions
- **Input**: Optional `input` context
- **Output**: Workflow steps with persona references and execution order
- **Use Case**: Agent wants to execute a multi-step workflow

**Example Tool Names:**
- `workflow.content_loop` - Content creation workflow
- `workflow.code_review` - Code review workflow

### 3. Control Plane Tools

#### `control_plane.health`
- **Purpose**: Check control plane health
- **Use Case**: Debugging and monitoring

## Standalone vs. Workflow Usage

### Standalone Persona Usage

Agents can use personas directly without workflows:

```
1. Agent calls: persona.list(filter_by_tag: "seo")
2. Agent receives: List of SEO personas
3. Agent calls: persona.seo_specialist.get_specification(context: "Review this blog post")
4. Agent receives: SEO specialist instructions
5. Agent follows instructions to complete the task
```

### Workflow Usage

Agents can use workflows that orchestrate multiple personas:

```
1. Agent calls: workflow.content_loop(input: {topic: "MCP tutorial"})
2. Agent receives: Workflow steps:
   - Step 1: persona.sme_simple (set topic)
   - Step 2: persona.content_writer_simple (write draft)
   - Step 3: persona.seo_simple (review content)
   - Step 4: persona.sme_simple (final review)
3. Agent executes each step by calling persona tools in sequence
```

## Benefits of Hierarchical Structure

1. **Discoverability**: `persona.list` helps agents find available personas
2. **Flexibility**: Agents can use personas standalone OR through workflows
3. **Modularity**: Each persona is a self-contained tool
4. **Composability**: Workflows compose multiple personas
5. **Namespace Clarity**: Clear separation between `persona.*` and `workflow.*`

## Future Enhancements (When SDK Supports)

### Resources (Application-Controlled)

- `pilotframe://persona/{id}` - Direct persona spec access
- `pilotframe://persona/by-tag/{tag}` - Filter personas by tag
- `pilotframe://workflow/{id}` - Direct workflow definition access

**Use Case**: Applications can browse personas in a tree view, search by tags, or automatically include relevant persona specs as context.

### Prompts (User-Controlled)

- `workflow-content-loop` - Slash command for content creation
- `workflow-code-review` - Slash command for code review
- `list-workflows` - Discover available workflows

**Use Case**: Users can invoke workflows via slash commands with parameter completion, making workflows feel like native editor features.

## Example: Complete Agent Flow

```
User: "Write a blog post about MCP"

Agent Flow:
1. Calls persona.list() → Discovers available personas
2. Calls workflow.content_loop(input: {topic: "MCP"}) → Gets workflow steps
3. For each workflow step:
   a. Calls persona.{id}.get_specification() → Gets persona instructions
   b. Follows instructions to complete step
   c. Passes results to next step
4. Returns final result to user
```

## Implementation Files

- `mcp-server/src/personaTools.ts` - Persona tool registration
- `mcp-server/src/workflowTools.ts` - Workflow tool registration
- `mcp-server/src/personaResources.ts` - Placeholder for resources
- `mcp-server/src/workflowResources.ts` - Placeholder for resources
- `mcp-server/src/workflowPrompts.ts` - Placeholder for prompts
- `mcp-server/src/index.ts` - Main server setup

## References

- [MCP Server Concepts](https://modelcontextprotocol.io/docs/learn/server-concepts)
- [MCP Specification](https://modelcontextprotocol.io/specification/2024-11-05/server)

