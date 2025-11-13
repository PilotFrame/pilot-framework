# PilotFrame MCP: Persona-Led MCP Control Plane

## Vision Statement

**PilotFrame MCP** is a specification-led platform that enables teams to author, manage, and orchestrate AI personas through the Model Context Protocol (MCP). Instead of hardcoding AI behavior, PilotFrame provides a structured way to define personas as specifications that guide AI agents—making AI workflows composable, auditable, and production-ready.

## Core Concept: Specification-Led AI Execution

Traditional AI systems require developers to write code that directly controls AI behavior. PilotFrame flips this model:

- **Instead of**: Writing code that tells AI what to do
- **We provide**: Structured specifications that AI agents interpret and execute autonomously

### The Persona Specification

A persona in PilotFrame is a JSON specification that defines:
- **Mission**: What the persona is trying to accomplish
- **Inputs**: What information the persona needs
- **Workflow**: Step-by-step instructions for the persona
- **Success Criteria**: How to measure if the persona succeeded
- **Constraints**: What the persona should NOT do
- **Handoff Expectations**: What the persona should deliver

These specifications are **not code**—they're structured instructions that AI agents (like Cursor, Claude, or custom agents) interpret and execute.

## Real-World Example: Blog Post Creation

Here's an actual execution trace from Cursor using PilotFrame MCP to create a blog post:

### Execution Flow

1. **Discovery** (2 tools): Cursor discovered available personas and workflows
2. **Understanding** (5 tools): Retrieved persona specifications to understand the workflow
3. **Planning** (2 tools): Created a todo list and started the blog post creation workflow
4. **Requirements Collection** (2 tools): Collected requirements and drafted initial post
5. **SEO Review** (10 tools): Conducted comprehensive SEO optimization review
6. **Accuracy Review** (17 tools): Fact-checked and verified all information
7. **Final Review** (2 tools): Performed final quality check

### Results

- **Quality Score**: 0.95/1.0
- **Status**: APPROVED ✅
- **Word Count**: ~1,900 words
- **All Requirements Met**: Topic coverage, SEO optimization, accuracy verification

### Key Observations

- **Autonomous Execution**: Cursor interpreted the workflow specification and executed it without hardcoded logic
- **Iterative Refinement**: The workflow naturally looped through SEO and accuracy reviews until quality thresholds were met
- **Tool Usage Efficiency**: 40+ tool calls orchestrated across 5 personas seamlessly
- **Quality Assurance**: Built-in review cycles ensured high-quality output

This demonstrates how PilotFrame enables **specification-led execution**—the AI agent reads the workflow specification and autonomously decides how to execute it, making workflows flexible and adaptable.

## What We're Building

### 1. Persona Registry & Management

A centralized control plane where teams can:
- **Author personas** via a UI-driven form or JSON editor
- **Version control** persona specifications with full audit trails
- **Tag and categorize** personas for discoverability
- **Test personas** in sandbox environments before deployment

### 2. MCP Integration

PilotFrame exposes personas and workflows as MCP tools, making them accessible to any MCP-compatible AI agent:

- **Standalone Persona Tools**: `persona.{id}.get_specification` - Agents can use personas independently
- **Workflow Tools**: `workflow.{id}` - Agents can execute multi-step workflows
- **Discovery Tools**: `persona.list` - Agents can discover available personas

### 3. Workflow Orchestration

Define complex workflows that orchestrate multiple personas:
- **Sequential workflows**: Personas execute one after another
- **Cycles**: Personas can refine work in iterative loops
- **Parallel execution**: Multiple personas can work simultaneously
- **Conditional branching**: Workflows adapt based on results

### 4. Specification-Led Execution

Workflows don't execute programmatically—they provide **execution specifications** that AI agents interpret:

```json
{
  "execution_spec": {
    "description": "This workflow starts with collecting requirements, then enters a refinement cycle...",
    "execution_guidance": "1. Start with collect_requirements step. 2. Pass requirements to write_content...",
    "cycle_details": {
      "cycle_steps": ["write_content", "seo_review", "accuracy_review"],
      "exit_condition": "seo_score > 0.8 AND accuracy_score > 0.8"
    }
  }
}
```

The AI agent reads this specification and decides how to execute it—making workflows flexible and adaptable.

## Current Capabilities (MVP)

✅ **Persona Management**
- Create, edit, and version persona specifications
- UI-driven form editor with JSON fallback
- Tag-based filtering and discovery

✅ **Workflow Management**
- Define workflows with multiple persona steps
- Specify execution patterns (sequential, cycles, parallel)
- Execution guidance for AI agents

✅ **MCP Server**
- HTTP-based MCP endpoint (`POST /mcp`)
- Exposes personas and workflows as MCP tools
- Compatible with Cursor, Claude Desktop, and other MCP clients

✅ **Control Plane API**
- RESTful API for persona and workflow CRUD
- JWT-based authentication
- PostgreSQL for persistence

✅ **Frontend UI**
- React-based UI for persona and workflow management
- MCP testing page to verify tool exposure
- Connection status indicators

## Future Possibilities

### 1. Adapter Ecosystem

**Vision**: Deploy personas as containerized adapters that execute actual work, not just provide specifications.

- **Adapter Template**: Standardized Node.js/TypeScript template for building persona adapters
- **Sandbox Runner**: Test adapters in isolated environments with resource limits
- **ACR/AKS Deployment**: One-click deployment of adapters to Azure Kubernetes Service
- **Method Registry**: Register and version persona methods (e.g., `seo.evaluate_content`)

**Use Case**: Instead of just telling an AI agent "be an SEO expert," deploy an actual SEO adapter that performs real SEO analysis.

### 2. Advanced Workflow Patterns

**Vision**: Support complex workflow patterns beyond simple sequences.

- **Fan-out/Fan-in**: Distribute work to multiple personas, then merge results
- **Conditional Branching**: Dynamic workflow paths based on evaluation scores
- **Nested Workflows**: Workflows that call other workflows
- **Event-Driven**: Workflows triggered by external events

**Use Case**: A content creation workflow that fans out to multiple specialist reviewers, then merges their feedback.

### 3. Evaluation & Scoring

**Vision**: Built-in evaluation frameworks for persona outputs.

- **Scorecards**: Structured evaluation criteria (e.g., SEO score, accuracy score)
- **Threshold Gates**: Workflows that only proceed if scores meet thresholds
- **Continuous Improvement**: Learn from evaluation results to improve personas

**Use Case**: A content workflow that automatically loops back to the writer if SEO score is below 0.8.

### 4. Persona Marketplace

**Vision**: A community-driven marketplace for persona specifications.

- **Public Registry**: Share and discover personas created by the community
- **Persona Templates**: Pre-built personas for common use cases
- **Rating & Reviews**: Community feedback on persona quality
- **Versioning & Forks**: Collaborate on persona improvements

**Use Case**: Discover a "Code Reviewer" persona created by another team, fork it, and customize it for your needs.

### 5. Multi-Agent Orchestration

**Vision**: Coordinate multiple AI agents working on different personas simultaneously.

- **Agent Pool Management**: Manage a pool of AI agents
- **Load Balancing**: Distribute persona work across agents
- **Agent Specialization**: Route specific persona types to specialized agents
- **Cross-Agent Communication**: Agents can hand off work to each other

**Use Case**: A workflow where one agent handles content writing while another handles SEO review in parallel.

### 6. Observability & Analytics

**Vision**: Full observability into persona and workflow execution.

- **Execution Logs**: Detailed logs of persona invocations
- **Performance Metrics**: Track persona execution time, success rates
- **Cost Tracking**: Monitor AI API costs per persona/workflow
- **Audit Trail**: Complete history of who changed what and when

**Use Case**: Understand which personas are most effective, identify bottlenecks in workflows, and optimize costs.

### 7. CI/CD Integration

**Vision**: Integrate personas into software development workflows.

- **GitHub Actions**: Trigger workflows on PRs, commits, releases
- **Automated Testing**: Use personas to test code, review PRs, generate documentation
- **Deployment Gates**: Use personas to validate deployments
- **Release Automation**: Automate release notes, changelogs, announcements

**Use Case**: Automatically generate release notes using a "Technical Writer" persona when a new version is tagged.

### 8. Enterprise Features

**Vision**: Enterprise-grade features for large organizations.

- **Azure AD Integration**: Role-based access control with Azure AD
- **Multi-Tenancy**: Isolate personas and workflows by team/organization
- **Compliance**: GDPR, SOC2 compliance features
- **PII Redaction**: Automatic redaction of sensitive data in logs
- **Key Vault Integration**: Secure secret management

**Use Case**: A large organization where different teams have their own persona libraries, with centralized governance.

### 9. AI Model Agnostic

**Vision**: Support multiple AI providers and models.

- **Provider Abstraction**: Switch between OpenAI, Anthropic, Azure OpenAI, etc.
- **Model Selection**: Choose the best model for each persona
- **Cost Optimization**: Automatically select cost-effective models
- **Fallback Strategies**: Graceful degradation if a model is unavailable

**Use Case**: Use GPT-4 for complex personas, GPT-3.5 for simple ones, and Claude for creative tasks—all from the same workflow.

### 10. Domain-Specific Personas

**Vision**: Pre-built personas for specific industries and use cases.

- **Software Development**: Code reviewers, test writers, documentation generators
- **Content Creation**: Blog writers, SEO specialists, social media managers
- **Business Operations**: Project managers, data analysts, customer support
- **Creative Industries**: Designers, copywriters, creative directors

**Use Case**: A marketing team uses pre-built personas for content creation, SEO optimization, and social media planning.

## Technical Architecture

### Current Stack

- **Backend**: Node.js + TypeScript + Express
- **Database**: PostgreSQL (Azure Database for PostgreSQL)
- **Frontend**: React + Tailwind CSS
- **MCP**: HTTP-based MCP server integrated into control plane
- **Authentication**: JWT-based (Azure AD planned)

### Planned Stack

- **Container Registry**: Azure Container Registry (ACR)
- **Orchestration**: Azure Kubernetes Service (AKS)
- **Storage**: Azure Blob Storage
- **Secrets**: Azure Key Vault
- **CI/CD**: GitHub Actions
- **Static Hosting**: Hostinger (via SFTP/Git)

## Key Differentiators

1. **Specification-Led**: Personas are specifications, not code—making them versionable, auditable, and composable
2. **MCP Native**: Built on Model Context Protocol from the ground up
3. **Agent-Agnostic**: Works with any MCP-compatible AI agent (Cursor, Claude, custom agents)
4. **Production-Ready**: Designed for Azure cloud deployment with enterprise features
5. **Open & Extensible**: JSON-based specifications, REST APIs, and MCP protocol

## Use Cases

### Content Creation Workflow
A team uses PilotFrame to create blog posts:
1. Requirements Collector persona gathers topic and requirements
2. Content Writer persona creates the draft
3. SEO Reviewer persona optimizes for search engines
4. Accuracy Reviewer persona fact-checks content
5. Final Reviewer persona approves for publication

**Result**: High-quality blog post (0.95/1.0 quality score) created autonomously by AI agent interpreting workflow specifications.

### Code Review Workflow
A development team uses PilotFrame for automated code reviews:
1. Code Reviewer persona analyzes PRs
2. Security Reviewer persona checks for vulnerabilities
3. Documentation Reviewer persona ensures docs are updated
4. Quality Gate persona approves or requests changes

### Customer Support Workflow
A support team uses PilotFrame to handle customer inquiries:
1. Triage persona categorizes the issue
2. Technical Specialist persona provides technical solutions
3. Empathy persona ensures tone is appropriate
4. Escalation persona determines if human intervention is needed

## Getting Started

PilotFrame is currently in MVP stage. You can:
1. **Run locally**: Set up the control plane, frontend, and MCP server
2. **Create personas**: Use the UI to author persona specifications
3. **Define workflows**: Create workflows that orchestrate multiple personas
4. **Connect Cursor**: Use personas and workflows via MCP in Cursor IDE

See the [README.md](./README.md) for complete setup instructions.

## Roadmap

- **Q1 2025**: Adapter template and sandbox runner
- **Q2 2025**: AKS deployment and CI/CD integration
- **Q3 2025**: Evaluation frameworks and advanced workflow patterns
- **Q4 2025**: Persona marketplace and multi-agent orchestration

## Contributing

PilotFrame is designed to be extensible. We welcome contributions for:
- New persona specifications
- Workflow templates
- Adapter implementations
- Documentation improvements

## License

[To be determined]

---

**PilotFrame**: Where AI personas become production-ready specifications.
