# Example Projects

This directory contains example project specifications created through the Agent-Native Project Management feature.

## Structure

Each project JSON file contains:
- **Project metadata**: name, description, status, type, complexity
- **Epics**: Major feature areas
- **Stories**: Individual work items within epics
- **Acceptance Criteria**: Specific, measurable completion requirements
- **Comments**: Activity log from users, personas, and agents

## Usage

These example projects demonstrate:
1. How business users structure requirements
2. How stories and acceptance criteria should be written
3. How projects can be assigned to workflows and personas
4. How AI agents can read and update project status via MCP

## Files

- `ecommerce_jewelry.json` - E-commerce website for jewelry sales (published status, ready for technical team)

## Creating Projects

Projects can be created two ways:
1. **Conversational**: Chat with AI Assistant to gather requirements
2. **Manual**: POST to `/api/projects` with structured JSON

## Project Lifecycle

```
draft → published → in_development → completed
```

- **draft**: Being created by business user
- **published**: Ready for technical team to assign workflow
- **in_development**: Technical team has assigned workflow, agents executing
- **completed**: All stories done, project delivered

