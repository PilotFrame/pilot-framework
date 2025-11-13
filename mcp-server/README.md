# PilotFrame MCP Server

This package exposes PilotFrame persona methods and orchestrator workflows as MCP tools so that agents (Cursor, Claude, etc.) can call them directly.

## Features

- Registers every persona method from `examples/personas/*.json` as a tool (`personaId.methodId`).
- Registers every workflow JSON in `orchestrator/workflows/*.json` as a tool (`workflow.<id>`).
- Forwards tool calls to the existing REST services:
  - Persona methods → `POST /api/invoke`
  - Workflows → `POST /workflows/:id/run` + `/events` stream
- Returns both human-readable output and structured JSON (`structuredContent`).

## Prerequisites

- Control plane running (`npm run dev` from repo root).
- Orchestrator running (`cd orchestrator && npm run dev`).
- Valid bearer token for the control plane (see root README “JWT Auth Stub”).

Optional but recommended:

- Adapter template dev server (`cd adapter-template && npm run dev`).
- Sandbox runner (`cd sandbox-runner && npm run dev`).

## Installation

```bash
cd mcp-server
npm install
```

## Run (stdio transport)

```bash
CONTROL_PLANE_TOKEN=LOCAL_DEV_TOKEN npm run dev
```

Environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `CONTROL_PLANE_URL` | Control plane base URL | `http://localhost:4000` |
| `CONTROL_PLANE_TOKEN` | Bearer token passed to control plane | **required** |
| `ORCHESTRATOR_URL` | Workflow orchestrator base URL | `http://localhost:4100` |
| `PERSONA_SPEC_DIR` | Directory containing persona JSON specs | `../examples/personas` |
| `WORKFLOW_DIR` | Directory containing workflow JSON definitions | `../orchestrator/workflows` |
| `MCP_SERVER_NAME` | Advertised server name | `pilotframe-mcp` |
| `MCP_SERVER_VERSION` | Advertised server version | `0.1.0` |
| `EVENT_STREAM_TIMEOUT_MS` | SSE wait timeout for workflows | `15000` |

## Tool Naming

- Persona methods: `personaId.methodId` (e.g. `sme_simple.sme.set_topic`, `content_writer_simple.writer.create_draft`).
- Workflows: `workflow.<workflowId>` (e.g. `workflow.content_loop`).
- Built-in utility: `control_plane.health`.

## Sample Cursor MCP configuration

```json
{
  "mcpServers": [
    {
      "name": "pilotframe-mcp",
      "command": "npm",
      "args": ["run", "dev:mcp"],
      "cwd": "/absolute/path/to/pf-framework",
      "env": {
        "CONTROL_PLANE_TOKEN": "LOCAL_DEV_TOKEN"
      }
    }
  ]
}
```

## Development

- `npm run dev` – start the MCP server with tsx/stdio (hot reload).
- `npm run build` – compile TypeScript to `dist/`.

Persona specs and workflows are loaded at startup. Modify or add JSON files to surface new tools automatically. Restart the MCP server after changes.

## Troubleshooting

- **401/500 from control plane**: ensure `CONTROL_PLANE_TOKEN` matches the control plane’s `AUTH_JWT_SECRET`.
- **Workflow tools hang**: verify the orchestrator is running and emitting events; adjust `EVENT_STREAM_TIMEOUT_MS` if necessary.
- **No tools listed**: confirm persona/workflow directories have valid JSON (`npm run test` in repo root checks persona specs).

