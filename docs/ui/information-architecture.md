---
title: PilotFrame Control Plane IA
status: draft
owner: uiux_designer
tags:
  - ui
  - navigation
  - persona
---

# Information Architecture

## Primary Navigation
1. **Dashboard** – overview metrics, recent activity, quick links.
2. **Persona Registry**
   - List: filter/sort personas, status chips, roles.
   - Detail: persona spec metadata, latest revision, linked methods.
3. **Method Studio**
   - Method list per persona.
   - Method editor (form + JSON).
   - Sandbox test results.
4. **Adapters**
   - Adapter catalog (generated via template CLI).
   - Adapter detail with deployment status, linked personas.
5. **Sandbox Runs**
   - Run history, filters by persona/method/status.
   - Run details (logs, evaluation).
6. **Workflows**
   - Workflow definitions (Prompt 9).
   - Execution history.
7. **Operations**
   - CI/CD status, environment promotions, Terraform plans.
8. **Settings**
   - Access control, API tokens, integration settings.

## Secondary Navigation & Context Panels
- Right-hand context panel for persona summary and key metadata.
- Breadcrumbs: `Persona Registry > Persona Name > Method Studio`.
- Global quick action (`+ New Persona`, `+ New Method`, `Run Sandbox Test`).

## Page Layout Guidelines
- Max content width 1440px with 24px gutters.
- Sticky left nav (80px collapsed, 240px expanded).
- Use cards for lists; table view for dense data.
- Provide quick filters (role, status, tags) in persona list header.

## Content Strategy
- Favor plain language, highlight security-sensitive actions with warnings.
- Show audit info (created by, last updated) near top of detail pages.
- Provide links to docs (spec schema, adapter template) in context panels.

## Hostinger Constraints
- SPA built with React + Vite, deployed as static assets to Hostinger via Git integration.
- Ensure routing uses hash-based fallback or Hostinger rewrite rules.
- Bundle size target < 500 KB gzipped for initial load.

## Accessibility
- Keyboard navigation across nav + drawers.
- High-contrast theme option.
- Support screen readers with descriptive aria-labels, especially for method editor validation.

## Future Enhancements
- Persona comparison view.
- Workflow visual canvas.
- Real-time collaboration indicators.

