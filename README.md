# PilotFrame MCP Control Plane (Skeleton)

> Be strict about Azure + Hostinger constraints. Prefer managed Azure services when possible. Keep persona specs versioned, small, and audited. Give machine-readable JSON artifacts and a brief human summary. When uncertain, pick conservative security defaults.

This repository contains the PilotFrame control plane MVP skeleton implemented with Node.js + TypeScript. It exposes REST endpoints for persona management and mock method invocation, integrates with PostgreSQL (Azure Database for PostgreSQL), and includes persona spec schema validation.

## Complete Setup Guide: From Zero to MCP Integration

This guide walks you through setting up the entire PilotFrame system, adding personas, and configuring Cursor to use MCP tools.

### Prerequisites

- **Node.js 20+** installed
- **Git** (to clone the repository)
- **Cursor IDE** (or Claude Desktop) for MCP integration
- **Windows PowerShell** or **Command Prompt** (for Windows users)

---

### Step 1: Install Dependencies

1. **Clone and navigate to the repository:**
   ```bash
   cd pf-framework
   ```

2. **Install root dependencies:**
   ```bash
   npm install
   ```

3. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Install MCP server dependencies:**
   ```bash
   cd mcp-server
   npm install
   cd ..
   ```

---

### Step 2: Configure Environment Variables

1. **Create `.env` file in the root directory:**
   ```bash
   # Windows PowerShell
   New-Item .env
   
   # Or manually create .env file
   ```

2. **Add the following to `.env`:**
   ```env
   PORT=4000
   AUTH_JWT_SECRET=LOCAL_DEV_TOKEN
   NODE_ENV=development
   
   # Azure OpenAI Configuration (for AI Assistant feature)
   AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
   AZURE_OPENAI_API_KEY=your-api-key
   AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5
   ```
   
   **Note:** The AI Assistant feature requires Azure OpenAI credentials. If you don't have them yet, you can skip these variables and the assistant feature will show an error when used.

3. **Generate a JWT token for API authentication:**
   ```bash
   node -e "console.log(require('jsonwebtoken').sign({ sub: 'dev-user', roles: ['Persona.Author'] }, 'LOCAL_DEV_TOKEN'))"
   ```
   
   **Save this token** - you'll need it for the frontend and MCP server configuration.

   Example output:
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXYtdXNlciIsInJvbGVzIjpbIlBlcnNvbmEuQXV0aG9yIl0sImlhdCI6MTc2MjY5MTU5NX0.RZkjGfoV2JqBVPFZolYSMN4sOJg_dBJPuDw2-1TDmNc
   ```

---

### Step 3: Start the Control Plane

1. **Open a terminal and start the control plane:**
   ```bash
   npm run dev
   ```

2. **Verify it's running:**
   - You should see: `Server listening on http://localhost:4000`
   - Test health endpoint:
     ```bash
     # Windows PowerShell
     curl.exe http://localhost:4000/health
     
     # Windows Command Prompt
     curl.exe http://localhost:4000/health
     ```
   - Expected response: `{"status":"ok","dependencies":{"database":"not_configured"},"timestamp":"..."}`

3. **Keep this terminal open** - the control plane must stay running.

---

### Step 4: Start the Frontend UI

1. **Open a new terminal** and navigate to the frontend directory:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Open your browser** and navigate to: `http://localhost:5173`

3. **Configure the connection:**
   - **Control Plane URL**: `http://localhost:4000`
   - **Bearer Token**: Paste the JWT token you generated in Step 2
   - Click **Save Connection**

4. **Verify connection:**
   - You should see "Saved connection" message
   - The Persona Registry panel should load (may be empty initially)

---

### Step 5: Add a Persona via UI

1. **In the frontend UI**, click **"+ New Persona"** button in the Persona Registry panel

2. **Fill in the persona details:**
   - **ID**: Enter a MCP-compliant ID (e.g., `seo_specialist`)
     - Must be lowercase, alphanumeric, with underscores/dashes/dots only
     - The UI will auto-sanitize invalid characters
     - You'll see a preview of the MCP tool name: `persona.seo_specialist.get_specification`
   
   - **Name**: Enter a human-friendly name (e.g., `SEO Specialist`)
   
   - **Tags**: Optional comma-separated tags (e.g., `seo, content, review`)
   
   - **Specification**: Enter JSON specification. Example:
     ```json
     {
       "mission": "Provide structured SEO review instructions for long-form content.",
       "inputs": [
         "Draft text",
         "Target keyword",
         "Business goal"
       ],
       "workflow": [
         "Scan the brief to understand the target audience and primary keyword intent.",
         "Review the draft for coverage, structure, tone, metadata gaps.",
         "Provide feedback grouped by priority (high/medium/low)."
       ],
       "success_criteria": [
         "Draft addresses target keyword intent within the first 150 words.",
         "Headings and sub-headings contain keyword variations.",
         "Tone aligns with brand guidelines."
       ],
       "constraints": [
         "Avoid suggesting black-hat tactics.",
         "Do not expose raw analytics or sensitive data."
       ]
     }
     ```

3. **Click "Save Persona"**
   - You should see a success message: "Saved SEO Specialist"
   - The persona should appear in the Persona Registry list

4. **Verify the persona was created:**
   - Check the Persona Registry - your new persona should be listed
   - Click on it to edit/view details
   - The MCP tool name should be visible: `persona.seo_specialist.get_specification`

---

### Step 6: Create a Workflow (Optional)

1. **In the frontend UI**, scroll down to the **Workflow Editor** section

2. **Click "+ New Workflow"**

3. **Fill in workflow details:**
   - **Workflow ID**: `content_loop` (MCP-compliant)
   - **Name**: `Content Creation Loop`
   - **Steps**: Click "+ Add Step" and select personas in order:
     - Step 1: Select a persona (e.g., `seo_specialist`)
     - Step 2: Add another step with a different persona
     - Optionally add conditions or handoff rules

4. **Click "Save Workflow"**

---

### Step 7: Configure Cursor for MCP (HTTP-based)

The control plane now exposes an HTTP-based MCP endpoint at `/mcp`. This means you can connect via URL instead of starting a local process.

1. **Locate Cursor's MCP configuration file:**
   - **Windows**: `C:\Users\<YourUsername>\.cursor\mcp.json`
   - **macOS/Linux**: `~/.cursor/mcp.json`

2. **Open `mcp.json` in a text editor**

3. **Add the PilotFrame MCP server configuration:**
   
   If the file doesn't exist, create it with:
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
   
   If the file already exists (e.g., with other MCP servers), merge the `pilotframe-mcp` entry:
   ```json
   {
     "mcpServers": {
       "microsoft.learn": {
         "url": "https://learn.microsoft.com/api/mcp"
       },
       "pilotframe-mcp": {
         "url": "http://localhost:4000/mcp",
         "headers": {
           "Authorization": "Bearer <YOUR_JWT_TOKEN>"
         }
       }
     }
   }
   ```

4. **Important Configuration Notes:**
   - Replace `<YOUR_JWT_TOKEN>` with the actual JWT token from Step 2
   - The MCP server is now part of the control plane - no separate process needed!
   - For production, replace `http://localhost:4000` with your deployed control plane URL
   - The `/mcp` endpoint requires authentication via Bearer token

---

### Step 8: Verify MCP Integration in Cursor

1. **Restart Cursor** completely (close and reopen)

2. **Check MCP server connection:**
   - Open Cursor's MCP panel (if available)
   - Look for `pilotframe-mcp` in the list of connected servers
   - Check for any error messages

3. **Test MCP tools:**
   - In a Cursor chat, try asking: "List available personas"
   - The agent should be able to call `persona.list` tool
   - Try: "Get the specification for the SEO specialist persona"
   - The agent should call `persona.seo_specialist.get_specification`

4. **Available MCP Tools:**
   - `persona.list` - List all available personas
   - `persona.{id}.get_specification` - Get persona specification (e.g., `persona.seo_specialist.get_specification`)
   - `workflow.{id}` - Get workflow definition (e.g., `workflow.content_loop`)
   - `control_plane.health` - Check control plane health

---

### Troubleshooting

#### Control Plane Issues

- **Port 4000 already in use:**
  
  **Windows PowerShell/CMD:**
  ```powershell
  # Find what's using port 4000
  netstat -ano | findstr :4000
  
  # Kill the process (replace PID with the actual process ID)
  taskkill /PID <PID> /F
  
  # Or change PORT in .env file
  PORT=4001
  ```
  
  **macOS/Linux:**
  ```bash
  # Find what's using port 4000
  lsof -i :4000
  
  # Kill the process
  kill -9 <PID>
  
  # Or change PORT in .env file
  PORT=4001
  ```

- **401 Unauthorized errors:**
  - Verify `AUTH_JWT_SECRET` in `.env` matches the secret used to generate the JWT token
  - Regenerate the token if needed

#### Frontend Issues

- **CORS errors:**
  - Ensure control plane is running
  - Check that the URL in the frontend matches the control plane URL

- **Connection fails:**
  - Verify the JWT token is correct
  - Check browser console for error messages

#### MCP Server Issues

- **Cursor can't connect to MCP server:**
  - Ensure control plane is running (`npm run dev`)
  - Verify `mcp.json` syntax is valid JSON
  - Check that the URL in `mcp.json` matches your control plane URL (`http://localhost:4000/mcp`)
  - Verify the Bearer token in `mcp.json` headers matches your JWT token
  - Check Cursor's MCP logs for error messages

- **No tools appear in Cursor:**
  - Verify personas exist in `examples/personas/` directory
  - Check that persona JSON files are valid
  - Test the `/mcp/tools` endpoint directly: `curl -H "Authorization: Bearer <TOKEN>" http://localhost:4000/mcp/tools`
  - Restart Cursor after making changes

#### Common Windows-Specific Issues

- **PowerShell execution policy:**
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

- **Path issues in mcp.json:**
  - Use forward slashes: `C:/Dev/BytesFromAli/pf-framework`
  - Or escape backslashes: `C:\\Dev\\BytesFromAli\\pf-framework`

---

### Quick Reference: Running Services

You need **2 terminals** running simultaneously:

1. **Terminal 1 - Control Plane (includes MCP server):**
   ```bash
   npm run dev
   ```
   The control plane now includes the MCP server at `/mcp` endpoint - no separate process needed!

2. **Terminal 2 - Frontend (optional, for UI):**
   ```bash
   cd frontend
   npm run dev
   ```

---

### Next Steps

Once everything is running:

1. **Create more personas** via the UI
2. **Create workflows** that orchestrate multiple personas
3. **Use Cursor** to interact with personas via MCP tools
4. **Test workflows** by asking Cursor to execute them

For more details, see:
- [MCP Hierarchical Structure](./docs/mcp-hierarchical-structure.md)
- [UI MCP Rules](./docs/ui-mcp-rules.md)

## Architecture & Development

### Features

- **AI Assistant**: Natural language chat interface to create personas and workflows using Azure OpenAI GPT-5
- **Persona Management**: Create, edit, and version persona specifications via UI or API
- **Workflow Management**: Define multi-step workflows that orchestrate multiple personas
- **MCP Integration**: Expose personas and workflows as MCP tools for AI agents (Cursor, Claude Desktop)
- **Schema Validation**: Automatic validation of persona and workflow specifications
- **REST API**: Full CRUD API for personas and workflows with JWT authentication

- REST API (Express)
  - `GET /health`
  - `POST /mcp` - MCP protocol endpoint (JSON-RPC 2.0)
  - `GET /mcp/tools` - List MCP tools (requires auth)
  - `POST /mcp/tools/:toolName` - Call MCP tool (requires auth)
  - `GET /mcp/resources` - List MCP resources (requires auth)
  - `GET /api/personas` - List all personas
  - `GET /api/personas/:id/spec` - Get persona specification
  - `POST /api/personas` - Create persona
  - `POST /api/workflows` - Create workflow
  - `GET /api/workflows/:id` - Get workflow
  - `POST /api/assistant/chat` - AI Assistant chat endpoint (requires auth)
  - `POST /api/invoke` - Invoke persona method
- Persona spec JSON Schema + AJV tests
- Postgres migrations (`migrations/0001_init.sql`)
- Basic JWT auth stub (HS256 secret)
- Dockerfile optimized for Azure Container Registry builds
- Security model reference (`security.md`)

### Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | HTTP port | `4000` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | Postgres connection string | unset (in-memory fallback) |
| `AUTH_JWT_SECRET` | HS256 secret for JWT validation | **required** |
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` | `info` |
| `AZURE_KEY_VAULT_URI` | Optional reference for secret sourcing | unset |
| `AZURE_BLOB_URL` | Optional audit log storage | unset |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL | unset (required for AI Assistant) |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | unset (required for AI Assistant) |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Azure OpenAI deployment name (e.g., gpt-5-chat) | `gpt-5-chat` |
| `AZURE_OPENAI_API_VERSION` | API version (auto-detected for GPT-5: 2025-08-07) | auto-detected |

### Database Migrations

```bash
DATABASE_URL=postgres://... npm run migrate
```

Uses `scripts/run-migrations.js` to apply SQL in `migrations/`.

### Testing

```
npm test
```

Validates sample persona specs against `schemas/persona-spec.schema.json`.

### Docker Build (Azure-ready)

```bash
docker build -t pf-control-plane:dev .
docker run -p 4000:4000 \
  -e AUTH_JWT_SECRET=LOCAL_DEV_TOKEN \
  pf-control-plane:dev
```

Push to Azure Container Registry:

```bash
az acr login --name <registry>
docker tag pf-control-plane:dev <registry>.azurecr.io/pf-control-plane:dev
docker push <registry>.azurecr.io/pf-control-plane:dev
```

### Directory Structure

- `schemas/` – persona spec schema
- `examples/personas/` – sample persona specs
- `src/server/` – Express app, routes, services
- `frontend/` – React UI for persona/workflow management
- `mcp-server/` – MCP server exposing personas/workflows as tools
- `migrations/` – Postgres schema migrations
- `security.md` – Azure identity, Key Vault, RBAC, redaction guidance


### kill Server

`netstat -ano | findstr :4000
taskkill /PID 7912 /F`