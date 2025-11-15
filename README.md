# Pilot Framework

**A control plane for authoring, managing, and orchestrating AI personas and workflows through MCP (Model Context Protocol).**

Pilot Framework enables you to create structured AI personas with defined missions, workflows, and constraints, then expose them as tools that AI agents (like Cursor, Claude Desktop) can discover and use. Build complex multi-step workflows that orchestrate multiple personas to accomplish sophisticated tasks.

> Part of the [PilotFrame](https://pilotframe.com) ecosystem

---

## What is Pilot Framework?

Pilot Framework is a platform that bridges the gap between AI agent capabilities and structured, reusable expertise. Instead of asking an AI agent to "be a code reviewer" every time, you define a **persona** once with specific instructions, constraints, and workflows. That persona becomes a discoverable tool that any MCP-compatible AI agent can use.

### Key Concepts

- **Personas**: Structured AI roles with defined missions, inputs, workflows, success criteria, and constraints. Each persona is a reusable expert that AI agents can invoke.
- **Workflows**: Multi-step processes that orchestrate multiple personas in sequence, cycles, or parallel execution patterns.
- **MCP Integration**: Personas and workflows are automatically exposed as MCP tools, making them discoverable by AI agents like Cursor and Claude Desktop.

---

## Features

### 🤖 AI-Assisted Creation
Create personas and workflows through natural language conversation. The AI Assistant understands your requirements and guides you through the creation process, generating valid specifications that match Pilot Framework schemas.

### 📋 Persona Management
- **Visual Editor**: Create and edit persona specifications through an intuitive UI
- **Schema Validation**: Automatic validation ensures personas meet Pilot Framework standards
- **Version Control**: Track changes and maintain persona history
- **MCP Tool Generation**: Each persona automatically becomes an MCP tool (e.g., `persona.seo_specialist.get_specification`)

### 🔄 Workflow Orchestration
- **Multi-Persona Workflows**: Chain multiple personas together to accomplish complex tasks
- **Execution Patterns**: Support for sequential, parallel, cycle, and mixed execution patterns
- **Conditional Logic**: Define handoff rules and conditions between workflow steps
- **Workflow Tools**: Workflows are exposed as MCP tools for AI agents to execute

### 🔌 MCP Integration
- **HTTP-Based MCP Server**: Built-in MCP server endpoint (`/mcp`) that exposes personas and workflows
- **Tool Discovery**: AI agents automatically discover available personas and workflows
- **Resource Access**: Personas and workflows are accessible as MCP resources
- **No Separate Process**: MCP server is integrated into the control plane

### 💬 Conversation Management
- **Persistent Conversations**: All AI Assistant conversations are saved and can be resumed
- **Context Management**: Attach personas/workflows to conversations to maintain context
- **Message Exclusion**: Mark messages as excluded from API context to reduce token usage
- **History Truncation**: Automatic truncation to last 40 messages to prevent token limits

---

## Building Blocks

### Control Plane
The central server that manages personas, workflows, and exposes them via REST API and MCP protocol. Includes:
- REST API for CRUD operations
- MCP server endpoint for AI agent integration
- Schema validation engine
- Conversation persistence
- AI Assistant service

### Frontend UI
React-based web interface for:
- Creating and editing personas
- Designing workflows
- Managing conversations with the AI Assistant
- Testing MCP tools

### Persona Specifications
JSON-based specifications that define:
- **Mission**: What the persona does
- **Inputs**: What information it needs
- **Workflow**: Step-by-step process
- **Success Criteria**: How to measure success
- **Constraints**: Rules and limitations
- **Handoff Expectations**: How it interacts with other personas

### Workflow Definitions
JSON-based definitions that specify:
- **Steps**: Sequence of personas to execute
- **Execution Pattern**: Sequential, parallel, cycle, or mixed
- **Execution Guidance**: Rules for when and how to proceed
- **Exit Conditions**: When the workflow is complete

---

## Quick Start

### Prerequisites
- Node.js 20+
- Azure OpenAI account (for AI Assistant feature)

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

2. **Configure environment:**
   Create a `.env` file:
   ```env
   PORT=4000
   AUTH_JWT_SECRET=LOCAL_DEV_TOKEN
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_API_KEY=your-api-key
   AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5-chat
   ```

3. **Start the control plane:**
   ```bash
   npm run dev
   ```

4. **Start the frontend (in a new terminal):**
   ```bash
   cd frontend
   npm run dev
   ```

5. **Configure Cursor for MCP:**
   Add to `~/.cursor/mcp.json`:
   ```json
   {
     "mcpServers": {
       "pilotframe-mcp": {
         "url": "http://localhost:4000/mcp",
         "headers": {
           "Authorization": "Bearer <YOUR_JWT_TOKEN>"
         }
       }
     }
   }
   ```

For detailed setup instructions, see the [Complete Setup Guide](#complete-setup-guide) below.

---

## Complete Setup Guide

### Step 1: Generate JWT Token
```bash
node -e "console.log(require('jsonwebtoken').sign({ sub: 'dev-user', roles: ['Persona.Author'] }, 'LOCAL_DEV_TOKEN'))"
```
Save this token for frontend and MCP configuration.

### Step 2: Start Services
**Terminal 1 - Control Plane:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend && npm run dev
```

### Step 3: Configure Frontend
1. Open `http://localhost:5173`
2. Enter Control Plane URL: `http://localhost:4000`
3. Paste your JWT token
4. Click "Save Connection"

### Step 4: Configure Cursor MCP
Add to `~/.cursor/mcp.json` (or `C:\Users\<YourUsername>\.cursor\mcp.json` on Windows):
```json
{
  "mcpServers": {
    "pilotframe-mcp": {
      "url": "http://localhost:4000/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_JWT_TOKEN>"
      }
    }
  }
}
```
Restart Cursor to activate MCP integration.

### Step 5: Create Your First Persona
1. In the frontend UI, click **"+ New Persona"**
2. Enter an ID (e.g., `seo_specialist`)
3. Fill in the specification JSON
4. Click **"Save Persona"**

The persona will automatically be available as an MCP tool: `persona.seo_specialist.get_specification`

### Troubleshooting
- **Port 4000 in use**: Change `PORT` in `.env` or kill the process using the port
- **401 Unauthorized**: Verify `AUTH_JWT_SECRET` matches the secret used to generate your token
- **MCP not working**: Ensure control plane is running and Cursor is restarted after configuration changes

For detailed troubleshooting and advanced configuration, see the technical documentation in `/docs`.

---

## Documentation

### Technical Documentation
All technical documentation is located in the [`/docs`](./docs/) folder:

- **[Architecture](./docs/architecture/)** - System architecture and design decisions
  - [Spec Registry Domain](./docs/architecture/spec-registry-domain.md)
  - [Adapter Template](./docs/architecture/adapter-template.md)
  - [Sandbox Runner](./docs/architecture/sandbox-runner.md)

- **[Features](./docs/features/)** - Feature documentation
  - [AI-Assisted Creation](./docs/features/ai-assisted-creation.md)

- **[MCP Integration](./docs/mcp-hierarchical-structure.md)** - MCP protocol details and tool structure

- **[UI Guidelines](./docs/ui-mcp-rules.md)** - UI rules and MCP compliance

- **[Operations](./docs/ops/)** - Deployment and CI/CD guides
  - [CI/CD Blueprint](./docs/ops/cicd-blueprint.md)
  - [Secrets Management](./docs/ops/cicd-secrets.md)

- **[Vision](./docs/VISION.md)** - Project vision and roadmap

### API Documentation
- REST API endpoints are documented in the codebase
- MCP tools are automatically discoverable via the `/mcp/tools` endpoint

---

## Project Structure

```
pf-framework/
├── src/server/          # Control plane server (Express + TypeScript)
├── frontend/            # React UI for persona/workflow management
├── schemas/             # JSON schemas for persona and workflow validation
├── examples/            # Example personas and workflows
├── docs/                # Technical documentation
├── migrations/          # Database migrations
└── mcp-server/          # Standalone MCP server (optional, HTTP endpoint preferred)
```

---

## Key Capabilities

### For Developers
- **REST API**: Full CRUD operations for personas and workflows
- **Schema Validation**: Automatic validation using JSON Schema
- **Type Safety**: Full TypeScript support
- **Extensible**: Plugin architecture for custom persona types

### For AI Agents
- **Tool Discovery**: Automatic discovery of available personas and workflows
- **Specification Access**: Get detailed persona specifications on demand
- **Workflow Execution**: Execute multi-step workflows through MCP
- **Resource Access**: Access personas and workflows as MCP resources

### For Content Creators
- **AI Assistant**: Natural language interface for creating personas
- **Visual Editors**: Intuitive UI for editing specifications
- **Conversation History**: Persistent conversations with context management
- **Template Library**: Example personas and workflows to learn from

---

## Contributing

This is an active development project. For contribution guidelines and development setup, see the technical documentation in `/docs`.

---

## License

[Add your license here]

---

## Support

For issues, questions, or contributions, please refer to the documentation in `/docs` or open an issue in the repository.
