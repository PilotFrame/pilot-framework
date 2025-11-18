import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiConfig } from '../types';
import { buildAuthHeaders } from '../utils';

type EntityType = 'persona' | 'workflow' | 'project' | 'general';
type OperationType = 'create' | 'update' | 'refine' | 'general';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date | string;
  extractedSpec?: {
    type: EntityType;
    spec: Record<string, unknown>;
  };
};

type ChatResponse = {
  message: string;
  suggestedSpec?: {
    type: EntityType;
    spec: Record<string, unknown>;
  };
  questions?: string[];
  reasoning?: string;
  status: 'conversing' | 'ready_to_save' | 'needs_clarification';
};

export interface AIPilotProps {
  config: ApiConfig;
  entityType: EntityType;
  currentSpec?: Record<string, unknown>; // Existing spec when updating
  onSpecUpdate?: (spec: Record<string, unknown>) => void; // Callback when user accepts a new spec
  onSpecApply?: (spec: Record<string, unknown>) => void; // Callback to apply without saving
  title?: string;
  description?: string;
}

export function AIPilot({
  config,
  entityType,
  currentSpec,
  onSpecUpdate,
  onSpecApply,
  title,
  description
}: AIPilotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [operation, setOperation] = useState<OperationType>('update');
  const [focusArea, setFocusArea] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [suggestedSpec, setSuggestedSpec] = useState<ChatResponse['suggestedSpec'] | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canCallApi = useMemo(
    () => config.baseUrl.trim().length > 0 && config.token.trim().length > 0,
    [config.baseUrl, config.token]
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set operation based on whether we have a current spec
  useEffect(() => {
    if (currentSpec) {
      setOperation('update');
    } else {
      setOperation('create');
    }
  }, [currentSpec]);

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeText = currentSpec
        ? `I'll help you update this ${entityType}. I can make targeted changes while preserving existing content. What would you like to modify?`
        : `I'll help you create a new ${entityType}. What would you like to build?`;
      
      setMessages([
        {
          role: 'assistant',
          content: welcomeText,
          timestamp: new Date()
        }
      ]);
    }
  }, [messages.length, entityType, currentSpec]);

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading || !canCallApi) {
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const requestBody = {
        message: inputMessage.trim(),
        operation,
        entityType,
        currentSpec: operation === 'update' || operation === 'refine' ? currentSpec : undefined,
        focusArea: focusArea.trim() || undefined,
        conversationId: conversationId || undefined
      };

      const response = await fetch(new URL('/api/assistant/chat-contextual', config.baseUrl).toString(), {
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

      // Store conversationId
      if (chatResponse.conversationId) {
        setConversationId(chatResponse.conversationId);
      }

      // Extract spec from message if present
      const extractedSpec = extractSpecFromMessage(chatResponse.message);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: chatResponse.message,
        timestamp: new Date(),
        extractedSpec: extractedSpec || chatResponse.suggestedSpec
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update suggested spec
      if (chatResponse.suggestedSpec || extractedSpec) {
        setSuggestedSpec(chatResponse.suggestedSpec || extractedSpec || null);
        setShowDiff(true);
      }
    } catch (error) {
      setErrorMessage(`Failed to send message: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, isLoading, canCallApi, operation, entityType, currentSpec, focusArea, conversationId, config]);

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
      }
    }
    
    if (jsonText) {
      try {
        const parsed = JSON.parse(jsonText.trim());
        
        // Determine type based on structure
        if (parsed.epics && Array.isArray(parsed.epics)) {
          return { type: 'project', spec: parsed };
        } else if (parsed.steps && parsed.execution_spec) {
          return { type: 'workflow', spec: parsed };
        } else if (parsed.specification || (parsed.id && parsed.name)) {
          return { type: 'persona', spec: parsed };
        }
      } catch (e) {
        return null;
      }
    }
    
    return null;
  }, []);

  const handleAcceptSpec = useCallback(() => {
    if (suggestedSpec && onSpecUpdate) {
      onSpecUpdate(suggestedSpec.spec);
      setSuggestedSpec(null);
      setShowDiff(false);
      
      // Add confirmation message
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Great! The spec has been applied. You can now save it or ask me to make further changes.',
          timestamp: new Date()
        }
      ]);
    }
  }, [suggestedSpec, onSpecUpdate]);

  const handleApplyToEditor = useCallback(() => {
    if (suggestedSpec && onSpecApply) {
      onSpecApply(suggestedSpec.spec);
      setShowDiff(false);
      
      // Add confirmation message
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Spec copied to editor. You can review and make manual adjustments before saving.',
          timestamp: new Date()
        }
      ]);
    }
  }, [suggestedSpec, onSpecApply]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const renderDiff = () => {
    if (!showDiff || !suggestedSpec) return null;

    return (
      <div className="rounded-lg border border-green-800 bg-green-900/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-green-400">
            Proposed {suggestedSpec.type} Specification
          </h4>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDiff(false)}
              className="rounded bg-slate-700 px-3 py-1 text-xs font-medium text-white hover:bg-slate-600"
            >
              Hide
            </button>
            {onSpecApply && (
              <button
                onClick={handleApplyToEditor}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                Copy to Editor
              </button>
            )}
            {onSpecUpdate && (
              <button
                onClick={handleAcceptSpec}
                className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
              >
                Accept & Apply
              </button>
            )}
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto rounded-lg bg-slate-900 p-4">
          <pre className="text-xs text-slate-300">
            {JSON.stringify(suggestedSpec.spec, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">
            {title || 'AI Pilot'}
          </h3>
          <p className="text-xs text-slate-400">
            {description || 'Get AI assistance with creating and updating specifications'}
          </p>
        </div>
      </div>

      {/* Operation Controls */}
      <div className="flex items-center gap-2">
        <label htmlFor="operation-mode" className="text-xs text-slate-400">Mode:</label>
        <select
          id="operation-mode"
          value={operation}
          onChange={(e) => setOperation(e.target.value as OperationType)}
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white"
          disabled={!currentSpec && operation !== 'create'}
        >
          {!currentSpec && <option value="create">Create New</option>}
          {currentSpec && (
            <>
              <option value="update">Update Existing</option>
              <option value="refine">Refine & Improve</option>
              <option value="general">General Chat</option>
            </>
          )}
        </select>
        
        {(operation === 'update' || operation === 'refine') && (
          <input
            type="text"
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
            placeholder="Focus area (optional)"
            className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white placeholder:text-slate-500"
          />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-3">
        <div className="flex flex-col gap-3">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-100'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {message.content.replace(/```json\s*[\s\S]*?```/g, '').replace(/```\s*[\s\S]*?```/g, '').trim()}
                </div>
                <div className="mt-1 text-xs opacity-70">
                  {message.timestamp instanceof Date
                    ? message.timestamp.toLocaleTimeString()
                    : new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-slate-800 px-3 py-2">
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
      </div>

      {/* Diff View */}
      {renderDiff()}

      {/* Error Message */}
      {errorMessage && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-xs text-red-400">
          {errorMessage}
        </div>
      )}

      {/* Input Area */}
      <div className="flex flex-col gap-2">
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            canCallApi
              ? "Describe what you want to do... (Enter to send, Shift+Enter for new line)"
              : 'Configure API connection first'
          }
          disabled={!canCallApi || isLoading}
          className="min-h-[80px] w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="flex items-center justify-end">
          <button
            onClick={sendMessage}
            disabled={!canCallApi || isLoading || !inputMessage.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

