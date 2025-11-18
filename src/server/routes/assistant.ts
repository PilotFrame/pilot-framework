import { Router } from 'express';

import type { AuthenticatedRequest } from '../auth.js';
import { chatWithAssistant, chatWithContextualAssistant, summarizeConversation, type ChatRequest, type ChatMessage, type ContextualChatRequest } from '../services/assistantService.js';
import {
  createConversation,
  getConversation,
  addMessageToConversation,
  getConversationMessages,
  listConversations,
  toggleMessageExclusion
} from '../services/conversationService.js';

// Import conversations map for debugging (temporary)
import { conversations } from '../services/conversationService.js';

export const assistantRouter = Router();

// Test route to verify routing works
assistantRouter.get('/test', (_req, res) => {
  res.json({ message: 'Assistant router is working' });
});

// Context-aware chat (for Persona/Workflow/Project editing)
assistantRouter.post('/chat-contextual', async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body;
    
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ 
        error: 'Invalid request body. Expected JSON object.',
      });
      return;
    }
    
    // Extract required fields
    const message = body.message;
    const operation = body.operation; // 'create' | 'update' | 'refine' | 'general'
    const entityType = body.entityType; // 'persona' | 'workflow' | 'project' | 'general'
    const currentSpec = body.currentSpec; // Optional: existing spec to update
    const focusArea = body.focusArea; // Optional: specific area to focus on
    const conversationId = body.conversationId && typeof body.conversationId === 'string' 
      ? body.conversationId.trim() 
      : undefined;
    
    // Validate required fields
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required and must be a string' });
      return;
    }
    
    if (!operation || !['create', 'update', 'refine', 'general'].includes(operation)) {
      res.status(400).json({ error: 'Operation must be one of: create, update, refine, general' });
      return;
    }
    
    if (!entityType || !['persona', 'workflow', 'project', 'general'].includes(entityType)) {
      res.status(400).json({ error: 'EntityType must be one of: persona, workflow, project, general' });
      return;
    }
    
    // Get or create conversation
    let conversation;
    if (conversationId && conversationId.length > 0) {
      conversation = getConversation(conversationId);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
    } else {
      conversation = createConversation();
    }
    
    // Add user message to conversation
    addMessageToConversation(conversation.id, 'user', message.trim());
    
    // Get conversation history
    const conversationHistory: ChatMessage[] = getConversationMessages(conversation.id)
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        excludeFromHistory: msg.excludeFromHistory || false
      }));
    
    // Call contextual assistant service
    const request: ContextualChatRequest = {
      message: message.trim(),
      operation,
      entityType,
      currentSpec,
      focusArea,
      conversationId: conversation.id
    };
    
    const response = await chatWithContextualAssistant(request, conversationHistory);
    
    // Add assistant response to conversation
    addMessageToConversation(conversation.id, 'assistant', response.message);
    
    // Return response with conversationId
    res.json({ 
      data: {
        ...response,
        conversationId: conversation.id
      }
    });
  } catch (error) {
    console.error('Error in contextual assistant chat route:', error);
    next(error);
  }
});

// Send a message in a conversation (creates conversation if conversationId not provided)
assistantRouter.post('/chat', async (req: AuthenticatedRequest, res, next) => {
  try {
    // Debug logging
    console.log('=== Request Debug ===');
    console.log('Method:', req.method);
    console.log('Original URL:', req.originalUrl);
    console.log('URL:', req.url);
    console.log('Path:', req.path);
    console.log('Content-Type:', req.get('content-type'));
    console.log('Body exists:', !!req.body);
    console.log('Body type:', typeof req.body);
    console.log('Body value:', JSON.stringify(req.body));
    console.log('Body keys:', req.body ? Object.keys(req.body) : 'no body');
    console.log('===================');
    
    // If body is empty, try to parse it manually (fallback)
    let body = req.body;
    if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
      const contentType = req.get('content-type') || '';
      if (contentType.includes('application/json')) {
        // Body might not have been parsed - this shouldn't happen but let's handle it
        console.warn('Body appears empty, but Content-Type is JSON. This might indicate a parsing issue.');
      }
    }
    
    // Check if body exists and is an object
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      console.error('Request body is missing or invalid:', body);
      res.status(400).json({ 
        error: 'Invalid request body. Expected JSON object with "message" field.',
        received: body,
        contentType: req.get('content-type'),
        hint: 'Make sure Content-Type header is "application/json" and body is valid JSON'
      });
      return;
    }
    
    // Extract message - it's required and must be a string
    const message = body.message;
    // Normalize conversationId - trim whitespace and ensure it's a valid string if provided
    const conversationId = body.conversationId && typeof body.conversationId === 'string' 
      ? body.conversationId.trim() 
      : undefined;
    const context = body.context;
    const attachedFiles = body.attachedFiles; // Array of { id?, name, type, content }
    
    // Validate message field - backend controls the type
    if (message === undefined || message === null) {
      console.error('Message field is missing:', { 
        body: req.body,
        bodyKeys: Object.keys(req.body),
        messageField: req.body?.message
      });
      res.status(400).json({ 
        error: 'Message is required and must be a string',
        received: {
          bodyKeys: Object.keys(req.body),
          messageField: req.body?.message,
          messageType: typeof req.body?.message
        }
      });
      return;
    }
    
    // Ensure message is a string (convert if needed)
    let messageStr: string;
    if (typeof message === 'string') {
      messageStr = message;
    } else if (typeof message === 'number' || typeof message === 'boolean') {
      messageStr = String(message);
    } else {
      res.status(400).json({ 
        error: 'Message must be a string',
        receivedType: typeof message,
        receivedValue: message
      });
      return;
    }
    
    if (messageStr.trim().length === 0) {
      res.status(400).json({ 
        error: 'Message cannot be empty'
      });
      return;
    }
    
    // Get or create conversation (backend creates if conversationId not provided)
    let conversation;
    if (conversationId && conversationId.length > 0) {
      console.log(`[AssistantRoute] Looking for existing conversation: "${conversationId}" (length: ${conversationId.length})`);
      conversation = getConversation(conversationId);
      if (!conversation) {
        console.error(`[AssistantRoute] Conversation "${conversationId}" not found in store`);
        const availableIds = Array.from(conversations.keys());
        console.log(`[AssistantRoute] Available conversation IDs (${availableIds.length}):`, availableIds);
        res.status(404).json({ 
          error: 'Conversation not found',
          requestedId: conversationId,
          availableCount: availableIds.length
        });
        return;
      }
      console.log(`[AssistantRoute] Found conversation ${conversationId} with ${conversation.messages.length} messages`);
    } else {
      // Create new conversation on first message
      console.log('[AssistantRoute] Creating new conversation (no conversationId provided)');
      conversation = createConversation();
      console.log(`[AssistantRoute] Created conversation: ${conversation.id}`);
    }
    
    // Add user message to conversation
    addMessageToConversation(conversation.id, 'user', messageStr.trim());
    
    // Get conversation history (excluding system messages for API call)
    const conversationHistory: ChatMessage[] = getConversationMessages(conversation.id)
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        excludeFromHistory: msg.excludeFromHistory || false
      }));
    
    // Call assistant service
    const response = await chatWithAssistant(
      {
        message: messageStr.trim(),
        conversationId: conversation.id,
        context,
        attachedFiles: attachedFiles && Array.isArray(attachedFiles) ? attachedFiles : undefined
      },
      conversationHistory
    );
    
    // Add assistant response to conversation
    addMessageToConversation(conversation.id, 'assistant', response.message);
    
    // Always return conversationId so frontend can maintain it
    res.json({ 
      data: {
        ...response,
        conversationId: conversation.id
      }
    });
  } catch (error) {
    console.error('Error in assistant chat route:', error);
    next(error);
  }
});

// List all conversations
assistantRouter.get('/conversations', async (_req: AuthenticatedRequest, res) => {
  try {
    const conversations = listConversations();
    res.json({ 
      data: conversations
    });
  } catch (error) {
    console.error('Error listing conversations:', error);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// Get conversation history
assistantRouter.get('/conversations/:conversationId', async (req: AuthenticatedRequest, res) => {
  const { conversationId } = req.params;
  const conversation = getConversation(conversationId);
  
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  
  res.json({ 
    data: {
      conversationId: conversation.id,
      messages: conversation.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    }
  });
});

// Toggle message exclusion from history
assistantRouter.post('/conversations/:conversationId/messages/:messageIndex/toggle-exclusion', async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId, messageIndex } = req.params;
    const index = parseInt(messageIndex, 10);
    
    if (isNaN(index) || index < 0) {
      res.status(400).json({ error: 'Invalid message index' });
      return;
    }
    
    const conversation = toggleMessageExclusion(conversationId, index);
    
    if (!conversation) {
      res.status(404).json({ error: 'Conversation or message not found' });
      return;
    }
    
    res.json({
      data: {
        conversationId: conversation.id,
        messageIndex: index,
        excludeFromHistory: conversation.messages[index].excludeFromHistory
      }
    });
  } catch (error) {
    console.error('Error toggling message exclusion:', error);
    res.status(500).json({ error: 'Failed to toggle message exclusion' });
  }
});

// Summarize conversation and mark old messages as excluded
assistantRouter.post('/conversations/:conversationId/summarize', async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = getConversation(conversationId);
    
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    
    // Get conversation history (excluding already excluded messages)
    const conversationHistory: ChatMessage[] = getConversationMessages(conversationId)
      .filter(msg => !msg.excludeFromHistory)
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        excludeFromHistory: false
      }));
    
    if (conversationHistory.length === 0) {
      res.status(400).json({ error: 'No conversation history to summarize' });
      return;
    }
    
    // Generate summary
    const summary = await summarizeConversation(conversationHistory);
    
    // Count messages that will be excluded (all non-excluded messages before summary)
    const messagesToExclude = conversation.messages.filter(msg => !msg.excludeFromHistory).length;
    
    // Add summary as an assistant message (so it's visible in UI and can be included in future summaries)
    // Format it clearly as a summary
    const summaryMessage = `📋 **Conversation Summary**\n\n${summary}\n\n---\n*This summary preserves the context of ${messagesToExclude} previous messages that have been excluded from history.*`;
    addMessageToConversation(conversationId, 'assistant', summaryMessage);
    
    // Reload conversation to get the updated state with the summary
    const updatedConversation = getConversation(conversationId);
    if (!updatedConversation) {
      res.status(500).json({ error: 'Failed to reload conversation after adding summary' });
      return;
    }
    
    // Mark all old messages (before the summary) as excluded from history
    // The summary is now the last message, so exclude all messages before it
    // IMPORTANT: Don't exclude the summary itself (it's at summaryIndex)
    const summaryIndex = updatedConversation.messages.length - 1;
    for (let i = 0; i < summaryIndex; i++) {
      // Only exclude messages that aren't already excluded and aren't summaries
      const msg = updatedConversation.messages[i];
      if (!msg.excludeFromHistory && !msg.content?.includes('📋 **Conversation Summary**')) {
        toggleMessageExclusion(conversationId, i);
      }
    }
    
    // Reload one more time to get final state
    const finalConversation = getConversation(conversationId);
    
    res.json({
      data: {
        conversationId: finalConversation?.id || conversationId,
        summary,
        messagesExcluded: messagesToExclude,
        totalMessages: finalConversation?.messages.length || 0
      }
    });
  } catch (error) {
    console.error('Error summarizing conversation:', error);
    res.status(500).json({ 
      error: 'Failed to summarize conversation',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

