import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date | string; // Allow string for JSON serialization
  excludeFromHistory?: boolean; // If true, this message won't be sent to API in future requests
}

export interface Conversation {
  id: string;
  messages: ConversationMessage[];
  createdAt: Date | string; // Allow string for JSON serialization
  updatedAt: Date | string; // Allow string for JSON serialization
}

// JSON-serializable version of Conversation
interface ConversationJSON {
  id: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    excludeFromHistory?: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

// Directory for storing conversation files
const CONVERSATIONS_DIR = path.join(process.cwd(), 'data', 'conversations');

// Ensure conversations directory exists
function ensureConversationsDir(): void {
  if (!fs.existsSync(CONVERSATIONS_DIR)) {
    fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
    console.log(`[ConversationService] Created conversations directory: ${CONVERSATIONS_DIR}`);
  }
}

// Initialize directory on module load
ensureConversationsDir();

// In-memory cache for quick access (loaded from files)
const conversations = new Map<string, Conversation>();

// Export for debugging (temporary)
export { conversations };

// Convert Conversation to JSON-serializable format
function conversationToJSON(conversation: Conversation): ConversationJSON {
  return {
    id: conversation.id,
    messages: conversation.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
      excludeFromHistory: msg.excludeFromHistory || false
    })),
    createdAt: conversation.createdAt instanceof Date ? conversation.createdAt.toISOString() : conversation.createdAt,
    updatedAt: conversation.updatedAt instanceof Date ? conversation.updatedAt.toISOString() : conversation.updatedAt
  };
}

// Convert JSON to Conversation with Date objects
function conversationFromJSON(json: ConversationJSON): Conversation {
  return {
    id: json.id,
    messages: json.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      excludeFromHistory: (msg as any).excludeFromHistory || false
    })),
    createdAt: new Date(json.createdAt),
    updatedAt: new Date(json.updatedAt)
  };
}

// Get file path for a conversation
function getConversationFilePath(conversationId: string): string {
  return path.join(CONVERSATIONS_DIR, `${conversationId}.json`);
}

// Save conversation to file
function saveConversationToFile(conversation: Conversation): void {
  try {
    const filePath = getConversationFilePath(conversation.id);
    const json = conversationToJSON(conversation);
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf-8');
  } catch (error) {
    console.error(`[ConversationService] Failed to save conversation ${conversation.id} to file:`, error);
    throw error;
  }
}

// Load conversation from file
function loadConversationFromFile(conversationId: string): Conversation | null {
  try {
    const filePath = getConversationFilePath(conversationId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const json: ConversationJSON = JSON.parse(fileContent);
    return conversationFromJSON(json);
  } catch (error) {
    console.error(`[ConversationService] Failed to load conversation ${conversationId} from file:`, error);
    return null;
  }
}

// Load all conversations from files on startup
function loadAllConversations(): void {
  try {
    if (!fs.existsSync(CONVERSATIONS_DIR)) {
      return;
    }
    
    const files = fs.readdirSync(CONVERSATIONS_DIR).filter(file => file.endsWith('.json'));
    let loadedCount = 0;
    
    for (const file of files) {
      const conversationId = file.replace('.json', '');
      const conversation = loadConversationFromFile(conversationId);
      if (conversation) {
        conversations.set(conversationId, conversation);
        loadedCount++;
      }
    }
    
    console.log(`[ConversationService] Loaded ${loadedCount} conversations from ${CONVERSATIONS_DIR}`);
  } catch (error) {
    console.error('[ConversationService] Failed to load conversations from files:', error);
  }
}

// Load conversations on module initialization
loadAllConversations();

export function createConversation(): Conversation {
  const id = randomUUID();
  const now = new Date();
  
  const conversation: Conversation = {
    id,
    messages: [],
    createdAt: now,
    updatedAt: now
  };
  
  conversations.set(id, conversation);
  saveConversationToFile(conversation);
  console.log(`[ConversationService] Created conversation ${id}, total conversations: ${conversations.size}`);
  return conversation;
}

export function getConversation(id: string): Conversation | null {
  // Check in-memory cache first
  let conversation = conversations.get(id);
  
  // If not in cache, try loading from file
  if (!conversation) {
    conversation = loadConversationFromFile(id);
    if (conversation) {
      conversations.set(id, conversation);
      console.log(`[ConversationService] Loaded conversation ${id} from file`);
    }
  }
  
  if (!conversation) {
    console.log(`[ConversationService] Conversation ${id} not found. Available IDs:`, Array.from(conversations.keys()));
  } else {
    console.log(`[ConversationService] Found conversation ${id} with ${conversation.messages.length} messages`);
  }
  return conversation || null;
}

export function addMessageToConversation(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): Conversation | null {
  // Get conversation (will load from file if not in cache)
  let conversation = getConversation(conversationId);
  
  if (!conversation) {
    console.error(`[ConversationService] Cannot add message: conversation ${conversationId} not found`);
    return null;
  }
  
  conversation.messages.push({
    role,
    content,
    timestamp: new Date()
  });
  
  conversation.updatedAt = new Date();
  
  // Save to file after update
  saveConversationToFile(conversation);
  
  console.log(`[ConversationService] Added ${role} message to conversation ${conversationId}, total messages: ${conversation.messages.length}`);
  return conversation;
}

export function getConversationMessages(conversationId: string): ConversationMessage[] {
  // Get conversation (will load from file if not in cache)
  const conversation = getConversation(conversationId);
  return conversation?.messages || [];
}

// Toggle excludeFromHistory flag for a specific message
export function toggleMessageExclusion(
  conversationId: string,
  messageIndex: number
): Conversation | null {
  const conversation = getConversation(conversationId);
  
  if (!conversation) {
    console.error(`[ConversationService] Cannot toggle exclusion: conversation ${conversationId} not found`);
    return null;
  }
  
  if (messageIndex < 0 || messageIndex >= conversation.messages.length) {
    console.error(`[ConversationService] Invalid message index: ${messageIndex}`);
    return null;
  }
  
  const message = conversation.messages[messageIndex];
  message.excludeFromHistory = !message.excludeFromHistory;
  conversation.updatedAt = new Date();
  
  // Save to file after update
  saveConversationToFile(conversation);
  
  console.log(
    `[ConversationService] Toggled exclusion for message ${messageIndex} in conversation ${conversationId}: ${message.excludeFromHistory}`
  );
  
  return conversation;
}

// List all conversations with summary info
export function listConversations(): Array<{
  id: string;
  messageCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastMessage?: string;
}> {
  const conversationsList: Array<{
    id: string;
    messageCount: number;
    createdAt: Date | string;
    updatedAt: Date | string;
    lastMessage?: string;
  }> = [];
  
  try {
    if (!fs.existsSync(CONVERSATIONS_DIR)) {
      return conversationsList;
    }
    
    const files = fs.readdirSync(CONVERSATIONS_DIR).filter(file => file.endsWith('.json'));
    
    for (const file of files) {
      const conversationId = file.replace('.json', '');
      const conversation = getConversation(conversationId);
      
      if (conversation) {
        const lastMessage = conversation.messages.length > 0 
          ? conversation.messages[conversation.messages.length - 1].content.substring(0, 100)
          : undefined;
        
        conversationsList.push({
          id: conversation.id,
          messageCount: conversation.messages.length,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          lastMessage
        });
      }
    }
    
    // Sort by updatedAt (most recent first)
    conversationsList.sort((a, b) => {
      const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : new Date(a.updatedAt).getTime();
      const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : new Date(b.updatedAt).getTime();
      return bTime - aTime;
    });
  } catch (error) {
    console.error('[ConversationService] Failed to list conversations:', error);
  }
  
  return conversationsList;
}

// Clean up old conversations (older than 24 hours)
export function cleanupOldConversations(): void {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  let deletedCount = 0;
  
  // Check both in-memory cache and files
  const allConversationIds = new Set<string>();
  
  // Add IDs from memory cache
  for (const id of conversations.keys()) {
    allConversationIds.add(id);
  }
  
  // Add IDs from files
  if (fs.existsSync(CONVERSATIONS_DIR)) {
    const files = fs.readdirSync(CONVERSATIONS_DIR).filter(file => file.endsWith('.json'));
    for (const file of files) {
      const conversationId = file.replace('.json', '');
      allConversationIds.add(conversationId);
    }
  }
  
  // Check each conversation and delete if old
  for (const id of allConversationIds) {
    const conversation = getConversation(id);
    if (conversation) {
      const updatedAt = conversation.updatedAt instanceof Date 
        ? conversation.updatedAt.getTime() 
        : new Date(conversation.updatedAt).getTime();
      
      if (now - updatedAt > maxAge) {
        // Delete from memory
        conversations.delete(id);
        
        // Delete file
        const filePath = getConversationFilePath(id);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        } catch (error) {
          console.error(`[ConversationService] Failed to delete conversation file ${id}:`, error);
        }
      }
    }
  }
  
  if (deletedCount > 0) {
    console.log(`[ConversationService] Cleaned up ${deletedCount} old conversations`);
  }
}

// Run cleanup every hour
setInterval(cleanupOldConversations, 60 * 60 * 1000);

