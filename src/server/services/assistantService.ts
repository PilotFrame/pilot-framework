import { AzureOpenAI } from 'openai';
import fs from 'node:fs';
import path from 'node:path';
import { listPersonas } from './personaService.js';
import { listWorkflows } from './workflowService.js';

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || '';
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || '';
const AZURE_OPENAI_DEPLOYMENT_NAME = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-5-chat';

let client: AzureOpenAI | null = null;

function getClient(): AzureOpenAI {
  if (!client) {
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      throw new Error('Azure OpenAI credentials not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY');
    }
    
    // Normalize endpoint - remove trailing slash if present
    const normalizedEndpoint = AZURE_OPENAI_ENDPOINT.replace(/\/$/, '');
    
    // Use API version from env or default based on model type
    // GPT-5 models (gpt-5, gpt-5-chat, gpt-5-mini, gpt-5-nano) may require 2025-08-07 or later
    // However, some deployments may only support 2025-01-01-preview
    // For other models, use 2025-01-01-preview
    // Priority: 1. Explicit env var, 2. Try 2025-01-01-preview first (most compatible), 3. Fallback to 2025-08-07 for GPT-5
    const isGpt5Model = AZURE_OPENAI_DEPLOYMENT_NAME.startsWith('gpt-5');
    let apiVersion = process.env.AZURE_OPENAI_API_VERSION;
    
    if (!apiVersion) {
      // Default to 2025-01-01-preview as it's more widely supported
      // User can override with AZURE_OPENAI_API_VERSION if they need 2025-08-07
      apiVersion = '2025-01-01-preview';
    }
    
    console.log(`Configuring Azure OpenAI client:`);
    console.log(`  Endpoint: ${normalizedEndpoint}`);
    console.log(`  Deployment: ${AZURE_OPENAI_DEPLOYMENT_NAME}`);
    console.log(`  API Version: ${apiVersion}`);
    
    // Use AzureOpenAI client - designed specifically for Azure OpenAI
    // It handles endpoint, API version, and authentication automatically
    // Note: endpoint should be base URL without /openai/v1/
    client = new AzureOpenAI({
      endpoint: normalizedEndpoint,
      apiKey: AZURE_OPENAI_API_KEY,
      apiVersion: apiVersion,
      deployment: AZURE_OPENAI_DEPLOYMENT_NAME
    });
  }
  return client;
}

// Load schemas for context
function loadSchemas(): { personaSchema: string; workflowSchema: string } {
  const personaSchemaPath = path.join(process.cwd(), 'schemas', 'persona-spec.schema.json');
  const workflowSchemaPath = path.join(process.cwd(), 'schemas', 'workflow-definition.schema.json');
  
  const personaSchema = fs.readFileSync(personaSchemaPath, 'utf-8');
  const workflowSchema = fs.readFileSync(workflowSchemaPath, 'utf-8');
  
  return { personaSchema, workflowSchema };
}

// Load example personas and workflows for context
async function loadExamples(): Promise<{ personas: string; workflows: string }> {
  const personas = await listPersonas();
  const workflows = await listWorkflows();
  
  // Load a few example personas
  const examplePersonas = personas.slice(0, 3).map(p => {
    const examplePath = path.join(process.cwd(), 'examples', 'personas', `${p.id}.json`);
    if (fs.existsSync(examplePath)) {
      return fs.readFileSync(examplePath, 'utf-8');
    }
    return null;
  }).filter(Boolean);
  
  // Load example workflow
  const exampleWorkflowPath = path.join(process.cwd(), 'examples', 'workflows', 'blog_post_creation.json');
  const exampleWorkflow = fs.existsSync(exampleWorkflowPath)
    ? fs.readFileSync(exampleWorkflowPath, 'utf-8')
    : null;
  
  return {
    personas: examplePersonas.join('\n\n---\n\n'),
    workflows: exampleWorkflow || ''
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  excludeFromHistory?: boolean;
}

export interface ChatResponse {
  message: string;
  suggestedSpec?: {
    type: 'persona' | 'workflow' | 'project';
    spec: Record<string, unknown>;
  };
  questions?: string[];
  reasoning?: string;
  status: 'conversing' | 'ready_to_save' | 'needs_clarification';
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: {
    existingPersonas?: string[];
    existingWorkflows?: string[];
  };
  attachedFiles?: Array<{
    id?: string;
    name: string;
    type: 'persona' | 'workflow';
    content: Record<string, unknown>;
  }>;
}

function buildSystemPrompt(
  personaSchema: string, 
  workflowSchema: string, 
  examples: { personas: string; workflows: string },
  attachedFiles?: Array<{ id?: string; name: string; type: 'persona' | 'workflow'; content: Record<string, unknown> }>
): string {
  let attachedFilesContext = '';
  if (attachedFiles && attachedFiles.length > 0) {
    attachedFilesContext = `\n\nATTACHED FILES (User has provided these for context):\n`;
    attachedFiles.forEach(file => {
      attachedFilesContext += `\n--- ${file.name} (${file.type}) ---\n`;
      attachedFilesContext += JSON.stringify(file.content, null, 2);
      attachedFilesContext += '\n';
    });
    attachedFilesContext += `\n\nUse these attached files as reference when answering questions. They provide context about existing personas/workflows the user is working with. When the user asks questions about these attached personas/workflows, refer to their specifications directly.\n`;
  }
  
  return `You are an AI assistant helping users create PilotFrame personas, workflows, and projects through natural language conversation.

Your goal is to:
1. Understand the user's requirements through multi-turn conversation
2. Determine if they need:
   - A standalone persona (reusable AI expert)
   - A workflow (orchestrating multiple personas)
   - A project (requirements with epics, stories, acceptance criteria for agent execution)
3. Gather all necessary details through iterative questioning
4. Generate valid JSON specifications matching the schemas
5. Present the result for user approval before saving

PERSONA SCHEMA:
${personaSchema}

WORKFLOW SCHEMA:
${workflowSchema}

EXAMPLE PERSONAS:
${examples.personas}

EXAMPLE WORKFLOW:
${examples.workflows}
${attachedFilesContext}

PROJECT STRUCTURE (for project management):
When generating a project JSON, include these fields:

REQUIRED fields:
- name: string (descriptive project name)
- description: string (what the project is about)
- epics: Epic[] (array of major feature areas - at least 1 required)

OPTIONAL fields (backend will add defaults if omitted):
- projectType: "website" | "api" | "mobile-app" | "desktop-app" | "data-pipeline" | "other"
- estimatedComplexity: "low" | "medium" | "high"
- tags: string[] (relevant tags - can be empty array)

Each Epic REQUIRES:
- id: string (lowercase with hyphens, e.g., "epic-1", "user-authentication")
- title: string
- description: string
- priority: "low" | "medium" | "high" | "critical"
- stories: Story[] (at least 1 story required)

Each Story REQUIRES:
- id: string (lowercase with hyphens, e.g., "story-1-1", "login-form")
- title: string
- description: string (user story format: "As a [user type], I want [feature] so that [benefit]")
- priority: "low" | "medium" | "high" | "critical"
- acceptanceCriteria: AcceptanceCriteria[] (2-20 criteria required)

Story OPTIONAL fields (backend adds defaults):
- tags: string[] (can be empty)
- status: "draft" (default)
- assignedPersonas: [] (default)
- comments: [] (default)

Each AcceptanceCriteria REQUIRES:
- id: string (lowercase with hyphens, e.g., "ac-1-1-1")
- description: string (10-500 chars - MUST be specific, measurable, testable)

AcceptanceCriteria OPTIONAL fields (backend adds defaults):
- completed: false (default)
- isBlocking: false (default, set to true for critical criteria)

JSON OUTPUT FORMAT:
When generating a project, output it in a json code block with ONLY the raw project object.
The JSON must start with the project's top-level fields (name, description, epics, etc).
CRITICAL RULE: DO NOT wrap the JSON in "status" or "suggestedSpec" fields.
BAD (wrong): { "status": "ready_to_save", "suggestedSpec": { "name": ... } }
GOOD (correct): { "name": "Project Name", "description": "...", "epics": [...] }

CONVERSATION FLOW:
1. Start by asking the user to briefly describe their requirement
2. Based on the description, determine if it's a persona, workflow, or project:
   - Persona: Creating a reusable AI expert role
   - Workflow: Orchestrating multiple personas for a process
   - Project: Building something specific (website, app, etc.) with requirements
3. Engage in multi-turn conversation to gather:
   - For personas: mission, inputs, workflow steps, success criteria, constraints, handoff expectations
   - For workflows: steps (personas involved), execution pattern, execution guidance
   - For projects: project type, target audience, key features (epics), user stories, acceptance criteria
4. Provide reasoning for your questions and suggestions
5. Once you have enough information, generate the JSON spec
6. Present it with reasoning and ask for confirmation

PROJECT CREATION FLOW (Interview Style):
When creating a project, act as a project manager interviewing the user:
1. Identify project type and high-level goal
2. Ask about target users, scope, constraints, timeline
3. Identify major features that will become epics (aim for 3-7 epics)
4. For each epic, break down into user stories (2-10 stories per epic)
5. For each story, suggest 2-5 specific, measurable acceptance criteria
6. Review complete structure with user
7. Generate project JSON when user approves

ACCEPTANCE CRITERIA GUIDELINES:
✓ GOOD: "Product grid displays 12 items per page with pagination"
✓ GOOD: "Search returns results in < 500ms for 10,000 products"
✓ GOOD: "Mobile layout uses single column below 768px viewport width"
✗ BAD: "Product grid looks good" (too vague)
✗ BAD: "Search is fast" (not measurable)
✗ BAD: "Works on mobile" (not specific)

IMPORTANT RULES:
- Always validate that generated JSON matches the schemas exactly
- Use lowercase IDs with hyphens for projects (e.g., "epic-1", "story-1-1", "ac-1-1-1")
- Use lowercase IDs with underscores for personas/workflows (e.g., "code_reviewer")
- For personas, ensure specification.mission, specification.inputs, specification.workflow, specification.success_criteria, specification.constraints, specification.handoff_expectations are all present
- For workflows, ensure steps array has valid persona_ids and execution_spec is complete
- For projects, ensure each story has 2-5 specific acceptance criteria
- Ask clarifying questions if requirements are ambiguous
- Provide reasoning for your suggestions
- When generating JSON, output ONLY the raw JSON object in a json code block
- DO NOT wrap the JSON in status or suggestedSpec fields - output the bare object only

PROJECT COMPLETION CRITERIA:
- Project has clear name and description
- At least 3 epics with clear priorities
- Each epic has 2-10 stories
- Each story has 2-5 acceptance criteria
- Acceptance criteria are specific and measurable (not vague)
- User confirms structure matches their vision

RESPONSE FORMAT:
- Always provide clear, helpful responses
- Include reasoning for your questions and suggestions
- When generating JSON, ensure it's valid and matches schemas
- Present the JSON in a json code block for user review

When you detect the user wants to create a project (keywords: "build", "create project", "website", "app", "application"), switch to project interview mode and guide them through the structured requirements gathering process.`;
}

export async function chatWithAssistant(
  request: ChatRequest,
  conversationHistory: ChatMessage[] = []
): Promise<ChatResponse> {
  const client = getClient();
  const { personaSchema, workflowSchema } = loadSchemas();
  const examples = await loadExamples();
  
  const systemPrompt = buildSystemPrompt(personaSchema, workflowSchema, examples, request.attachedFiles);
  
  // Filter out messages marked as excluded from history
  const filteredHistory = conversationHistory.filter(msg => !msg.excludeFromHistory);
  
  // Truncate conversation history if it's too long to avoid token limits
  // Keep the most recent messages (last 40 messages) + system prompt
  // This prevents hitting token rate limits with very long conversations
  const MAX_HISTORY_MESSAGES = 40;
  const truncatedHistory = filteredHistory.length > MAX_HISTORY_MESSAGES
    ? filteredHistory.slice(-MAX_HISTORY_MESSAGES)
    : filteredHistory;
  
  if (conversationHistory.length > MAX_HISTORY_MESSAGES) {
    const excludedCount = conversationHistory.length - filteredHistory.length;
    console.warn(
      `[AssistantService] Conversation history: ${conversationHistory.length} total messages, ` +
      `${excludedCount} excluded, ${filteredHistory.length} after filtering, ` +
      `truncated to ${MAX_HISTORY_MESSAGES} for API request`
    );
  } else if (conversationHistory.length !== filteredHistory.length) {
    const excludedCount = conversationHistory.length - filteredHistory.length;
    console.log(
      `[AssistantService] Conversation history: ${conversationHistory.length} total messages, ` +
      `${excludedCount} excluded, sending ${filteredHistory.length} to API`
    );
  }
  
  // Build messages array
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...truncatedHistory.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content
    })),
    { role: 'user', content: request.message }
  ];
  
  console.log(`[AssistantService] Sending request with ${messages.length} total messages (${truncatedHistory.length} from history)`);
  
  try {
    // GPT-5 models (reasoning models) don't support temperature, top_p, etc.
    // They use max_completion_tokens instead of max_tokens
    const isGpt5Model = AZURE_OPENAI_DEPLOYMENT_NAME.startsWith('gpt-5');
    
    const requestParams: {
      model: string;
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      max_completion_tokens?: number;
      max_tokens?: number;
      temperature?: number;
    } = {
      // AzureOpenAI: If deployment is set in constructor, model should be empty string
      // However, some configurations may require the deployment name here instead
      // Try empty string first (standard), but we can fallback to deployment name if needed
      model: '', 
      messages: messages
    };
    
    if (isGpt5Model) {
      // GPT-5 models use max_completion_tokens, not max_tokens
      // GPT-5 models don't support temperature, top_p, etc.
      requestParams.max_completion_tokens = 4000;
    } else {
      // Other models use max_tokens and support temperature
      requestParams.max_tokens = 4000;
      requestParams.temperature = 0.7;
    }
    
    console.log(`Making chat completion request with params:`, {
      model: requestParams.model,
      messageCount: requestParams.messages.length,
      max_completion_tokens: requestParams.max_completion_tokens,
      max_tokens: requestParams.max_tokens
    });
    
    const response = await client.chat.completions.create(requestParams);
    
    const assistantMessage = response.choices[0]?.message?.content || '';
    
    // Try to extract JSON spec if present
    let suggestedSpec: ChatResponse['suggestedSpec'] | undefined;
    
    // Try multiple patterns for JSON extraction
    let jsonText: string | null = null;
    
    // Pattern 1: ```json ... ```
    const jsonMatch1 = assistantMessage.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch1) {
      jsonText = jsonMatch1[1];
    } else {
      // Pattern 2: ``` ... ``` (generic code block)
      const jsonMatch2 = assistantMessage.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch2) {
        jsonText = jsonMatch2[1];
      } else {
        // Pattern 3: Look for JSON object directly
        const jsonMatch3 = assistantMessage.match(/\{[\s\S]*\}/);
        if (jsonMatch3) {
          jsonText = jsonMatch3[0];
        }
      }
    }
    
    if (jsonText) {
      try {
        let parsed = JSON.parse(jsonText.trim());
        
        // FALLBACK: If AI incorrectly wrapped it in suggestedSpec, unwrap it
        if (parsed.suggestedSpec && typeof parsed.suggestedSpec === 'object') {
          console.log('[AssistantService] Unwrapping incorrectly wrapped suggestedSpec');
          parsed = parsed.suggestedSpec;
        }
        
        // Determine type based on structure
        if (parsed.epics && Array.isArray(parsed.epics)) {
          // It's a project (has epics array)
          suggestedSpec = { type: 'project', spec: parsed };
        } else if (parsed.steps && parsed.execution_spec) {
          // It's a workflow
          suggestedSpec = { type: 'workflow', spec: parsed };
        } else if (parsed.specification || (parsed.id && parsed.name)) {
          // It's a persona
          suggestedSpec = { type: 'persona', spec: parsed };
        }
      } catch (e) {
        // JSON parsing failed, continue without spec
        console.warn('Failed to parse JSON from assistant response:', e);
      }
    }
    
    // Determine status
    let status: ChatResponse['status'] = 'conversing';
    if (suggestedSpec) {
      status = 'ready_to_save';
    } else if (assistantMessage.toLowerCase().includes('clarify') || assistantMessage.toLowerCase().includes('question')) {
      status = 'needs_clarification';
    }
    
    // Extract questions if present
    const questions: string[] = [];
    const questionMatches = assistantMessage.match(/\?\s*([^\n]+)/g);
    if (questionMatches) {
      questions.push(...questionMatches.map((q: string) => q.replace(/^\?\s*/, '').trim()));
    }
    
    return {
      message: assistantMessage,
      suggestedSpec,
      questions: questions.length > 0 ? questions : undefined,
      status
    };
  } catch (error: unknown) {
    console.error('Error calling Azure OpenAI:', error);
    
    // Provide more detailed error information
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status?: number }).status;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (status === 404) {
        throw new Error(
          `Deployment "${AZURE_OPENAI_DEPLOYMENT_NAME}" not found. ` +
          `Please verify:\n` +
          `1. The deployment name is correct in your Azure OpenAI resource\n` +
          `2. The endpoint "${AZURE_OPENAI_ENDPOINT}" is correct\n` +
          `3. The API version is supported for this deployment\n` +
          `Original error: ${errorMessage}`
        );
      }
      
      if (status === 429) {
        // Rate limit error - extract retry-after information from error object
        let retryAfterSeconds = 60; // Default
        if (error && typeof error === 'object' && 'headers' in error) {
          const headers = (error as { headers?: Headers | Record<string, string> }).headers;
          if (headers instanceof Headers) {
            const retryAfter = headers.get('retry-after');
            if (retryAfter) {
              retryAfterSeconds = parseInt(retryAfter, 10) || 60;
            }
          } else if (headers && typeof headers === 'object' && 'retry-after' in headers) {
            retryAfterSeconds = parseInt(String(headers['retry-after']), 10) || 60;
          }
        }
        
        throw new Error(
          `Rate limit exceeded. Please wait ${retryAfterSeconds} seconds before retrying. ` +
          `This usually happens when:\n` +
          `1. The conversation is very long (${messages.length} messages in this request)\n` +
          `2. Individual messages are very large\n` +
          `3. You've exceeded your token rate limit for the current pricing tier\n\n` +
          `Suggestion: Try breaking your message into smaller parts, or wait ${retryAfterSeconds} seconds and retry.`
        );
      }
      
      throw new Error(`Azure OpenAI API error (${status}): ${errorMessage}`);
    }
    
    throw new Error(`Failed to get assistant response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

