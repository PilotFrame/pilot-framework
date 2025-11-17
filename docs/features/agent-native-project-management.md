# Agent-Native Project Management

## Overview

This document captures the feature concept discussed for adding project/backlog management to PilotFrame, where:
1. Business users create projects conversationally (chat with AI) or via forms
2. Technical teams load projects and assign workflows + personas
3. AI agents read requirements and update progress via MCP

## Vision (From Discussion)

> "Business users maintain project backlog which is exposed via MCP, and AI agents can read tasks, specifications, acceptance criteria, and update status back through MCP."

**Goal:** One app to maintain technical AND functional specifications, exposed via MCP and executed by agents.

---

## What We Agreed On

### 1. Two Creation Routes

**Route 1: Conversational (Chat Experience)**
- User starts chatting with AI agent (like existing Assistant)
- AI interviews user with questions to understand intent
- AI acts like a project manager gathering requirements
- AI suggests features and creates structured breakdown
- User reviews stories and acceptance criteria suggested by AI
- User can ignore certain messages from AI analysis (like existing Assistant)
- Once satisfied, user publishes project for technical team
- **Full conversation history saved with option to exclude messages**

**Route 2: Traditional Form-Based**
- User manually creates: Project → Epic → Tasks/Stories
- Adds details directly through forms
- For users who prefer structured input

### 2. Business to Technical Handoff

**Business User Phase:**
- Creates project with requirements
- Adds epics (major features)
- Adds stories/tasks with acceptance criteria
- Publishes when ready

**Technical User Phase:**
- Loads published project into existing Assistant
- Assistant suggests workflow based on project type
- Technical user selects/creates personas for the work
- Assigns personas to execute tasks
- Workflow becomes project-specific (generic workflow + specific requirements)

### 3. Why This Makes Sense

**Completes the Loop:**
```
Business: Creates requirements (what to build)
    ↓
Technical: Assigns workflow + personas (how to build)
    ↓
Agents: Execute using personas (actual building)
    ↓
Agents: Update project status via MCP (progress tracking)
```

**Personas & Workflows Stay Generic:**
- Personas: "Frontend Developer", "SEO Specialist" (reusable)
- Workflows: "Website Creation", "API Development" (reusable)  
- Project specs: Make them specific ("E-commerce site", "Blog API")

**Knowledge Accumulation:**
- More projects → More personas created (add to library)
- More projects → More workflow templates
- System gets smarter with usage

### 4. MCP Integration

**Agents Can:**
- Read project requirements
- Read task specifications
- Read acceptance criteria
- Update task status
- Add comments/updates
- Mark criteria complete

**Why This Matters:**
Traditional tools (Jira, Linear) have APIs but aren't agent-native. We expose everything via MCP so agents work naturally with the project data.

---

## Data Structure (High-Level)

```
Project
├── Epics (major features)
│   └── Stories/Tasks
│       ├── Acceptance Criteria
│       ├── Assigned Personas
│       └── Comments/Updates
└── Linked to: Conversation History, Assigned Workflow
```

---

## Key Differentiators

1. **Conversational Project Creation** - Talk your project into existence
2. **MCP-Native** - Built for agents, not retrofitted
3. **Business → Technical → Agent Flow** - Complete lifecycle
4. **Conversation Context Preserved** - Why decisions were made
5. **Generic Personas Applied to Specific Projects** - Reusability

---

## Example Flow: E-Commerce Website

### Business User Conversation:
```
USER: "I want to build an e-commerce website"
AI PM: "Great! Let me ask a few questions..."
[Interview about products, audience, payment, features]
AI PM: "Based on our chat, here are suggested epics:
  - Product Catalog
  - Shopping Cart
  - Checkout & Payment
  - User Accounts
  - Admin Dashboard"
USER: "Yes, let's detail Product Catalog"
AI PM: "Here are suggested stories with acceptance criteria..."
[Reviews and refines]
USER: "Looks good, publish it"
[Project saved with conversation history]
```

### Technical User:
```
[Loads project in Assistant]
ASSISTANT: "I see this is an e-commerce site. 
Suggesting 'Website Creation Workflow' with these personas:
  - astro_react_frontend_developer
  - creative_designer_persona
  - seo_strategist
  - accessibility_qa_reviewer"
TECH USER: "Yes, assign these to stories"
[Workflow created, personas assigned]
```

### AI Agent Execution:
```
AGENT: [Reads Story 1.1 via MCP]
AGENT: [Loads frontend_developer persona]
AGENT: [Updates status to "in_progress"]
AGENT: [Builds feature]
AGENT: [Marks acceptance criteria complete]
AGENT: [Adds comment: "Implemented with..."]
AGENT: [Updates status to "done"]
AGENT: [Moves to next story]
```

---

## Market Opportunity

### Current State:
- **Asana, Jira, Linear**: Adding AI features (assistants, summaries)
- **Gap**: None are MCP-native or designed for agent execution
- **Problem**: Tool sprawl - requirements in Jira, specs in Confluence, code in GitHub

### Our Approach:
- **Single platform**: Requirements → Workflows → Execution → Updates
- **Agent-first**: Built for agents to autonomously work, not just assist
- **MCP-native**: Agents have full read/write access naturally
- **Context preserved**: Conversation history linked to every decision

### Market Size:
- AI in PM market: $2.4B (2023) → $11.2B (2033) - 16.7% CAGR
- Early adopters: AI-native companies (5-10K globally)
- Medium-term: Modern dev teams using agent-assisted development (100K+ teams)

---

## What Needs to Be Built (High-Level)

### MVP Phase:
1. **Project data structure** (JSON files, like personas/workflows, until database integration)
   - Project → Epics → Stories → Acceptance Criteria structure
   - Store in `data/projects/` directory
2. **PM Interview system prompt** (extend existing Assistant, not a new persona)
   - Detect project creation intent
   - Interview flow for gathering requirements
   - Generate project JSON structure
3. **Project creation via conversation** (reuse existing Assistant UI)
   - Chat mode for business users
   - Publish project when ready
4. **Basic MCP tools** (read project, stories, criteria)
   - Expose projects via MCP like personas/workflows
5. **Technical user workflow**
   - Load project in Assistant
   - Assign workflow + personas to project
6. **Form-based creation** (alternative to chat)

### Future:
- Database migration (from JSON files to PostgreSQL)
- MCP write tools (update status, add comments)
- Project dashboard (view progress)
- Project templates
- Advanced agent orchestration

---

## Implementation Notes

- **Storage**: Projects stored as JSON files initially (`data/projects/`)
- **System Prompt**: PM Interview Agent is a system prompt extension, not a persona
- **MCP Tools**: Similar to existing persona/workflow MCP tools
- **UI**: Extend existing Assistant page for project creation

---

## Why This Feature Makes Strategic Sense

1. **Natural Extension**: Fits perfectly with existing personas/workflows
2. **Closes the Loop**: From requirements → execution → updates
3. **Competitive Moat**: MCP-native project management doesn't exist yet
4. **Network Effects**: More projects → better templates → smarter suggestions
5. **Timing**: Agent-driven development is happening NOW
6. **Market Gap**: Traditional PM tools not built for autonomous agents

---

## Notes

- This doc captures the **concept**, not detailed implementation
- Implementation details (schemas, APIs, UI) will be designed during development
- Focus is on the user flows and value proposition
- Technical details intentionally kept high-level to avoid assumptions

