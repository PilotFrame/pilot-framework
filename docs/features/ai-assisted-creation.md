# AI-Assisted Persona & Workflow Creation

## Overview

Enable users to create personas and workflows through natural language conversation with AI models (GPT-4, Claude, etc.). The AI understands PilotFrame's schema templates and helps break down user requirements into structured JSON specifications.

## Core Concept

**User Flow:**
1. User describes their goal/need in natural language
2. AI model understands the persona/workflow templates
3. AI breaks down requirements and generates JSON
4. User can either:
   - Copy generated JSON to manual editor for refinement
   - Auto-validate and save directly

## Proposed Features

### 1. Chat Interface
- **Location**: New `/assistant` route in UI
- **Capabilities**:
  - Multi-turn conversation
  - Context-aware suggestions
  - Real-time validation feedback
  - Preview generated specs before saving

### 2. Intelligent Prompting
- **Template Awareness**: AI understands persona/workflow schemas
- **Best Practices**: Suggests patterns from existing personas/workflows
- **Clarification Questions**: Asks follow-up questions to refine requirements
- **Example-Driven**: Shows examples of good descriptions

### 3. Progressive Disclosure
- **Start Simple**: Begin with basic questions (persona vs workflow?)
- **Iterative Refinement**: Multi-turn conversation to clarify details
- **Validation Feedback**: If validation fails, explain issues and suggest fixes
- **Preview Mode**: Show what the generated persona/workflow will do

### 4. Hybrid Workflow
- **AI Generation**: Start with AI-generated spec
- **Manual Refinement**: Allow editing in existing PersonaEditor/WorkflowEditor
- **Copy & Paste**: Easy transition from chat to editor
- **Auto-Save**: Option to validate and save directly from chat

## Enhanced Features & Improvements

### 1. **Context-Aware Suggestions**
- **Existing Personas**: Suggest reusing/modifying existing personas
- **Similar Workflows**: Show similar workflows for inspiration
- **Persona Marketplace**: Suggest personas from community (future)

**Example:**
```
User: "I need a code reviewer"
AI: "I found 3 existing code review personas. Would you like to:
  1. Use 'code_reviewer_v2' as-is
  2. Create a variant based on 'code_reviewer_v2'
  3. Create a new one from scratch"
```

### 2. **Multi-Step Wizard Mode**
For complex workflows, break down into steps:
- Step 1: Identify goal (persona vs workflow)
- Step 2: Define scope and responsibilities
- Step 3: Specify inputs/outputs
- Step 4: Define success criteria
- Step 5: Review and refine

### 3. **Validation & Error Recovery**
- **Real-time Validation**: Validate as user types
- **Error Explanation**: If validation fails, explain what's wrong in plain language
- **Auto-Fix Suggestions**: AI suggests fixes for common errors
- **Schema Compliance**: Ensure generated JSON matches schemas exactly

**Example:**
```
AI: "I generated a persona, but there's an issue:
  - Missing 'mission' field (required)
  - 'id' contains uppercase letters (must be lowercase)
  
Would you like me to fix these automatically?"
```

### 4. **Template Selection Assistant**
Help users choose the right template:
- **Persona**: Single agent with specific role
- **Workflow**: Multiple personas orchestrated together
- **Hybrid**: Start with persona, suggest workflow later

### 5. **Preview & Explanation Mode**
Before saving, show:
- **What it does**: Plain language explanation
- **How it works**: Step-by-step execution flow
- **Example usage**: Sample MCP tool call
- **Visual preview**: Show persona/workflow structure

### 6. **Iterative Refinement**
- **Conversation History**: Maintain context across turns
- **Version Comparison**: Show diff between iterations
- **A/B Testing**: Generate multiple variants, let user choose
- **Learning**: Remember user preferences for future suggestions

### 7. **Cost Optimization**
- **Model Selection**: Use cheaper models (GPT-3.5) for simple cases, GPT-4 for complex
- **Caching**: Cache common patterns and suggestions
- **Streaming**: Stream responses for better UX
- **Token Management**: Optimize prompts to reduce token usage

### 8. **Integration with Existing UI**
- **Seamless Transition**: One-click copy from chat to editor
- **Side-by-Side**: Show chat and editor side-by-side
- **Live Preview**: Update editor as AI generates spec
- **Undo/Redo**: Easy to revert AI suggestions

## Technical Implementation

### Backend API

```typescript
POST /api/assistant/chat
{
  "message": "I need a code reviewer persona",
  "context": {
    "existing_personas": [...],
    "existing_workflows": [...],
    "conversation_history": [...]
  }
}

Response:
{
  "response": "I'll help you create a code reviewer persona...",
  "suggested_spec": { ... }, // Optional: Generated JSON
  "questions": [...], // Optional: Clarification questions
  "validation": { ... } // Optional: Validation results
}
```

### Frontend Components

1. **AssistantPage.tsx**: Main chat interface
2. **ChatMessage.tsx**: Individual message component
3. **SpecPreview.tsx**: Preview generated spec
4. **ValidationFeedback.tsx**: Show validation errors/suggestions
5. **CopyToEditor.tsx**: Button to copy to PersonaEditor/WorkflowEditor

### AI Prompt Engineering

**System Prompt Template:**
```
You are an AI assistant helping users create PilotFrame personas and workflows.

You understand:
- Persona schema: {persona_schema}
- Workflow schema: {workflow_schema}
- Existing personas: {existing_personas}
- Best practices: {best_practices}

Your goal:
1. Understand user's requirements
2. Ask clarifying questions if needed
3. Generate valid JSON matching the schemas
4. Suggest improvements and best practices
5. Help users refine their specifications

Always:
- Validate generated JSON against schemas
- Explain your reasoning
- Suggest reusing existing personas when appropriate
- Provide examples and use cases
```

## User Experience Flow

### Scenario 1: Simple Persona Creation

```
User: "I need a code reviewer"
AI: "Great! Let me help you create a code reviewer persona. 
     I found 2 similar personas. Would you like to:
     1. Use 'code_reviewer_v2' as-is
     2. Create a variant
     3. Create new from scratch"
     
User: "Create new from scratch"
AI: "What programming languages should this reviewer focus on?"
     
User: "TypeScript and Python"
AI: "What should be the main focus? (security, performance, style, etc.)"
     
User: "Security and best practices"
AI: [Generates persona spec]
     "I've created a code reviewer persona. Here's what it does:
     - Reviews TypeScript and Python code
     - Focuses on security vulnerabilities
     - Checks for best practices
     
     [Preview of JSON]
     
     Would you like to:
     1. Save this persona
     2. Refine it further
     3. Copy to editor for manual editing"
```

### Scenario 2: Complex Workflow Creation

```
User: "I need a workflow to create blog posts"
AI: "I'll help you create a blog post creation workflow. 
     This typically involves multiple personas. Let me break it down:
     
     Step 1: Requirements Collection
     Step 2: Content Writing
     Step 3: SEO Review
     Step 4: Accuracy Review
     Step 5: Final Approval
     
     Do you already have personas for these, or should I help create them?"
     
User: "I have some, but need SEO reviewer"
AI: "Let me help create the SEO reviewer persona first..."
     [Creates persona]
     
AI: "Now, let's define the workflow. How should these steps execute?
     - Sequential (one after another)
     - With cycles (refine until quality threshold)
     - Parallel reviews (SEO + Accuracy simultaneously)"
     
User: "With cycles between writer and reviewers"
AI: [Generates workflow spec with execution_spec]
     "Here's your workflow:
     - Starts with requirements collection
     - Enters refinement cycle: Writer → SEO Review → Accuracy Review
     - Exits when both scores > 0.8
     - Final approval
     
     [Preview of workflow JSON]
     
     Ready to save?"
```

## Benefits

1. **Lower Barrier to Entry**: Non-technical users can create personas/workflows
2. **Faster Creation**: AI handles schema complexity
3. **Best Practices**: AI suggests proven patterns
4. **Error Prevention**: Validation catches issues early
5. **Learning Tool**: Users learn schema structure through interaction
6. **Iterative Refinement**: Natural conversation flow for refinement

## Challenges & Solutions

### Challenge 1: Schema Compliance
**Solution**: 
- Use JSON Schema validation
- AI prompt includes strict schema requirements
- Post-generation validation with error feedback

### Challenge 2: Context Management
**Solution**:
- Maintain conversation history
- Include existing personas/workflows in context
- Use embeddings for semantic similarity search

### Challenge 3: Cost Management
**Solution**:
- Use GPT-3.5 for simple cases, GPT-4 for complex
- Cache common patterns
- Optimize prompts
- Stream responses

### Challenge 4: Quality Control
**Solution**:
- Always validate before saving
- Require user approval for auto-save
- Provide manual editing option
- Track AI-generated vs manually created

## Future Enhancements

1. **Voice Input**: Speak requirements instead of typing
2. **Visual Workflow Builder**: AI generates visual workflow diagram
3. **Test Mode**: Test generated persona/workflow before saving
4. **Community Learning**: Learn from community's successful patterns
5. **Multi-Language**: Support non-English requirements
6. **Integration**: Generate personas from existing documentation
7. **Analytics**: Track which AI suggestions users accept/reject

## Implementation Phases

### Phase 1: MVP (Basic Chat)
- Simple chat interface
- Basic persona generation
- Copy to editor functionality
- Schema validation

### Phase 2: Enhanced Chat
- Multi-turn conversation
- Workflow generation
- Context awareness (existing personas)
- Preview mode

### Phase 3: Advanced Features
- Iterative refinement
- Auto-fix suggestions
- Cost optimization
- Analytics

### Phase 4: Enterprise Features
- Custom model fine-tuning
- Team-specific patterns
- Approval workflows
- Audit logging

## Success Metrics

- **Adoption**: % of personas/workflows created via AI vs manual
- **Quality**: Validation pass rate for AI-generated specs
- **Efficiency**: Time to create persona/workflow
- **User Satisfaction**: Feedback scores
- **Cost**: Average cost per persona/workflow creation

