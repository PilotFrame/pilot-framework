---
title: Persona Spec Registry Domain Model
status: draft
owner: backend_engineer
tags:
  - spec-registry
  - postgres
  - audit
---

# Persona Spec Registry Domain Model

## Goals
- Persist persona specifications with full version history and immutable audit trail.
- Expose CRUD APIs for authoring tools while enforcing Azure AD role checks and scoped tokens for automations.
- Support downstream consumers (method editor, adapters, sandbox runner) with canonical persona data.

## Core Entities

| Entity | Description | Key Fields |
| ------ | ----------- | ---------- |
| `persona_spec` | Canonical persona definition. | `id` (UUID), `slug`, `version`, `status`, `display_name`, `role`, `summary`, `created_at`, `created_by`, `approved_at`, `approved_by` |
| `persona_spec_revision` | Immutable snapshot for each update. | `persona_spec_id`, `revision`, `spec_json`, `changelog`, `created_at`, `created_by` |
| `persona_tag` | Optional categorisation labels. | `persona_spec_id`, `tag` |
| `audit_event` | Redacted event log for governance. | `id`, `subject_type`, `subject_id`, `action`, `actor_id`, `actor_type`, `payload_redacted_json`, `created_at` |

### Relationships
- `persona_spec` 1..* `persona_spec_revision` (latest revision flagged in `persona_spec.current_revision`).
- `persona_spec` 1..* `persona_tag`.
- `audit_event` references persona specs or revisions via `subject_type`/`subject_id`.

## Postgres Schema

```sql
create table persona_spec (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  version text not null,
  status text not null check (status in ('draft','in_review','approved','deprecated')),
  display_name text not null,
  role text not null,
  summary text not null,
  current_revision int not null,
  created_at timestamptz not null default now(),
  created_by text not null,
  approved_at timestamptz,
  approved_by text
);

create index persona_spec_role_idx on persona_spec(role);

create table persona_spec_revision (
  persona_spec_id uuid not null references persona_spec(id) on delete cascade,
  revision int not null,
  spec_json jsonb not null,
  changelog text,
  created_at timestamptz not null default now(),
  created_by text not null,
  primary key (persona_spec_id, revision)
);

create table persona_tag (
  persona_spec_id uuid not null references persona_spec(id) on delete cascade,
  tag text not null,
  primary key (persona_spec_id, tag)
);

create table audit_event (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid,
  action text not null,
  actor_id text not null,
  actor_type text not null,
  payload_redacted_json jsonb not null,
  created_at timestamptz not null default now()
);
```

### Indexing & Performance
- Composite index `(status, role, created_at)` for persona catalog filtering.
- Partial index on `audit_event` for `subject_type = 'persona_spec'`.
- Use `jsonb_path_ops` for frequent spec attribute queries (e.g., `allowed_tools`).

## API Mapping

| Endpoint | Verb | Purpose | Notes |
| -------- | ---- | ------- | ----- |
| `/api/personas` | GET | List persona specs with filters | Supports `role`, `status`, `tag` query params. |
| `/api/personas` | POST | Create new persona spec | Validates against JSON Schema, defaults to `draft`. |
| `/api/personas/:id/spec` | GET | Fetch latest persona spec revision | Returns spec JSON plus metadata. |
| `/api/personas/:id/spec` | PUT | Update persona spec | Creates new revision, writes audit event, updates `current_revision`. |
| `/api/personas/:id/revisions/:rev` | GET | Fetch specific revision | Used for diffing and rollbacks. |

## Security Model
- Azure AD groups map to roles: `persona.author`, `persona.reviewer`, `persona.admin`.
- Machine agents obtain scoped tokens via control plane; tokens embed persona IDs permitted for mutations.
- All write operations require `persona.author` or higher; approvals require `persona.reviewer`.
- Audit payloads redact PII using shared redaction utility prior to insert (see `security.md`).

## Storage & Backup
- Azure Database for PostgreSQL Flexible Server.
- PITR enabled (7 days minimum).
- Nightly pg_dump to Azure Blob Storage with lifecycle rules (30 days retention).

## Operational Considerations
- Migration ordering: create tables → audit triggers → seed default personas (optional).
- Observability: emit domain events to Event Hub `persona.spec.changed`.
- Rollback plan: to deactivate persona, set status `deprecated`; maintain history.

## Open Questions
- Do we need cross-persona dependency mapping (spec referencing other specs)?
- Should we store derived embeddings for search (would require vector storage)?

