import { Router } from 'express';

import type { AuthenticatedRequest } from '../auth.js';
import { chatWithAssistant, type ChatRequest, type ChatMessage } from '../services/assistantService.js';
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
        context
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

