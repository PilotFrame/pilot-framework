# PilotFrame JSON Schemas

This directory contains JSON Schema definitions for validating PilotFrame resources.

## Available Schemas

### 1. Persona Specification (`persona-spec.schema.json`)
Defines the structure for AI personas - reusable expert roles with missions, workflows, and constraints.

**Required fields:**
- `id`: Lowercase identifier with underscores (e.g., `code_reviewer`)
- `name`: Human-friendly name
- `specification`: Object containing mission, inputs, workflow, success criteria, constraints, handoff expectations

### 2. Workflow Definition (`workflow-definition.schema.json`)
Defines multi-step processes that orchestrate multiple personas.

**Required fields:**
- `id`: Lowercase identifier with underscores
- `name`: Human-friendly name
- `steps`: Array of workflow steps with persona assignments
- `execution_spec`: Object describing flow pattern, cycle details, parallel execution, etc.

### 3. Project Definition (`project-definition.schema.json`)
Defines projects with requirements, epics, stories, and acceptance criteria for agent-driven development.

**Required fields:**
- `name`: Project name
- `description`: Project description
- `epics`: Array of epics (minimum 1)

**Each Epic requires:**
- `id`: Epic identifier
- `title`: Epic title
- `description`: Epic description
- `priority`: One of `low`, `medium`, `high`, `critical`
- `stories`: Array of stories (minimum 1)

**Each Story requires:**
- `id`: Story identifier
- `title`: Story title
- `description`: Detailed story description
- `priority`: One of `low`, `medium`, `high`, `critical`
- `acceptanceCriteria`: Array of criteria (minimum 2, maximum 20)

**Each Acceptance Criterion requires:**
- `id`: Criterion identifier
- `description`: Specific, measurable, testable criterion (10-500 characters)

## Validation

All schemas are validated using AJV (Another JSON Schema Validator) with the 2020-12 draft specification.

### Acceptance Criteria Guidelines

✅ **GOOD Examples:**
- "Product grid displays 12 items per page with pagination controls"
- "Search returns results in less than 500ms for a database of 10,000 products"
- "Mobile layout switches to single column at viewport width below 768px"
- "Form validates email format (RFC 5322) before allowing submission"

❌ **BAD Examples (too vague):**
- "Product grid looks good" (not measurable)
- "Search is fast" (no specific metric)
- "Works on mobile" (not specific)
- "Form validates input" (what kind of validation?)

### Best Practices

1. **IDs**: Use lowercase with underscores (e.g., `user_authentication`, not `UserAuthentication`)
2. **Stories**: Aim for 2-10 stories per epic
3. **Acceptance Criteria**: Include 2-5 specific, testable criteria per story
4. **Priorities**: Use `critical` sparingly (only for must-have features)
5. **Descriptions**: Be specific and actionable

## Templates

- `project-template.json`: Example project structure showing all required fields

## Usage in Code

### Persona Validation
```typescript
import { createPersonaSpec } from './services/personaService.js';

// Automatically validated against persona-spec.schema.json
const persona = await createPersonaSpec({
  id: 'code_reviewer',
  name: 'Code Reviewer',
  specification: { /* ... */ }
});
```

### Workflow Validation
```typescript
import { createWorkflow } from './services/workflowService.js';

// Automatically validated against workflow-definition.schema.json
const workflow = await createWorkflow({
  id: 'code_review_workflow',
  name: 'Code Review Workflow',
  steps: [/* ... */],
  execution_spec: { /* ... */ }
});
```

### Project Validation
```typescript
import { createProject } from './services/projectService.js';

// Automatically validated against project-definition.schema.json
const project = await createProject({
  name: 'E-commerce Website',
  description: 'Customer-facing online store',
  epics: [/* ... */]
});
```

## Validation Errors

When validation fails, you'll receive detailed error messages indicating:
- Which field failed validation
- What the expected format/value should be
- The path to the invalid field in the JSON structure

Example error:
```
Project validation failed:
  epics/0/stories/0/acceptanceCriteria must NOT have fewer than 2 items
  epics/0/stories/0/acceptanceCriteria/0/description must NOT have fewer than 10 characters
```

