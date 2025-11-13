---
title: Adapter Template Blueprint
status: draft
owner: backend_engineer
tags:
  - adapter
  - template
  - nodejs
---

# Adapter Template Blueprint

## Purpose
- Provide a standardised Node.js/TypeScript scaffolding for persona adapters.
- Ensure adapters expose canonical endpoints, validate inputs, and integrate with control plane telemetry/audit requirements.
- Facilitate quick bootstrap via CLI (T-008) with sensible Azure defaults.

## Directory Structure (Generated)
```
adapter-name/
├─ src/
│  ├─ index.ts          # HTTP server bootstrap
│  ├─ routes/
│  │  ├─ spec.ts        # GET /spec
│  │  └─ methods.ts     # POST /methods/:methodId
│  ├─ services/
│  │  ├─ evaluator.ts   # Business logic per method
│  │  └─ telemetry.ts   # Control plane logging client
│  ├─ config.ts
│  └─ validations/
│     └─ evaluateContent.schema.json
├─ spec/
│  └─ persona.json      # Persona spec reference
├─ scripts/
│  ├─ register.ts       # Registers spec with control plane
│  └─ dry-run.ts        # Local dry-run helper
├─ Dockerfile
├─ package.json
└─ README.md
```

## Runtime Responsibilities
- Serve `GET /spec` returning the persona schema consumed by control plane ingestion (Prompt 4 requirement).
- Handle method invocations via `POST /methods/:methodId`:
  - Validate request body against AJV schema.
  - Support `dry_run` flag to short-circuit execution and return plan summary.
  - Produce structured response containing `output`, `evaluation`, `logs`.
- Emit invocation telemetry to control plane `/api/invocations` with retry/backoff (exponential).
- Propagate request correlation IDs via headers `x-pf-request-id`.

## Configuration
- Environment variables (dotEnv + Azure App Config compatibility):
  - `PORT`
  - `CONTROL_PLANE_URL`
  - `CONTROL_PLANE_TOKEN` (retrieved from Azure Key Vault via Managed Identity where available).
  - `ADAPTER_ID`
  - `LOG_LEVEL`
- Provide `config.ts` helper that sources values with defaults and validates using `zod`.

## Deployment Targets
- Docker container deployed to AKS (primary).
- Optional Azure Container Instances for lightweight environments (sandbox runner).
- Template includes GitHub Action (T-009) for build/test/publish to ACR.

## Security & Compliance
- Enforce HTTPS-only deployments.
- Rotate control plane tokens via Key Vault referencing (`SecretClient`).
- Mask PII in logs by reusing shared redaction middleware.
- Provide `SECURITY.md` guidance inside generated repo (future).

## Extension Points
- `services/evaluator.ts` exports functions per method (e.g., `evaluateContent`).
- Additional methods defined by adding schema + handler and updating spec manifest.
- Support for tool invocations via pluggable `toolRegistry` (future iteration).

## CLI Integration
- CLI parameters: `adapter-cli create --name seo-adapter --persona ./spec/seo.json`.
- Options for selecting TypeScript vs JavaScript (default TS).
- `--register` flag runs registration script post-build.

## Testing
- Include Jest or Vitest suite validating method handler logic and schema compliance.
- Provide contract test hitting control plane mock to ensure telemetry payload shape.

## Observability
- Structured logs with `pino` (JSON output).
- Metrics exported via OpenTelemetry (HTTP duration, invocation counts, error rate).
- Health endpoint `/healthz` for AKS probes.

