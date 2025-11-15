import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ApiConfig } from '../types';
import { buildAuthHeaders } from '../utils';

type AttachedFile = {
  id: string;
  name: string;
  type: 'persona' | 'workflow';
  content: Record<string, unknown>; // Full spec/definition content
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date | string;
  failed?: boolean; // Track if this message failed
  retrying?: boolean; // Track if retry is in progress
  excludeFromHistory?: boolean; // If true, this message won't be sent to API in future requests
  attachedFiles?: AttachedFile[]; // Attached persona/workflow files
  extractedSpec?: { // Extracted persona/workflow spec from this message
    type: 'persona' | 'workflow';
    spec: Record<string, unknown>;
  };
};

type ConversationSummary = {
  id: string;
  messageCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastMessage?: string;
};

type ChatResponse = {
  message: string;
  suggestedSpec?: {
    type: 'persona' | 'workflow';
    spec: Record<string, unknown>;
  };
  questions?: string[];
  reasoning?: string;
  status: 'conversing' | 'ready_to_save' | 'needs_clarification';
};

type AssistantPageProps = {
  config: ApiConfig;
  connectionStatus: 'idle' | 'connected' | 'disconnected';
};

export function AssistantPage({ config, connectionStatus }: AssistantPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedSpec, setSuggestedSpec] = useState<ChatResponse['suggestedSpec'] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [availablePersonas, setAvailablePersonas] = useState<Array<{ id: string; name: string }>>([]);
  const [availableWorkflows, setAvailableWorkflows] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(new Set());
  const [selectedWorkflows, setSelectedWorkflows] = useState<Set<string>>(new Set());
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const canCallApi = useMemo(
    () => config.baseUrl.trim().length > 0 && config.token.trim().length > 0,
    [config.baseUrl, config.token]
  );

  // Load conversations list on mount
  useEffect(() => {
    if (canCallApi) {
      loadConversations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCallApi]);

  // Add welcome message on mount if no messages (no API call needed)
  useEffect(() => {
    if (messages.length === 0 && !conversationId) {
      setMessages([
        {
          role: 'assistant',
          content:
            "Hello! I'm here to help you create personas and workflows for PilotFrame. Please briefly describe what you'd like to create, and I'll guide you through the process.",
          timestamp: new Date()
        }
      ]);
    }
  }, [messages.length, conversationId]);

  // Helper function to render code blocks
  const renderMessageContent = useCallback((content: string, hasExtractedSpec: boolean): React.ReactNode => {
    if (hasExtractedSpec) {
      // If there's an extracted spec, remove the JSON code block from display
      const cleaned = content.replace(/```json\s*[\s\S]*?```/g, '').replace(/```\s*[\s\S]*?```/g, '').trim();
      return <span className="whitespace-pre-wrap">{cleaned}</span>;
    }
    
    // Otherwise, render code blocks normally
    return content.split(/(```[\s\S]*?```)/g).map((part, idx) => {
      const codeBlockMatch = part.match(/```(\w+)?\s*\n?([\s\S]*?)```/);
      if (codeBlockMatch) {
        const [, , code] = codeBlockMatch;
        return (
          <div key={idx} className="my-3 rounded-lg bg-slate-900 p-4">
            <pre className="overflow-x-auto text-xs text-slate-300">
              <code>{code.trim()}</code>
            </pre>
          </div>
        );
      }
      return (
        <span key={idx} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    });
  }, []);

  // Helper function to extract spec from message content
  const extractSpecFromMessage = useCallback((content: string): ChatResponse['suggestedSpec'] | null => {
    let jsonText: string | null = null;
    
    // Pattern 1: ```json ... ```
    const jsonMatch1 = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch1) {
      jsonText = jsonMatch1[1];
    } else {
      // Pattern 2: ``` ... ``` (generic code block)
      const jsonMatch2 = content.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch2) {
        jsonText = jsonMatch2[1];
      } else {
        // Pattern 3: Look for JSON object directly
        const jsonMatch3 = content.match(/\{[\s\S]*\}/);
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
          return { type: 'workflow', spec: parsed };
        } else if (parsed.specification || (parsed.id && parsed.name)) {
          return { type: 'persona', spec: parsed };
        }
      } catch (e) {
        // JSON parsing failed
        return null;
      }
    }
    
    return null;
  }, []);

  const loadConversations = useCallback(async () => {
    if (!canCallApi) return;
    
    try {
      setIsLoadingConversations(true);
      const response = await fetch(new URL('/api/assistant/conversations', config.baseUrl).toString(), {
        method: 'GET',
        headers: buildAuthHeaders(config)
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const body = await response.json();
      setConversations(body.data || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [canCallApi, config]);

  const loadConversation = useCallback(async (id: string) => {
    if (!canCallApi) return;
    
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      const response = await fetch(
        new URL(`/api/assistant/conversations/${id}`, config.baseUrl).toString(),
        {
          method: 'GET',
          headers: buildAuthHeaders(config)
        }
      );

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const body = await response.json();
      const conversation = body.data;
      
      // Convert conversation messages to ChatMessage format and extract specs from assistant messages
      const loadedMessages: ChatMessage[] = conversation.messages.map((msg: any) => {
        const chatMsg: ChatMessage = {
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          excludeFromHistory: msg.excludeFromHistory || false
        };
        
        // Extract spec from assistant messages (same as when new messages arrive)
        if (msg.role === 'assistant') {
          const extractedSpec = extractSpecFromMessage(msg.content);
          if (extractedSpec) {
            chatMsg.extractedSpec = extractedSpec;
          }
        }
        
        return chatMsg;
      });
      
      setMessages(loadedMessages);
      setConversationId(conversation.conversationId);
      
      // Extract from the last assistant message (same as original behavior)
      const lastAssistantMessage = loadedMessages
        .slice()
        .reverse()
        .find(msg => msg.role === 'assistant');
      
      if (lastAssistantMessage?.extractedSpec) {
        setSuggestedSpec(lastAssistantMessage.extractedSpec);
      } else {
        setSuggestedSpec(null);
      }
      
      setShowConversations(false);
      
      // Reload conversations list to update
      await loadConversations();
    } catch (error) {
      setErrorMessage(`Failed to load conversation: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [canCallApi, config, loadConversations, extractSpecFromMessage]);

  // Track previous message count to only scroll when new messages are added
  const prevMessageCountRef = useRef(0);
  
  useEffect(() => {
    // Only scroll if a new message was added (count increased)
    // Don't scroll if just updating existing messages (like toggling exclusion)
    const currentCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    
    if (currentCount > prevCount && prevCount > 0) {
      // Only scroll if we had messages before and now have more (new message added)
      // Skip scroll on initial load (when prevCount is 0)
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = currentCount;
  }, [messages]);

  const sendMessage = useCallback(async (messageContent: string, isRetry = false) => {
    if (!messageContent.trim() || isLoading || !canCallApi) {
      return;
    }

    // If retrying, mark the last user message as retrying
    if (isRetry) {
      setMessages((prev) => {
        const updated = [...prev];
        // Find the last user message (going backwards from the end)
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i]?.role === 'user') {
            updated[i] = { ...updated[i], retrying: true, failed: false };
            break;
          }
        }
        return updated;
      });
    } else {
      // New message - add it to the list
      const userMessage: ChatMessage = {
        role: 'user',
        content: messageContent.trim(),
        timestamp: new Date(),
        failed: false,
        attachedFiles: attachedFiles.length > 0 ? [...attachedFiles] : undefined
      };
      setMessages((prev) => [...prev, userMessage]);
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuggestedSpec(null);

    try {
      // Build request body - only include conversationId if we have one
      const requestBody: { 
        message: string; 
        conversationId?: string;
        attachedFiles?: Array<{ id?: string; name: string; type: 'persona' | 'workflow'; content: Record<string, unknown> }>;
      } = {
        message: messageContent.trim()
      };
      
      // Only include conversationId if we already have one from a previous response
      if (conversationId) {
        requestBody.conversationId = conversationId;
      }
      
      // Include attached files if any
      if (attachedFiles.length > 0) {
        requestBody.attachedFiles = attachedFiles.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          content: f.content
        }));
      }
      
      const response = await fetch(new URL('/api/assistant/chat', config.baseUrl).toString(), {
        method: 'POST',
        headers: {
          ...buildAuthHeaders(config),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const body = await response.json();
      const chatResponse: ChatResponse & { conversationId?: string } = body.data;

      // Store conversationId from response (backend always returns it)
      if (chatResponse.conversationId) {
        setConversationId(chatResponse.conversationId);
      }

      // Extract spec from assistant message
      const extractedSpec = extractSpecFromMessage(chatResponse.message);
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: chatResponse.message,
        timestamp: new Date(),
        extractedSpec: extractedSpec || undefined
      };

      // Clear attached files after sending
      setAttachedFiles([]);

      // If retrying, update the user message and add the new assistant response
      if (isRetry) {
        setMessages((prev) => {
          const updated = [...prev];
          // Find and update the last user message (going backwards from the end)
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i]?.role === 'user') {
              updated[i] = { ...updated[i], retrying: false, failed: false };
              break;
            }
          }
          return [...updated, assistantMessage];
        });
      } else {
        setMessages((prev) => [...prev, assistantMessage]);
      }

      // Update suggestedSpec - new spec replaces old one
      if (chatResponse.suggestedSpec) {
        setSuggestedSpec(chatResponse.suggestedSpec);
      } else {
        // Clear suggestedSpec if no new one is provided
        setSuggestedSpec(null);
      }
      
      // Reload conversations list to update
      await loadConversations();
    } catch (error) {
      const errorMsg = `Failed to send message: ${(error as Error).message}`;
      setErrorMessage(errorMsg);
      
      // Mark the last user message as failed
      setMessages((prev) => {
        const updated = [...prev];
        // Find the last user message (going backwards from the end)
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i]?.role === 'user') {
            updated[i] = { 
              ...updated[i], 
              failed: true, 
              retrying: false 
            };
            break;
          }
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, canCallApi, conversationId, config, loadConversations]);

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim()) {
      return;
    }
    const messageContent = inputMessage.trim();
    setInputMessage('');
    await sendMessage(messageContent, false);
  }, [inputMessage, sendMessage]);

  const handleRetryMessage = useCallback(async (messageContent: string) => {
    await sendMessage(messageContent, true);
  }, [sendMessage]);

  // Load available personas and workflows for attachment modal
  const loadAttachments = useCallback(async () => {
    if (!canCallApi) return;
    
    setIsLoadingAttachments(true);
    try {
      // Load personas
      const personasResponse = await fetch(new URL('/api/personas', config.baseUrl).toString(), {
        headers: buildAuthHeaders(config)
      });
      if (personasResponse.ok) {
        const personasData = await personasResponse.json();
        setAvailablePersonas(personasData.data || []);
      }

      // Load workflows
      const workflowsResponse = await fetch(new URL('/api/workflows', config.baseUrl).toString(), {
        headers: buildAuthHeaders(config)
      });
      if (workflowsResponse.ok) {
        const workflowsData = await workflowsResponse.json();
        setAvailableWorkflows(workflowsData.data || []);
      }
    } catch (error) {
      console.error('Failed to load attachments:', error);
      setErrorMessage(`Failed to load personas/workflows: ${(error as Error).message}`);
    } finally {
      setIsLoadingAttachments(false);
    }
  }, [canCallApi, config]);

  // Open attachment modal and load data
  const handleOpenAttachmentModal = useCallback(() => {
    setShowAttachmentModal(true);
    loadAttachments();
  }, [loadAttachments]);

  // Apply selected attachments
  const handleApplyAttachments = useCallback(async () => {
    if (!canCallApi) return;

    setIsLoadingAttachments(true);
    const newFiles: AttachedFile[] = [];

    try {
      // Fetch full content for selected personas
      for (const personaId of selectedPersonas) {
        const response = await fetch(new URL(`/api/personas/${personaId}/spec`, config.baseUrl).toString(), {
          headers: buildAuthHeaders(config)
        });
        if (response.ok) {
          const data = await response.json();
          const persona = data.data;
          newFiles.push({
            id: persona.id || personaId,
            name: persona.name || personaId,
            type: 'persona',
            content: persona
          });
        }
      }

      // Fetch full content for selected workflows
      for (const workflowId of selectedWorkflows) {
        const response = await fetch(new URL(`/api/workflows/${workflowId}`, config.baseUrl).toString(), {
          headers: buildAuthHeaders(config)
        });
        if (response.ok) {
          const data = await response.json();
          const workflow = data.data;
          newFiles.push({
            id: workflow.id || workflowId,
            name: workflow.name || workflowId,
            type: 'workflow',
            content: workflow
          });
        }
      }

      setAttachedFiles(newFiles);
      setShowAttachmentModal(false);
      setSelectedPersonas(new Set());
      setSelectedWorkflows(new Set());
      setErrorMessage(null);
    } catch (error) {
      console.error('Failed to load attachment content:', error);
      setErrorMessage(`Failed to load attachment content: ${(error as Error).message}`);
    } finally {
      setIsLoadingAttachments(false);
    }
  }, [canCallApi, config, selectedPersonas, selectedWorkflows]);

  const handleRemoveFile = useCallback((id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleToggleExclusion = useCallback(async (messageIndex: number) => {
    if (!conversationId || !canCallApi) return;
    
    try {
      const response = await fetch(
        new URL(`/api/assistant/conversations/${conversationId}/messages/${messageIndex}/toggle-exclusion`, config.baseUrl).toString(),
        {
          method: 'POST',
          headers: buildAuthHeaders(config)
        }
      );

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const body = await response.json();
      const { excludeFromHistory } = body.data;
      
      // Update the message in the UI
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[messageIndex]) {
          updated[messageIndex] = { ...updated[messageIndex], excludeFromHistory };
        }
        return updated;
      });
    } catch (error) {
      console.error('Failed to toggle message exclusion:', error);
      setErrorMessage(`Failed to toggle exclusion: ${(error as Error).message}`);
    }
  }, [conversationId, canCallApi, config]);

  // Generic handler to save a spec (works for both suggestedSpec and message extractedSpec)
  const handleSaveSpec = useCallback(async (spec?: ChatResponse['suggestedSpec']) => {
    const specToSave = spec || suggestedSpec;
    if (!specToSave) {
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const endpoint =
        specToSave.type === 'persona' ? '/api/personas' : '/api/workflows';
      const response = await fetch(new URL(endpoint, config.baseUrl).toString(), {
        method: 'POST',
        headers: {
          ...buildAuthHeaders(config),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(specToSave.spec)
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || `${response.status} ${response.statusText}`);
      }

      // Navigate to the appropriate page
      if (specToSave.type === 'persona') {
        navigate('/personas');
      } else {
        navigate('/workflows');
      }
    } catch (error) {
      setErrorMessage(`Failed to save: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [suggestedSpec, config, navigate]);

  // Generic handler to copy a spec to editor (works for both suggestedSpec and message extractedSpec)
  const handleCopyToEditor = useCallback((spec?: ChatResponse['suggestedSpec']) => {
    const specToCopy = spec || suggestedSpec;
    if (!specToCopy) {
      return;
    }

    // Store the spec in sessionStorage for the editor to pick up
    sessionStorage.setItem('assistantGeneratedSpec', JSON.stringify(specToCopy.spec));
    sessionStorage.setItem('assistantSpecType', specToCopy.type);

    // Navigate to the appropriate editor
    if (specToCopy.type === 'persona') {
      navigate('/personas');
    } else {
      navigate('/workflows');
    }
  }, [suggestedSpec, navigate]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  const handleNewConversation = useCallback(() => {
    setMessages([
      {
        role: 'assistant',
        content:
          "Hello! I'm here to help you create personas and workflows for PilotFrame. Please briefly describe what you'd like to create, and I'll guide you through the process.",
        timestamp: new Date()
      }
    ]);
    setConversationId(null);
    setSuggestedSpec(null);
    setErrorMessage(null);
    setShowConversations(false);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">AI Assistant</h2>
          <p className="text-sm text-slate-400">
            Describe your requirements and I'll help you create personas and workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCallApi && (
            <>
              <button
                onClick={() => setShowConversations(!showConversations)}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
              >
                {showConversations ? 'Hide' : 'Show'} Conversations ({conversations.length})
              </button>
              <button
                onClick={handleNewConversation}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                New Conversation
              </button>
            </>
          )}
          {!canCallApi && (
            <div className="rounded-lg bg-yellow-900/20 px-4 py-2 text-sm text-yellow-400">
              Please configure API connection in the header
            </div>
          )}
        </div>
      </div>

      {/* Conversations List Sidebar */}
      {showConversations && canCallApi && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Previous Conversations</h3>
            <button
              onClick={loadConversations}
              disabled={isLoadingConversations}
              className="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              {isLoadingConversations ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          {conversations.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              No previous conversations found
            </div>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    conversationId === conv.id
                      ? 'border-blue-500 bg-blue-900/20'
                      : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">
                        {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}
                      </div>
                      {conv.lastMessage && (
                        <div className="mt-1 truncate text-xs text-slate-400">
                          {conv.lastMessage}...
                        </div>
                      )}
                      <div className="mt-1 text-xs text-slate-500">
                        Updated: {new Date(conv.updatedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-6">
        {messages.map((message, index) => {
          // Check if this is the last user message (no user messages after it)
          const isLastUserMessage = message.role === 'user' && 
            messages.slice(index + 1).every(m => m.role !== 'user');
          const showRetry = isLastUserMessage && message.failed && !message.retrying;
          
          return (
            <div key={index} className="flex flex-col gap-2">
              <div
                className={`flex gap-4 ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className={`flex max-w-[80%] flex-col gap-2 rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? message.failed
                        ? 'bg-red-600 text-white'
                        : message.excludeFromHistory
                          ? 'bg-slate-600 text-white border-2 border-slate-400'
                          : 'bg-blue-600 text-white'
                      : message.excludeFromHistory
                        ? 'bg-slate-700 text-slate-200 border-2 border-slate-500'
                        : 'bg-slate-800 text-slate-100'
                  }`}
                >
                {message.excludeFromHistory && (
                  <div className="mb-1 flex items-center gap-1 text-xs opacity-80">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                    <span>Excluded from API context</span>
                  </div>
                )}
                {message.attachedFiles && message.attachedFiles.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {message.attachedFiles.map((file, fileIndex) => (
                      <div
                        key={fileIndex}
                        className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                          file.type === 'persona'
                            ? 'bg-purple-900/50 text-purple-200 border border-purple-700'
                            : 'bg-orange-900/50 text-orange-200 border border-orange-700'
                        }`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span className="font-medium">{file.name}</span>
                        <span className="opacity-70">({file.type})</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">
                  {renderMessageContent(message.content, !!message.extractedSpec)}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs opacity-70">
                    {message.timestamp instanceof Date 
                      ? message.timestamp.toLocaleTimeString()
                      : new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="flex items-center gap-2">
                    {conversationId && (
                      <button
                        onClick={() => handleToggleExclusion(index)}
                        disabled={isLoading}
                        className={`rounded p-1 text-xs transition-colors disabled:opacity-50 ${
                          message.excludeFromHistory
                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                            : 'bg-slate-700 hover:bg-slate-600 text-white opacity-70 hover:opacity-100'
                        }`}
                        title={message.excludeFromHistory ? 'Include in API context' : 'Exclude from API context'}
                      >
                        {message.excludeFromHistory ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                            />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.736m0 0L21 21"
                            />
                          </svg>
                        )}
                      </button>
                    )}
                    {showRetry && (
                      <button
                        onClick={() => handleRetryMessage(message.content)}
                        disabled={isLoading}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-red-700 disabled:opacity-50"
                        title="Retry this message"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        <span>Retry</span>
                      </button>
                    )}
                    {message.retrying && (
                      <div className="flex items-center gap-1 text-xs opacity-70">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-white"></div>
                        <span>Retrying...</span>
                      </div>
                    )}
                  </div>
                </div>
                </div>
              </div>
              {/* Show extracted spec in separate section after message */}
              {message.role === 'assistant' && message.extractedSpec && (
                <div className="ml-0 w-full rounded-lg border border-green-800 bg-green-900/20 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-green-400">
                      {message.extractedSpec.type === 'persona' ? 'Persona' : 'Workflow'} Specification
                    </h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => message.extractedSpec && handleCopyToEditor(message.extractedSpec)}
                        disabled={isLoading}
                        className="rounded bg-slate-700 px-3 py-1 text-xs font-medium text-white hover:bg-slate-600 disabled:opacity-50"
                      >
                        Copy to Editor
                      </button>
                      <button
                        onClick={() => message.extractedSpec && handleSaveSpec(message.extractedSpec)}
                        disabled={isLoading}
                        className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {isLoading ? 'Saving...' : 'Save & Create'}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900 p-4">
                    <pre className="overflow-x-auto text-xs text-slate-300">
                      {JSON.stringify(message.extractedSpec.spec, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {isLoading && (
          <div className="flex gap-4">
            <div className="flex max-w-[80%] flex-col gap-2 rounded-lg bg-slate-800 px-4 py-3 text-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-slate-400"></div>
                <div className="h-2 w-2 animate-pulse rounded-full bg-slate-400 delay-75"></div>
                <div className="h-2 w-2 animate-pulse rounded-full bg-slate-400 delay-150"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>


      {/* Error Message */}
      {errorMessage && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-red-400">
          {errorMessage}
        </div>
      )}

      {/* Input Area */}
      <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        {/* Attached Files List */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 rounded-lg border border-slate-700 bg-slate-800/50 p-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                  file.type === 'persona'
                    ? 'bg-purple-900/50 text-purple-200 border border-purple-700'
                    : 'bg-orange-900/50 text-orange-200 border border-orange-700'
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="font-medium">{file.name}</span>
                <span className="opacity-70">({file.type})</span>
                <button
                  onClick={() => handleRemoveFile(file.id)}
                  className="ml-1 rounded p-0.5 hover:bg-slate-700"
                  title="Remove attachment"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            canCallApi
              ? "Type your message here... (Press Enter to send, Shift+Enter for new line)"
              : 'Please configure API connection first'
          }
          disabled={!canCallApi || isLoading}
          className="min-h-[100px] w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAttachmentModal}
              disabled={!canCallApi || isLoading}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="Attach personas or workflows from server"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
              <span>Attach</span>
            </button>
          </div>
          <div className="text-xs text-slate-400">
            {connectionStatus === 'connected' && 'Connected'}
            {connectionStatus === 'disconnected' && 'Disconnected'}
            {connectionStatus === 'idle' && 'Not tested'}
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!canCallApi || isLoading || !inputMessage.trim()}
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Attachment Modal */}
      {showAttachmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-700 p-4">
              <h2 className="text-lg font-semibold text-white">Attach Personas & Workflows</h2>
              <button
                onClick={() => {
                  setShowAttachmentModal(false);
                  setSelectedPersonas(new Set());
                  setSelectedWorkflows(new Set());
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                title="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto p-4">
              {isLoadingAttachments ? (
                <div className="py-8 text-center text-slate-400">Loading...</div>
              ) : (
                <div className="space-y-6">
                  {/* Personas Section */}
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-purple-300">Personas</h3>
                    {availablePersonas.length === 0 ? (
                      <div className="text-sm text-slate-500">No personas available</div>
                    ) : (
                      <div className="space-y-2">
                        {availablePersonas.map((persona) => (
                          <label
                            key={persona.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 p-3 hover:bg-slate-800"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPersonas.has(persona.id)}
                              onChange={(e) => {
                                const newSet = new Set(selectedPersonas);
                                if (e.target.checked) {
                                  newSet.add(persona.id);
                                } else {
                                  newSet.delete(persona.id);
                                }
                                setSelectedPersonas(newSet);
                              }}
                              className="h-4 w-4 rounded border-slate-600 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="flex-1 text-sm text-white">{persona.name}</span>
                            <span className="text-xs text-slate-400">({persona.id})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Workflows Section */}
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-orange-300">Workflows</h3>
                    {availableWorkflows.length === 0 ? (
                      <div className="text-sm text-slate-500">No workflows available</div>
                    ) : (
                      <div className="space-y-2">
                        {availableWorkflows.map((workflow) => (
                          <label
                            key={workflow.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 p-3 hover:bg-slate-800"
                          >
                            <input
                              type="checkbox"
                              checked={selectedWorkflows.has(workflow.id)}
                              onChange={(e) => {
                                const newSet = new Set(selectedWorkflows);
                                if (e.target.checked) {
                                  newSet.add(workflow.id);
                                } else {
                                  newSet.delete(workflow.id);
                                }
                                setSelectedWorkflows(newSet);
                              }}
                              className="h-4 w-4 rounded border-slate-600 text-orange-600 focus:ring-orange-500"
                            />
                            <span className="flex-1 text-sm text-white">{workflow.name}</span>
                            <span className="text-xs text-slate-400">({workflow.id})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-700 p-4">
              <button
                onClick={() => {
                  setShowAttachmentModal(false);
                  setSelectedPersonas(new Set());
                  setSelectedWorkflows(new Set());
                }}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyAttachments}
                disabled={isLoadingAttachments || (selectedPersonas.size === 0 && selectedWorkflows.size === 0)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoadingAttachments ? 'Loading...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

