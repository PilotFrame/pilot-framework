# PilotFrame Security & Access Model

## Identity & Access Controls

- **Azure Active Directory (Entra ID)**
  - `PilotFrame-ControlPlane` app registration issues OAuth tokens for UI and service-to-service calls.
  - Managed identities:
    - `pf-control-plane-mi` (AKS workload) – access to Postgres, Blob Storage, Key Vault.
    - `pf-adapter-mi` (per adapter namespace) – read-only access to adapter secrets, emit telemetry.
    - `pf-sandbox-runner-mi` – launch Azure Container Instances / Temporal workers.
  - Azure AD Groups → App Roles:
    - `Persona.Author`, `Persona.Reviewer`, `Persona.Admin`.
    - Token `roles` claim drives control plane authorization middleware.

```
az ad app update --id <APP_ID> \
  --app-roles @roles.json
```

## Role-Based Access Control

| Role | Capabilities | Restrictions |
| --- | --- | --- |
| Persona.Author | Create/update persona specs, trigger sandbox runs | Cannot approve or promote personas |
| Persona.Reviewer | Approve/reject persona & method revisions | No adapter deployments |
| Persona.Admin | Full access including CI/CD approvals | Must use break-glass workflow |
| Adapter.Agent | Scoped token limited to specific persona IDs | No repo write; only POST /api/invoke |

### Scoped Persona Tokens

Tokens minted via control plane include `scp` claim: `persona:{personaId}:{permission}` (e.g., `persona:seo_specialist:invoke`). Middleware denies write operations unless scope matches target slug.

## Azure Key Vault Usage

- Vault: `kv-pilotframe-dev`
  - Secrets:
    - `CONTROL_PLANE_JWT_SECRET`
    - `POSTGRES-CONN-STRING`
    - `ADAPTER-seo-adapter-token`
    - `HOSTINGER-SFTP-KEY`
- Managed Identity assignment:

```
az keyvault set-policy \
  --name kv-pilotframe-dev \
  --object-id <CONTROL_PLANE_MI_OBJECTID> \
  --secret-permissions get list
```

- Control plane retrieves secrets at startup via managed identity; adapters use Azure Workload Identity to exchange JWT for Key Vault access token.

## Azure Resource Policies

- Require images from ACR:

```json
{
  "if": {
    "allOf": [
      {"field": "type", "equals": "Microsoft.ContainerService/managedClusters"},
      {"field": "Microsoft.ContainerService/managedClusters/agentPoolProfiles[].osSKU", "notEquals": "AzureLinux"}
    ]
  },
  "then": {
    "effect": "audit"
  }
}
```

- Enforce TLS 1.2+ and private endpoints for Postgres and Blob Storage via Azure Policy assignments.

## Audit & Redaction Pipeline

1. Invocation response captured as JSON.
2. Pipeline scans `output`, `logs`, `notes` using regex + allow lists.

```pseudo
function redact(payload):
  patterns = [
    /[0-9]{3}-[0-9]{2}-[0-9]{4}/,        # SSN
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    /\b\d{16}\b/                         # Card numbers
  ]
  for each field in payload recursively:
    if value matches sensitive pattern:
      replace with "[REDACTED]"
  return payload
```

3. Before persisting to Blob Storage, pipeline re-validates size < 2 MB and strips unknown keys.
4. Audit events stored in Postgres `audit_event` and streamed to Event Hub `audit.log`.

## CI/CD Guardrails

- GitHub Actions use OpenID Connect to request short-lived Azure tokens:

```
az ad app federated-credential create \
  --app-id <APP_ID> \
  --issuer "https://token.actions.githubusercontent.com" \
  --subject "repo:PilotFrame/pf-framework:environment:dev" \
  --audience "api://AzureADTokenExchange"
```

- `build-and-deploy-adapter.yml`: requires reviewers before targeting staging/prod.
- `deploy-static-hostinger.yml`: uses SFTP key stored in Key Vault → GitHub secret `HOSTINGER_SFTP_KEY`.

## Logging & Monitoring

- Centralized logging via Azure Monitor → Log Analytics workspace `law-pilotframe`.
- Control plane and adapters emit structured logs with `requestId` / `personaId` context.
- Alerts:
  - Unauthorized access attempts (`401/403`) > 20 per minute.
  - Invocation failure rate > 10% over 15 minutes.
  - Sandbox runner resource exhaustion.

## Incident Response

- Rotation procedure: regenerate `CONTROL_PLANE_JWT_SECRET`, update Key Vault, restart workloads via GitHub Action dispatch.
- Break-glass accounts stored in separate vault with manual approval.

