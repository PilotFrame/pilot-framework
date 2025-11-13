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
}

export interface ChatResponse {
  message: string;
  suggestedSpec?: {
    type: 'persona' | 'workflow';
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
}

function buildSystemPrompt(personaSchema: string, workflowSchema: string, examples: { personas: string; workflows: string }): string {
  return `You are an AI assistant helping users create PilotFrame personas and workflows through natural language conversation.

Your goal is to:
1. Understand the user's requirements through multi-turn conversation
2. Determine if they need a standalone persona or a workflow (multiple personas)
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

CONVERSATION FLOW:
1. Start by asking the user to briefly describe their requirement
2. Based on the description, determine if it's a persona or workflow
3. Engage in multi-turn conversation to gather:
   - For personas: mission, inputs, workflow steps, success criteria, constraints, handoff expectations
   - For workflows: steps (personas involved), execution pattern (sequential/cycle/parallel/mixed), execution guidance
4. Provide reasoning for your questions and suggestions
5. Once you have enough information, generate the JSON spec
6. Present it with reasoning and ask for confirmation

IMPORTANT RULES:
- Always validate that generated JSON matches the schemas exactly
- Use lowercase IDs with underscores (e.g., "code_reviewer", not "CodeReviewer")
- For personas, ensure specification.mission, specification.inputs, specification.workflow, specification.success_criteria, specification.constraints, specification.handoff_expectations are all present
- For workflows, ensure steps array has valid persona_ids and execution_spec is complete
- Ask clarifying questions if requirements are ambiguous
- Provide reasoning for your suggestions
- When ready to save, set status to "ready_to_save" and include the suggestedSpec

RESPONSE FORMAT:
- Always provide clear, helpful responses
- Include reasoning for your questions and suggestions
- When generating JSON, ensure it's valid and matches schemas
- Use the "status" field to indicate conversation state:
  - "conversing": Still gathering information
  - "needs_clarification": Need more details
  - "ready_to_save": Have enough info, ready for user approval`;
}

export async function chatWithAssistant(
  request: ChatRequest,
  conversationHistory: ChatMessage[] = []
): Promise<ChatResponse> {
  const client = getClient();
  const { personaSchema, workflowSchema } = loadSchemas();
  const examples = await loadExamples();
  
  const systemPrompt = buildSystemPrompt(personaSchema, workflowSchema, examples);
  
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
        const parsed = JSON.parse(jsonText.trim());
        // Determine type based on structure
        if (parsed.steps && parsed.execution_spec) {
          suggestedSpec = { type: 'workflow', spec: parsed };
        } else if (parsed.specification || (parsed.id && parsed.name)) {
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

