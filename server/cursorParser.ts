import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export interface CursorChat {
  id: string;
  timestamp: Date;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  relatedFiles: string[];
}

export interface CursorData {
  found: boolean;
  chats: CursorChat[];
  conversationCount: number;
}

export async function getCursorData(projectPath: string): Promise<CursorData> {
  const cursorDir = path.join(projectPath, '.cursor');
  
  if (!fs.existsSync(cursorDir)) {
    console.log('No .cursor directory found');
    return {
      found: false,
      chats: [],
      conversationCount: 0
    };
  }
  
  const chats: CursorChat[] = [];
  let conversationCount = 0;
  
  try {
    // Find all JSON files in .cursor directory
    const jsonFiles = await glob('**/*.json', {
      cwd: cursorDir,
      absolute: true,
    });
    
    for (const filePath of jsonFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        const parsed = parseDataFormat(data, filePath);
        if (parsed.length > 0) {
          chats.push(...parsed);
          conversationCount++;
        }
        
      } catch (e) {
        // Skip invalid JSON files
        console.debug(`Could not parse: ${filePath}`);
      }
    }
    
    // Also check for SQLite database (Cursor sometimes uses this)
    // For now, we'll skip SQLite parsing
    
    // Sort chats by timestamp
    chats.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    console.log(`Found ${chats.length} chat messages in ${conversationCount} conversations`);
    
    return {
      found: true,
      chats,
      conversationCount
    };
    
  } catch (error) {
    console.error('Error reading Cursor data:', error);
    return {
      found: false,
      chats: [],
      conversationCount: 0
    };
  }
}

function parseDataFormat(data: unknown, sourcePath: string): CursorChat[] {
  const chats: CursorChat[] = [];
  const conversationId = path.basename(sourcePath, '.json');
  
  // Format 1: Array of messages
  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      if (isValidMessage(item)) {
        chats.push(messageToChat(item, `${conversationId}-${index}`));
      }
    });
    return chats;
  }
  
  if (typeof data !== 'object' || data === null) {
    return chats;
  }
  
  const obj = data as Record<string, unknown>;
  
  // Format 2: Object with messages array
  if (Array.isArray(obj.messages)) {
    obj.messages.forEach((item: unknown, index: number) => {
      if (isValidMessage(item)) {
        chats.push(messageToChat(item, `${conversationId}-${index}`));
      }
    });
    return chats;
  }
  
  // Format 3: Object with history array
  if (Array.isArray(obj.history)) {
    obj.history.forEach((item: unknown, index: number) => {
      if (isValidMessage(item)) {
        chats.push(messageToChat(item, `${conversationId}-${index}`));
      }
    });
    return chats;
  }
  
  // Format 4: Object with conversations
  if (Array.isArray(obj.conversations)) {
    obj.conversations.forEach((conv: unknown, convIndex: number) => {
      if (typeof conv === 'object' && conv !== null) {
        const convObj = conv as Record<string, unknown>;
        if (Array.isArray(convObj.messages)) {
          convObj.messages.forEach((item: unknown, msgIndex: number) => {
            if (isValidMessage(item)) {
              chats.push(messageToChat(item, `${conversationId}-${convIndex}-${msgIndex}`));
            }
          });
        }
      }
    });
    return chats;
  }
  
  // Format 5: Object with tabs
  if (Array.isArray(obj.tabs)) {
    obj.tabs.forEach((tab: unknown, tabIndex: number) => {
      if (typeof tab === 'object' && tab !== null) {
        const tabObj = tab as Record<string, unknown>;
        if (Array.isArray(tabObj.messages)) {
          tabObj.messages.forEach((item: unknown, msgIndex: number) => {
            if (isValidMessage(item)) {
              chats.push(messageToChat(item, `${conversationId}-${tabIndex}-${msgIndex}`));
            }
          });
        }
      }
    });
  }
  
  return chats;
}

function isValidMessage(item: unknown): item is Record<string, unknown> {
  if (typeof item !== 'object' || item === null) return false;
  const msg = item as Record<string, unknown>;
  return (
    typeof msg.role === 'string' &&
    typeof msg.content === 'string' &&
    msg.content.length > 0
  );
}

function messageToChat(item: unknown, id: string): CursorChat {
  const msg = item as Record<string, unknown>;
  
  // Extract related files from content
  const content = String(msg.content);
  const relatedFiles = extractFilePaths(content);
  
  return {
    id,
    timestamp: new Date(msg.timestamp as number || msg.created_at as number || Date.now()),
    role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
    content: truncateContent(content),
    model: msg.model as string | undefined,
    relatedFiles
  };
}

function extractFilePaths(content: string): string[] {
  const paths: string[] = [];
  
  // Match paths in backticks
  const backtickMatches = content.match(/`([^`]+\.[a-z]{1,10})`/gi);
  if (backtickMatches) {
    for (const match of backtickMatches) {
      const p = match.slice(1, -1);
      if (isLikelyPath(p)) paths.push(normalizePath(p));
    }
  }
  
  // Match direct file references
  const directMatches = content.match(/(?:^|\s)((?:\.\/|\/|src\/|lib\/)?[\w\-./]+\.[a-z]{1,10})(?:\s|$|[,.:;])/gim);
  if (directMatches) {
    for (const match of directMatches) {
      const p = match.trim().replace(/[,.:;]$/, '');
      if (isLikelyPath(p)) paths.push(normalizePath(p));
    }
  }
  
  return [...new Set(paths)];
}

function isLikelyPath(str: string): boolean {
  const extensions = [
    'ts', 'tsx', 'js', 'jsx', 'mjs',
    'css', 'scss', 'html', 'vue', 'svelte',
    'json', 'yaml', 'yml', 'md',
    'py', 'rb', 'go', 'rs', 'java',
  ];
  
  const ext = str.split('.').pop()?.toLowerCase();
  if (!ext || !extensions.includes(ext)) return false;
  if (str.length > 150) return false;
  if (/[<>"|?*]/.test(str)) return false;
  
  return true;
}

function normalizePath(p: string): string {
  if (!p.startsWith('/') && !p.startsWith('./')) {
    p = '/' + p;
  }
  return p.replace(/^\.\//, '/');
}

function truncateContent(content: string, maxLen: number = 500): string {
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen) + '...';
}
