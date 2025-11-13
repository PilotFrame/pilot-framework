---
title: Sandbox Runner Architecture
status: draft
owner: devops
tags:
  - sandbox
  - temporal
  - observability
---

# Sandbox Runner Architecture

## Goals
- Execute persona adapter methods in an isolated environment with resource governance.
- Capture stdout/stderr, metrics, and evaluation data while redacting sensitive information.
- Provide unified API for control plane (`/api/sandbox/runs`) and GitHub Actions workflow (Prompt 6).

## Execution Model
- Primary orchestration via Temporal workflow hosted on AKS cluster.
- Activity flow:
  1. `SubmitRun` – persist request, enqueue Temporal workflow, emit audit event.
  2. `ProvisionSandbox` – decide between Azure Container Instances (ACI) vs local Docker fallback (configurable).
  3. `ExecuteMethod` – run container with `docker run` (local) or ACI job invocation; inject input JSON via mounted file; enforce CPU/memory/time limits.
  4. `CollectResults` – gather stdout/stderr, exit code, metrics.
  5. `FinalizeRun` – redact logs, persist results to Blob Storage, update run status, emit completion event.

## Resource Policies
- Default limits: CPU 1 vCore, Memory 2 GiB, Timeout 120 s.
- Support overrides per persona/method with guardrails (max CPU 2, memory 4 GiB, timeout 300 s).
- Network policy: outbound only to control plane URL (allow list).

## Data Flow
1. Control plane receives `/api/sandbox/runs` request with payload:
   ```json
   {
     "personaId": "uuid",
     "methodId": "seo.evaluate_content",
     "adapterImage": "pf.azurecr.io/seo-adapter:sha",
     "input": { "...": "..." },
     "dryRun": false
   }
   ```
2. Service persists run metadata in Postgres (`sandbox_run` table).
3. Temporal workflow orchestrates container execution; results stored in Azure Blob Storage container `sandbox-runs`.
4. Redacted summary returned via API (`status`, `evaluation`, `logsPreview`).

## Components
- **API Layer (Node/TS)**: handles requests, validates payloads, authenticates via Azure AD tokens.
- **Runner Service**: interacts with Temporal SDK or queue, manages container lifecycle.
- **Log Redactor**: shared module using regex + ML-based detection (future) to mask PII.
- **Storage Layer**: Postgres tables (`sandbox_run`, `sandbox_run_log`), Blob Storage for large logs.
- **Event Publisher**: emits events to Event Hub topic `sandbox.run.state_changed`.

## Azure Integration
- Temporal deployed on AKS with Azure Managed Identity.
- ACI Runner uses user-assigned managed identity for Key Vault secret retrieval.
- Blob Storage container protected via private endpoint.
- Monitoring via Azure Monitor + Log Analytics workspace.

## API Contracts
- `POST /api/sandbox/runs`: create run, returns run ID.
- `GET /api/sandbox/runs/:id`: fetch status and latest results.
- `GET /api/sandbox/runs/:id/logs`: stream redacted logs.
- Webhook callback for GitHub Actions (optional) to update workflow status.

## Observability
- Emit metrics: run duration, success/error counts, resource utilisation (from container stats).
- Capture structured logs with correlation ID `runId`.
- Alerts: high failure rate, timeouts, resource exhaustion.

## Security
- Enforce signed container images from ACR (content trust).
- Use temporary SAS tokens for Blob log access.
- All stored logs pass through redaction pipeline (see `security.md`).

## Open Questions
- Should we cache adapter images to reduce cold start for ACI?
- Fallback strategy if Temporal cluster unavailable (queue-based runner).

