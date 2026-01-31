import type { ChatMessage } from '../types';

/**
 * Parse Cursor IDE data from .cursor directory
 * Cursor stores conversation data in various formats
 */

interface CursorConversation {
  id: string;
  title?: string;
  messages: CursorMessage[];
  createdAt: Date;
  updatedAt: Date;
}

interface CursorMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  model?: string;
}

/**
 * Attempts to parse various Cursor data formats
 */
export async function parseCursorData(files: FileList): Promise<{
  conversations: CursorConversation[];
  chats: ChatMessage[];
}> {
  const conversations: CursorConversation[] = [];
  const chats: ChatMessage[] = [];
  
  for (const file of Array.from(files)) {
    const path = file.webkitRelativePath;
    
    // Look for Cursor-specific files
    if (path.includes('.cursor/') || path.includes('.cursorless/')) {
      try {
        if (path.endsWith('.json')) {
          const content = await file.text();
          const parsed = await parseJsonFile(content, path);
          if (parsed.conversations.length > 0) {
            conversations.push(...parsed.conversations);
          }
          if (parsed.chats.length > 0) {
            chats.push(...parsed.chats);
          }
        }
      } catch (e) {
        console.debug(`Could not parse Cursor file: ${path}`, e);
      }
    }
    
    // Also check for workspace state files
    if (path.includes('workspaceState') || path.includes('globalState')) {
      try {
        const content = await file.text();
        const parsed = await parseWorkspaceState(content);
        chats.push(...parsed);
      } catch (e) {
        console.debug(`Could not parse workspace state: ${path}`, e);
      }
    }
  }
  
  return { conversations, chats };
}

async function parseJsonFile(content: string, _path: string): Promise<{
  conversations: CursorConversation[];
  chats: ChatMessage[];
}> {
  const conversations: CursorConversation[] = [];
  const chats: ChatMessage[] = [];
  
  try {
    const data = JSON.parse(content);
    
    // Format 1: Array of messages
    if (Array.isArray(data)) {
      const messages = data
        .filter(isValidMessage)
        .map((msg, idx) => messageToChat(msg, idx));
      chats.push(...messages);
    }
    
    // Format 2: Object with messages array
    else if (data.messages && Array.isArray(data.messages)) {
      const messages = data.messages
        .filter(isValidMessage)
        .map((msg: unknown, idx: number) => messageToChat(msg, idx));
      chats.push(...messages);
      
      // Also create conversation
      if (messages.length > 0) {
        conversations.push({
          id: data.id || `conv-${Date.now()}`,
          title: data.title || extractTitle(messages),
          messages: data.messages.filter(isValidMessage),
          createdAt: new Date(data.createdAt || Date.now()),
          updatedAt: new Date(data.updatedAt || Date.now())
        });
      }
    }
    
    // Format 3: Object with conversations array
    else if (data.conversations && Array.isArray(data.conversations)) {
      for (const conv of data.conversations) {
        if (conv.messages && Array.isArray(conv.messages)) {
          const messages = conv.messages
            .filter(isValidMessage)
            .map((msg: unknown, idx: number) => messageToChat(msg, idx, conv.id));
          chats.push(...messages);
          
          conversations.push({
            id: conv.id || `conv-${Date.now()}`,
            title: conv.title || extractTitle(messages),
            messages: conv.messages.filter(isValidMessage),
            createdAt: new Date(conv.createdAt || Date.now()),
            updatedAt: new Date(conv.updatedAt || Date.now())
          });
        }
      }
    }
    
    // Format 4: Chat history format
    else if (data.history && Array.isArray(data.history)) {
      const messages = data.history
        .filter(isValidMessage)
        .map((msg: unknown, idx: number) => messageToChat(msg, idx));
      chats.push(...messages);
    }
    
    // Format 5: Tabs/sessions format
    else if (data.tabs && Array.isArray(data.tabs)) {
      for (const tab of data.tabs) {
        if (tab.messages && Array.isArray(tab.messages)) {
          const messages = tab.messages
            .filter(isValidMessage)
            .map((msg: unknown, idx: number) => messageToChat(msg, idx, tab.id));
          chats.push(...messages);
        }
      }
    }
    
  } catch (e) {
    console.debug('JSON parse error:', e);
  }
  
  return { conversations, chats };
}

async function parseWorkspaceState(content: string): Promise<ChatMessage[]> {
  const chats: ChatMessage[] = [];
  
  try {
    const data = JSON.parse(content);
    
    // Look for AI-related keys
    const aiKeys = Object.keys(data).filter(k => 
      k.toLowerCase().includes('ai') ||
      k.toLowerCase().includes('chat') ||
      k.toLowerCase().includes('cursor') ||
      k.toLowerCase().includes('copilot')
    );
    
    for (const key of aiKeys) {
      const value = data[key];
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            const messages = parsed
              .filter(isValidMessage)
              .map((msg, idx) => messageToChat(msg, idx));
            chats.push(...messages);
          }
        } catch {
          // Not JSON, skip
        }
      } else if (Array.isArray(value)) {
        const messages = value
          .filter(isValidMessage)
          .map((msg, idx) => messageToChat(msg, idx));
        chats.push(...messages);
      }
    }
  } catch (e) {
    console.debug('Workspace state parse error:', e);
  }
  
  return chats;
}

function isValidMessage(msg: unknown): msg is Record<string, unknown> {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as Record<string, unknown>;
  return (
    typeof m.role === 'string' &&
    typeof m.content === 'string' &&
    m.content.length > 0
  );
}

function messageToChat(
  msg: unknown, 
  index: number, 
  conversationId?: string
): ChatMessage {
  const m = msg as Record<string, unknown>;
  
  // Try to extract related files from content
  const relatedFiles = extractRelatedFiles(String(m.content));
  
  return {
    id: `chat-${conversationId || 'default'}-${index}`,
    timestamp: new Date(m.timestamp as number || Date.now()),
    role: (m.role as string) === 'assistant' ? 'assistant' : 'user',
    content: truncateContent(String(m.content)),
    relatedFiles,
    model: m.model as string | undefined
  };
}

function extractRelatedFiles(content: string): string[] {
  const files: string[] = [];
  
  // Match file paths in backticks
  const backtickPaths = content.match(/`([^`]+\.[a-z]{1,10})`/gi);
  if (backtickPaths) {
    for (const match of backtickPaths) {
      const path = match.slice(1, -1);
      if (isLikelyFilePath(path)) {
        files.push(normalizePath(path));
      }
    }
  }
  
  // Match file paths mentioned directly
  const directPaths = content.match(/(?:^|\s)((?:\.\/|\/)?[\w\-./]+\.[a-z]{1,10})(?:\s|$|[,.:;])/gim);
  if (directPaths) {
    for (const match of directPaths) {
      const path = match.trim().replace(/[,.:;]$/, '');
      if (isLikelyFilePath(path)) {
        files.push(normalizePath(path));
      }
    }
  }
  
  return [...new Set(files)]; // Deduplicate
}

function isLikelyFilePath(str: string): boolean {
  // Must have extension
  if (!str.includes('.')) return false;
  
  // Common file extensions
  const extensions = [
    'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
    'css', 'scss', 'sass', 'less',
    'html', 'htm', 'vue', 'svelte',
    'json', 'yaml', 'yml', 'xml', 'toml',
    'md', 'mdx', 'txt',
    'py', 'rb', 'go', 'rs', 'java', 'kt',
    'c', 'cpp', 'h', 'hpp',
    'sh', 'bash', 'zsh'
  ];
  
  const ext = str.split('.').pop()?.toLowerCase();
  if (!ext || !extensions.includes(ext)) return false;
  
  // Shouldn't be too long
  if (str.length > 200) return false;
  
  // Shouldn't contain certain chars
  if (/[<>"|?*]/.test(str)) return false;
  
  return true;
}

function normalizePath(path: string): string {
  // Ensure leading slash
  if (!path.startsWith('/') && !path.startsWith('./')) {
    path = '/' + path;
  }
  // Remove ./
  path = path.replace(/^\.\//, '/');
  return path;
}

function truncateContent(content: string, maxLength: number = 500): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + '...';
}

function extractTitle(messages: ChatMessage[]): string {
  // Use first user message as title
  const firstUser = messages.find(m => m.role === 'user');
  if (firstUser) {
    const title = firstUser.content.slice(0, 50);
    return title.length < firstUser.content.length ? title + '...' : title;
  }
  return 'Untitled Conversation';
}

/**
 * Generate mock cursor data for demo purposes
 */
export function generateMockCursorData(): ChatMessage[] {
  const mockConversations = [
    {
      user: "Create a 3D visualization component using Three.js",
      assistant: "I'll create a Three.js component for 3D visualization. Let me set up the scene, camera, and renderer...",
      files: ['/src/3d/scene.ts']
    },
    {
      user: "Add particle effects when files are created",
      assistant: "I'll implement a particle burst effect using THREE.Points. This will trigger when new buildings appear...",
      files: ['/src/3d/codeCity.ts']
    },
    {
      user: "Implement a timeline slider to navigate through commits",
      assistant: "I'll create a timeline component with a range slider that maps to project snapshots...",
      files: ['/src/main.ts', '/index.html']
    },
    {
      user: "Add chat bubbles that show AI conversations",
      assistant: "I'll create floating sprite-based chat bubbles that connect to related files with bezier curves...",
      files: ['/src/3d/chatBubbles.ts']
    },
    {
      user: "Implement video recording for the visualization",
      assistant: "I'll use the MediaRecorder API to capture the canvas and allow users to export timelapses...",
      files: ['/src/utils/videoRecorder.ts']
    }
  ];
  
  const chats: ChatMessage[] = [];
  const baseTime = Date.now() - 3600000; // 1 hour ago
  
  mockConversations.forEach((conv, convIndex) => {
    // User message
    chats.push({
      id: `mock-${convIndex * 2}`,
      timestamp: new Date(baseTime + convIndex * 600000),
      role: 'user',
      content: conv.user,
      relatedFiles: conv.files
    });
    
    // Assistant message
    chats.push({
      id: `mock-${convIndex * 2 + 1}`,
      timestamp: new Date(baseTime + convIndex * 600000 + 30000),
      role: 'assistant',
      content: conv.assistant,
      relatedFiles: conv.files
    });
  });
  
  return chats;
}
