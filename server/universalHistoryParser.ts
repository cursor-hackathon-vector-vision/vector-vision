import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import Database from 'better-sqlite3';

/**
 * UNIVERSAL HISTORY PARSER
 * 
 * Supports multiple data sources:
 * - Cursor Agent Transcripts (.txt)
 * - Cursor AI Tracking DB (SQLite)
 * - Cursor .cursor/ JSON files (multiple formats)
 * - [BACKLOG] Antigravity project logs
 * - [BACKLOG] Claude Code project logs
 */

export interface HistoryMessage {
  id: string;
  timestamp: Date;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  source: 'cursor-transcript' | 'cursor-db' | 'cursor-json' | 'antigravity' | 'claude-code';
  projectPath?: string;
  conversationId?: string;
  model?: string;
  toolCalls?: ToolCall[];
  relatedFiles: string[];
}

export interface ToolCall {
  name: string;
  arguments?: Record<string, unknown>;
  result?: string;
}

export interface HistoryData {
  messages: HistoryMessage[];
  conversations: Conversation[];
  totalMessages: number;
  sources: string[];
  dateRange: { start: Date; end: Date } | null;
}

export interface Conversation {
  id: string;
  title: string;
  messageCount: number;
  startTime: Date;
  endTime: Date;
  source: string;
}

// Get home directory
const HOME = process.env.HOME || '/home/user';
const CURSOR_DIR = path.join(HOME, '.cursor');
const CURSOR_PROJECTS = path.join(CURSOR_DIR, 'projects');
const CURSOR_AI_DB = path.join(CURSOR_DIR, 'ai-tracking', 'ai-code-tracking.db');

/**
 * Main entry point - parses all available history for a project
 */
export async function getUniversalHistory(projectPath: string): Promise<HistoryData> {
  const messages: HistoryMessage[] = [];
  const conversations: Conversation[] = [];
  const sources: string[] = [];
  
  // 1. Parse Cursor Agent Transcripts
  const transcriptData = await parseCursorTranscripts(projectPath);
  if (transcriptData.messages.length > 0) {
    messages.push(...transcriptData.messages);
    conversations.push(...transcriptData.conversations);
    sources.push('cursor-transcript');
  }
  
  // 2. Parse Cursor AI Tracking DB
  const dbData = await parseCursorAIDatabase(projectPath);
  if (dbData.messages.length > 0) {
    messages.push(...dbData.messages);
    conversations.push(...dbData.conversations);
    if (!sources.includes('cursor-db')) sources.push('cursor-db');
  }
  
  // 3. Parse .cursor/ JSON files in project
  const jsonData = await parseCursorJsonFiles(projectPath);
  if (jsonData.messages.length > 0) {
    messages.push(...jsonData.messages);
    conversations.push(...jsonData.conversations);
    if (!sources.includes('cursor-json')) sources.push('cursor-json');
  }
  
  // Sort all messages by timestamp
  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  // Calculate date range
  let dateRange: { start: Date; end: Date } | null = null;
  if (messages.length > 0) {
    dateRange = {
      start: messages[0].timestamp,
      end: messages[messages.length - 1].timestamp
    };
  }
  
  console.log(`Universal Parser: Found ${messages.length} messages from ${sources.join(', ')}`);
  
  return {
    messages,
    conversations,
    totalMessages: messages.length,
    sources,
    dateRange
  };
}

/**
 * Parse Cursor Agent Transcripts (.txt files)
 */
async function parseCursorTranscripts(projectPath: string): Promise<{ messages: HistoryMessage[]; conversations: Conversation[] }> {
  const messages: HistoryMessage[] = [];
  const conversations: Conversation[] = [];
  
  // Convert project path to cursor project folder name
  const projectFolderName = projectPath.replace(/\//g, '-').replace(/^-/, '');
  const transcriptsDir = path.join(CURSOR_PROJECTS, projectFolderName, 'agent-transcripts');
  
  if (!fs.existsSync(transcriptsDir)) {
    // Try alternate naming
    const altNames = await findMatchingProjectDir(projectPath);
    if (altNames.length === 0) {
      console.log(`No transcripts directory found for: ${projectPath}`);
      return { messages, conversations };
    }
    
    for (const altDir of altNames) {
      const altTranscripts = path.join(altDir, 'agent-transcripts');
      if (fs.existsSync(altTranscripts)) {
        const result = await parseTranscriptsDir(altTranscripts);
        messages.push(...result.messages);
        conversations.push(...result.conversations);
      }
    }
    return { messages, conversations };
  }
  
  return parseTranscriptsDir(transcriptsDir);
}

async function findMatchingProjectDir(projectPath: string): Promise<string[]> {
  const matches: string[] = [];
  
  if (!fs.existsSync(CURSOR_PROJECTS)) return matches;
  
  const dirs = fs.readdirSync(CURSOR_PROJECTS);
  const pathParts = projectPath.split('/').filter(p => p.length > 0);
  
  for (const dir of dirs) {
    // Check if directory contains path parts
    const dirLower = dir.toLowerCase();
    const lastParts = pathParts.slice(-2).join('-').toLowerCase();
    
    if (dirLower.includes(lastParts) || pathParts.some(p => dirLower.includes(p.toLowerCase()))) {
      matches.push(path.join(CURSOR_PROJECTS, dir));
    }
  }
  
  return matches;
}

async function parseTranscriptsDir(transcriptsDir: string): Promise<{ messages: HistoryMessage[]; conversations: Conversation[] }> {
  const messages: HistoryMessage[] = [];
  const conversations: Conversation[] = [];
  
  const files = fs.readdirSync(transcriptsDir).filter(f => f.endsWith('.txt'));
  
  for (const file of files) {
    const filePath = path.join(transcriptsDir, file);
    const conversationId = path.basename(file, '.txt');
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseTranscriptContent(content, conversationId);
      
      if (parsed.length > 0) {
        messages.push(...parsed);
        
        conversations.push({
          id: conversationId,
          title: extractConversationTitle(parsed),
          messageCount: parsed.length,
          startTime: parsed[0].timestamp,
          endTime: parsed[parsed.length - 1].timestamp,
          source: 'cursor-transcript'
        });
      }
    } catch (e) {
      console.debug(`Could not parse transcript: ${file}`, e);
    }
  }
  
  return { messages, conversations };
}

function parseTranscriptContent(content: string, conversationId: string): HistoryMessage[] {
  const messages: HistoryMessage[] = [];
  
  // Split by role markers
  const sections = content.split(/^(user:|assistant:|A:|tool:|\[Tool call\]|\[Tool result\]|\[Thinking\])/m);
  
  let currentRole: 'user' | 'assistant' | 'tool' | 'system' = 'user';
  let messageIndex = 0;
  let lastTimestamp = new Date();
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    
    if (!section) continue;
    
    // Detect role markers
    if (section === 'user:') {
      currentRole = 'user';
      continue;
    } else if (section === 'assistant:' || section === 'A:') {
      currentRole = 'assistant';
      continue;
    } else if (section === 'tool:' || section === '[Tool call]' || section === '[Tool result]') {
      currentRole = 'tool';
      continue;
    } else if (section === '[Thinking]') {
      // Skip thinking blocks but note they exist
      continue;
    }
    
    // Parse content
    if (section.length > 10) {
      const relatedFiles = extractFilePaths(section);
      
      // Try to extract timestamp from content
      const timestampMatch = section.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
      if (timestampMatch) {
        lastTimestamp = new Date(timestampMatch[1]);
      } else {
        // Increment by 1 second for ordering
        lastTimestamp = new Date(lastTimestamp.getTime() + 1000);
      }
      
      messages.push({
        id: `${conversationId}-${messageIndex++}`,
        timestamp: lastTimestamp,
        role: currentRole,
        content: truncateContent(section),
        source: 'cursor-transcript',
        conversationId,
        relatedFiles
      });
    }
  }
  
  return messages;
}

/**
 * Parse Cursor AI Tracking SQLite Database
 */
async function parseCursorAIDatabase(projectPath: string): Promise<{ messages: HistoryMessage[]; conversations: Conversation[] }> {
  const messages: HistoryMessage[] = [];
  const conversations: Conversation[] = [];
  
  if (!fs.existsSync(CURSOR_AI_DB)) {
    console.log('Cursor AI DB not found');
    return { messages, conversations };
  }
  
  try {
    const db = new Database(CURSOR_AI_DB, { readonly: true });
    
    // Check available tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map(t => t.name);
    
    console.log('DB Tables:', tableNames);
    
    // Parse conversation_summaries if exists
    if (tableNames.includes('conversation_summaries')) {
      const rows = db.prepare(`
        SELECT * FROM conversation_summaries 
        ORDER BY rowid DESC 
        LIMIT 100
      `).all() as Record<string, unknown>[];
      
      for (const row of rows) {
        if (row.summary && typeof row.summary === 'string') {
          messages.push({
            id: `db-summary-${row.rowid || messages.length}`,
            timestamp: new Date(row.timestamp as number || Date.now()),
            role: 'assistant',
            content: row.summary as string,
            source: 'cursor-db',
            conversationId: row.conversation_id as string,
            relatedFiles: []
          });
        }
      }
    }
    
    // Parse scored_commits if exists
    if (tableNames.includes('scored_commits')) {
      const commits = db.prepare(`
        SELECT * FROM scored_commits 
        WHERE workspace_path LIKE ?
        ORDER BY timestamp DESC 
        LIMIT 50
      `).all(`%${path.basename(projectPath)}%`) as Record<string, unknown>[];
      
      for (const commit of commits) {
        messages.push({
          id: `db-commit-${commit.rowid || messages.length}`,
          timestamp: new Date(commit.timestamp as number || Date.now()),
          role: 'system',
          content: `Commit: ${commit.commit_message || 'No message'} (Score: ${commit.score || 'N/A'})`,
          source: 'cursor-db',
          relatedFiles: []
        });
      }
    }
    
    db.close();
  } catch (e) {
    console.error('Error parsing Cursor AI DB:', e);
  }
  
  return { messages, conversations };
}

/**
 * Parse .cursor/ JSON files in project directory
 */
async function parseCursorJsonFiles(projectPath: string): Promise<{ messages: HistoryMessage[]; conversations: Conversation[] }> {
  const messages: HistoryMessage[] = [];
  const conversations: Conversation[] = [];
  
  const cursorDir = path.join(projectPath, '.cursor');
  
  if (!fs.existsSync(cursorDir)) {
    return { messages, conversations };
  }
  
  try {
    const jsonFiles = await glob('**/*.json', {
      cwd: cursorDir,
      absolute: true,
      ignore: ['**/node_modules/**', '**/mcp.json']
    });
    
    for (const filePath of jsonFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        const conversationId = path.basename(filePath, '.json');
        
        const parsed = parseJsonData(data, conversationId);
        if (parsed.length > 0) {
          messages.push(...parsed);
          
          conversations.push({
            id: conversationId,
            title: extractConversationTitle(parsed),
            messageCount: parsed.length,
            startTime: parsed[0].timestamp,
            endTime: parsed[parsed.length - 1].timestamp,
            source: 'cursor-json'
          });
        }
      } catch (e) {
        console.debug(`Could not parse JSON: ${filePath}`);
      }
    }
  } catch (e) {
    console.error('Error parsing .cursor JSON:', e);
  }
  
  return { messages, conversations };
}

function parseJsonData(data: unknown, conversationId: string): HistoryMessage[] {
  const messages: HistoryMessage[] = [];
  
  // Handle various JSON formats
  const messageSources = extractMessageArrays(data);
  
  for (const [sourceKey, msgArray] of messageSources) {
    msgArray.forEach((msg, index) => {
      if (isValidMessage(msg)) {
        messages.push({
          id: `${conversationId}-${sourceKey}-${index}`,
          timestamp: extractTimestamp(msg),
          role: normalizeRole(msg.role),
          content: truncateContent(String(msg.content)),
          source: 'cursor-json',
          conversationId,
          model: msg.model as string | undefined,
          relatedFiles: extractFilePaths(String(msg.content))
        });
      }
    });
  }
  
  return messages;
}

function extractMessageArrays(data: unknown): [string, unknown[]][] {
  const results: [string, unknown[]][] = [];
  
  if (Array.isArray(data)) {
    results.push(['root', data]);
    return results;
  }
  
  if (typeof data !== 'object' || data === null) {
    return results;
  }
  
  const obj = data as Record<string, unknown>;
  
  // Common keys that contain message arrays
  const messageKeys = [
    'messages', 'history', 'conversations', 'tabs', 'chats',
    'chat_history', 'chatHistory', 'data', 'items', 'entries',
    'bubbles', 'exchanges', 'turns'
  ];
  
  for (const key of messageKeys) {
    if (Array.isArray(obj[key])) {
      results.push([key, obj[key] as unknown[]]);
    }
  }
  
  // Recursively check nested objects
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nested = extractMessageArrays(value);
      for (const [nestedKey, arr] of nested) {
        results.push([`${key}.${nestedKey}`, arr]);
      }
    }
    
    // Handle array of conversations/tabs
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      value.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          const nested = extractMessageArrays(item);
          for (const [nestedKey, arr] of nested) {
            results.push([`${key}[${idx}].${nestedKey}`, arr]);
          }
        }
      });
    }
  }
  
  return results;
}

function isValidMessage(item: unknown): item is Record<string, unknown> {
  if (typeof item !== 'object' || item === null) return false;
  const msg = item as Record<string, unknown>;
  
  // Must have role and content
  const hasRole = typeof msg.role === 'string' || 
                  typeof msg.type === 'string' ||
                  typeof msg.author === 'string' ||
                  typeof msg.sender === 'string';
                  
  const hasContent = typeof msg.content === 'string' ||
                     typeof msg.text === 'string' ||
                     typeof msg.message === 'string' ||
                     typeof msg.body === 'string';
  
  return hasRole || hasContent;
}

function normalizeRole(role: unknown): 'user' | 'assistant' | 'system' | 'tool' {
  const roleStr = String(role).toLowerCase();
  
  if (['user', 'human', 'customer', 'you'].includes(roleStr)) return 'user';
  if (['assistant', 'ai', 'bot', 'claude', 'gpt', 'model'].includes(roleStr)) return 'assistant';
  if (['system', 'context'].includes(roleStr)) return 'system';
  if (['tool', 'function', 'action'].includes(roleStr)) return 'tool';
  
  return 'user';
}

function extractTimestamp(msg: Record<string, unknown>): Date {
  const timestampKeys = ['timestamp', 'created_at', 'createdAt', 'time', 'date', 'ts'];
  
  for (const key of timestampKeys) {
    const val = msg[key];
    if (typeof val === 'number') {
      // Handle both seconds and milliseconds
      return new Date(val > 1e12 ? val : val * 1000);
    }
    if (typeof val === 'string') {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  
  return new Date();
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
  
  // Match @mentions of files
  const atMatches = content.match(/@([\w\-./]+\.[a-z]{1,10})/gi);
  if (atMatches) {
    for (const match of atMatches) {
      const p = match.slice(1);
      if (isLikelyPath(p)) paths.push(normalizePath(p));
    }
  }
  
  // Match file paths with extensions
  const directMatches = content.match(/(?:^|\s|["'])((?:\.\/|\/|src\/|lib\/|app\/)?[\w\-./]+\.[a-z]{1,10})(?:\s|$|[,.:;)"'])/gim);
  if (directMatches) {
    for (const match of directMatches) {
      const p = match.trim().replace(/^["']|["']$/g, '').replace(/[,.:;]$/, '');
      if (isLikelyPath(p)) paths.push(normalizePath(p));
    }
  }
  
  return [...new Set(paths)];
}

function isLikelyPath(str: string): boolean {
  const extensions = [
    'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
    'css', 'scss', 'sass', 'less', 'html', 'vue', 'svelte',
    'json', 'yaml', 'yml', 'toml', 'md', 'mdx',
    'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift',
    'sh', 'bash', 'zsh', 'sql', 'graphql'
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

function truncateContent(content: string, maxLen: number = 1000): string {
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen) + '...';
}

function extractConversationTitle(messages: HistoryMessage[]): string {
  // Find first user message and use as title
  const firstUser = messages.find(m => m.role === 'user');
  if (firstUser) {
    const content = firstUser.content.slice(0, 80);
    return content.replace(/\n/g, ' ').trim() + (firstUser.content.length > 80 ? '...' : '');
  }
  return 'Conversation';
}

// ============================================================
// BACKLOG: Future adapters for other sources
// ============================================================

/**
 * [BACKLOG] Parse Antigravity project logs
 * Antigravity uses a different format with sessions and actions
 */
export async function parseAntigravityLogs(_projectPath: string): Promise<HistoryData> {
  // TODO: Implement when format is documented
  console.log('Antigravity parser not yet implemented');
  return {
    messages: [],
    conversations: [],
    totalMessages: 0,
    sources: [],
    dateRange: null
  };
}

/**
 * [BACKLOG] Parse Claude Code project logs
 * Claude Code stores conversations in a specific format
 */
export async function parseClaudeCodeLogs(_projectPath: string): Promise<HistoryData> {
  // TODO: Implement when format is documented
  console.log('Claude Code parser not yet implemented');
  return {
    messages: [],
    conversations: [],
    totalMessages: 0,
    sources: [],
    dateRange: null
  };
}

// Export for testing
export const __testing = {
  parseTranscriptContent,
  parseJsonData,
  extractMessageArrays,
  isValidMessage,
  normalizeRole,
  extractFilePaths
};
