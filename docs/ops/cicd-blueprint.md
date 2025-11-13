---
title: CI/CD Blueprint
status: draft
owner: devops
tags:
  - cicd
  - azure
  - hostinger
---

# CI/CD Blueprint

## Pipeline Goals
- Support dev → staging → prod promotion model for control plane (AKS) and static UI (Hostinger).
- Enforce gated approvals, automated testing, and secure secret management via Azure Key Vault.
- Provide visibility into build/test/deploy status across adapters and UI.

## Environments
| Environment | Purpose | Infra | Promotion |
|-------------|---------|-------|-----------|
| Dev | Rapid iteration | AKS dev cluster, Postgres dev, Blob dev | Auto-deploy on merge to `main` |
| Staging | Pre-prod validation | AKS staging cluster, Postgres staging | Manual approval from DevOps lead |
| Prod | Production workloads | AKS prod cluster, Postgres prod | Manual approval + change ticket |

## Pipelines

### Backend (Control Plane)
- Trigger: PR (lint/test), `main` (build + deploy dev), release tag (staging/prod).
- Steps:
  1. Checkout, setup Node 20, restore cache.
  2. `npm ci`, `npm run lint`, `npm test`.
  3. Build Docker image `pf-control-plane:${GIT_SHA}`.
  4. Login to ACR via Azure OIDC (`azure/login` action).
  5. Push image, update Helm chart values.
  6. Deploy to AKS using `kubectl set image` or Helm upgrade.
  7. Run migrations via `npm run migrate`.
  8. Notify channel with deployment summary.
- Secrets: `AZURE_CREDENTIALS`, `AKS_RESOURCE_GROUP`, `AKS_CLUSTER_NAME`, stored in GitHub Encrypted Secrets referencing Key Vault.

### Frontend (Hostinger)
- Trigger: merge to `main`.
- Steps:
  1. Install dependencies.
  2. Run lint/tests (`npm run lint`, `npm run test`).
  3. Build static assets (`npm run build`).
  4. Sync artifacts to Hostinger via Git integration or SFTP (`lftp`/`sftp`).
  5. Purge Hostinger cache (if available).
- Secrets: `HOSTINGER_SFTP_HOST`, `HOSTINGER_SFTP_USER`, `HOSTINGER_SFTP_KEY`.

### Adapter Template
- Provides reusable workflow `build-and-deploy-adapter.yml`:
  - Build adapter image, run unit tests, push to ACR, deploy to adapter namespace in AKS.
  - Accepts inputs `adapter_name`, `dockerfile`, `deploy_manifest`.

### Sandbox Runner
- Workflow `.github/workflows/test-runner.yml` (Prompt 6) triggered on PR or manual dispatch.
- Executes sandbox integration tests against new adapter images.

## Promotion Strategy
- Utilize GitHub environments with required reviewers.
- Artifacts promoted by retagging images and reusing Helm chart values.
- Static assets promoted via branch protection in Hostinger git repo.

## Observability & Rollback
- Integrate GitHub Deployment API for status tracking.
- Capture deployment logs in Blob Storage `deployments/`.
- Rollback: redeploy previous Helm revision (backend) or checkout prior commit in Hostinger repo.

## Compliance
- All workflows signed with GitHub OIDC to avoid persisting credentials.
- Periodic secret rotation documented in `security.md`.
- Maintain deployment audit trail referencing Azure Monitor activity logs.

