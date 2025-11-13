---
title: CI/CD Secrets Reference
status: draft
owner: devops
tags:
  - cicd
  - azure
  - hostinger
---

# CI/CD Secrets Reference

## Azure

| Secret | Usage | Notes |
| --- | --- | --- |
| `AZURE_CREDENTIALS` | Federated credential for `azure/login` (OIDC) | Generate via `az ad sp create-for-rbac --sdk-auth` and store in GitHub |
| `ACR_NAME` | Azure Container Registry name | Lowercase |
| `AKS_RESOURCE_GROUP` | Resource group for AKS cluster | Required for `az aks get-credentials` |
| `AKS_CLUSTER_NAME` | AKS cluster name | Example: `pf-aks-dev` |
| `ADAPTOR_NAMESPACE` | Kubernetes namespace for persona adapters | Optional (defaults `persona-adapters`) |

## Hostinger

| Secret | Usage | Notes |
| --- | --- | --- |
| `HOSTINGER_SFTP_HOST` | SFTP endpoint (e.g., `ftp.example.com`) | Provided by Hostinger portal |
| `HOSTINGER_SFTP_USER` | Deployment user | Recommend dedicated deploy user |
| `HOSTINGER_SFTP_KEY` | Private key (PEM) for SFTP auth | Use read-only while deploying |
| `HOSTINGER_DEPLOY_PATH` | Remote path (default `/public_html`) | Optional |
| `HOSTINGER_CACHE_PURGE_URL` | Optional HTTP endpoint to flush CDN cache | Leave unset if not available |

## Sandbox Runner (optional)

| Secret | Usage |
| --- | --- |
| `SANDBOX_AZURE_CLIENT_ID` | Future: ACI integration |
| `SANDBOX_AZURE_TENANT_ID` | Future: ACI integration |

## Token Handling

- Use Azure Key Vault to back GitHub repository secrets (automation script rotates them quarterly).
- Grant read-only access to CI/CD identities.
- For adapter scoped tokens, mint persona-specific secrets and store in Key Vault under `persona/{slug}/token`.

