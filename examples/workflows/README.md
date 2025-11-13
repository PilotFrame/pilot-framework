# Workflow Examples

This directory contains example workflow definitions that demonstrate how personas work together to accomplish complex tasks.

## Blog Post Creation Workflow

**File**: `blog_post_creation.json`

**Description**: A complete workflow for creating world-class SEO and AI bot-friendly blog posts. This workflow guides content through a structured process from requirements gathering to final approval.

### Workflow Steps

1. **Collect Requirements** (`requirements_collector`)
   - Gathers comprehensive requirements from users
   - Creates structured brief
   - Validates completeness

2. **Write Content** (`content_writer`)
   - Creates initial blog post draft
   - Optimizes for human readers and AI bots
   - Ensures natural keyword placement

3. **SEO Review** (`seo_reviewer`)
   - Reviews for SEO optimization
   - Checks heading structure and linking
   - Optimizes for AI bot readability

4. **Accuracy Review** (`accuracy_reviewer`)
   - Fact-checks all content
   - Verifies credibility and sources
   - Ensures no misinformation

5. **Final Review** (`final_reviewer`)
   - Performs final quality check
   - Verifies all requirements met
   - Approves for publication

### Usage

Workflows can be loaded into the PilotFrame control plane via the UI or API. Each workflow defines a sequence of persona invocations that work together to accomplish a goal.

### Workflow Structure

```json
{
  "id": "workflow_id",
  "name": "Workflow Name",
  "steps": [
    {
      "id": "step_id",
      "persona_id": "persona_id",
      "order": 1,
      "condition": "optional condition",
      "handoff_to": "next_step_id"
    }
  ],
  "metadata": {
    "description": "...",
    "tags": ["..."],
    "created_at": "..."
  }
}
```

### Step Properties

- **id**: Unique identifier for the step
- **persona_id**: ID of the persona to invoke in this step
- **order**: Sequential order of execution (1, 2, 3...)
- **condition**: Optional condition that must be met to proceed (e.g., "score > 0.75")
- **handoff_to**: Optional ID of the next step to execute (if different from sequential order)

