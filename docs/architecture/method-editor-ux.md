---
title: Method Editor UX Architecture
status: draft
owner: product_strategist
tags:
  - method-editor
  - ux
  - autosave
---

# Method Editor UX Architecture

## Objectives
- Provide a guided workflow for defining persona methods (input/output schemas, guidance, evaluation hooks).
- Enable inline validation against the canonical persona spec schema and method-specific rules.
- Support collaboration via autosave drafts, revision history, and review checkpoints.

## User Roles & Permissions
- **Persona Author**: create/edit methods for personas they own.
- **Reviewer**: comment and approve method changes.
- **Admin**: override approvals, manage assignments.
Authentication and role checks rely on Azure AD; frontend receives role claims via JWT (see control plane auth stub).

## Primary User Flows
1. **Select Persona**: choose from registry list (filtered by role/status). Loads latest persona spec and method catalog.
2. **Create Method**:
   - Provide method `identifier`, `display_name`, `summary`.
   - Define `input_schema` and `output_schema` via JSON editor + form view.
   - Author `evaluation.scorecard` and `thought_process_guidance`.
   - Configure `allowed_tools` and `handoff` actions.
   - Autosave to draft every 5 seconds or on blur.
3. **Validate Method**:
   - Run client-side AJV validation using shared schema definitions.
   - Submit to backend `/api/methods/validate` for deep validation (reserved).
4. **Submit for Review**:
   - Provide changelog note.
   - Reviewer receives notification (future integration) and can approve or request changes.
5. **Test Method**:
   - Trigger sandbox test with sample input, view results inline.

## UI Composition
- **Persona Context Panel**: sticky sidebar showing persona summary, role, tags, current status.
- **Tabbed Editor**:
  - `Form`: guided fields for metadata and structured objects (collapsible sections).
  - `JSON`: raw JSON editor with schema-driven autocomplete (Monaco).
  - `Changelog`: history of submissions with reviewer comments.
- **Validation Drawer**: collapsible panel showing linting errors, AJV feedback, and backend validation results.
- **Test Runner Drawer**: presents sandbox run status, logs, and scorecard summary.

## Autosave Strategy
- Local state persisted in Redux slice keyed by `personaId` + `methodId`.
- Debounced save to backend drafts endpoint `/api/methods/:id/draft` (TBD) with optimistic UI.
- Conflict detection using `etag` derived from latest revision timestamp.

## Accessibility & Responsiveness
- Forms follow WCAG 2.1 AA; error states announced via ARIA live regions.
- Layout adapts to 1280px desktop baseline, collapses drawers below 1024px, stacks tabs vertically on mobile.

## Dependencies
- Persona spec schema JSON (Prompt 2) for validation scaffolding.
- Method service APIs (T-005) for persistence and validation.
- Sandbox runner API (T-011) for test execution integration.

## Telemetry
- Capture key events: `method.save`, `method.submit`, `method.test.start`, `method.test.success/failure`.
- Forward telemetry to Application Insights with persona/method IDs hashed.

## Outstanding Decisions
- Commenting/review UX (inline vs general).
- Draft retention policy (number of autosave revisions).

