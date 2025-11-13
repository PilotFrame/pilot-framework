# PilotFrame Control Plane UI (React + Tailwind)

> Be strict about Azure + Hostinger constraints. Prefer managed Azure services when possible. Keep persona specs versioned, small, and audited. Give machine-readable JSON artifacts and a brief human summary. When uncertain, pick conservative security defaults.

This single-page React app provides a lightweight interface for authoring persona specifications, editing persona methods, and triggering mock invocations against the control plane API.

## Features

- Connects to the control plane via configurable base URL + bearer token.
- Persona Registry panel listing personas from `GET /api/personas`.
- Schema-driven persona editor:
  - Form view generated from `persona-spec.schema.json`.
  - Raw JSON view for full-control edits.
  - Persists via `POST /api/personas`.
- Method editor:
  - Edit method metadata, schemas, samples, and dry-run payloads.
  - Saves back into persona spec.
  - Run Test button calls `POST /api/invoke` and displays response.

## Prerequisites

- Node.js 20+
- Control plane API running locally (`npm run dev` in project root) or accessible remote endpoint.

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

The app runs on [http://localhost:5173](http://localhost:5173). Configure the control plane URL and bearer token in the “Connection” panel before making API calls.

### Build

```bash
npm run build
npm run preview
```

## Tailwind & Styling

TailwindCSS powers utility styling. The design leans on a neutral dark theme that aligns with Azure dashboards and Hostinger static hosting target.

## Deployment

Hostinger-compatible static output is produced by `npm run build` (Vite). Copy `dist/` contents to Hostinger via git or SFTP as documented in CI pipelines.

## Troubleshooting

- **401 / Unauthorized** – Ensure `AUTH_JWT_SECRET` is set for the control plane and the provided bearer token matches.
- **Schema validation errors** – Client-side edits rely on the canonical JSON Schema. Errors appear inline for JSON fields.
- **CORS** – For local development, run the control plane with permissive CORS (default in this repo).

