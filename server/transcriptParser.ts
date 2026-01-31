import fs from 'fs';
import path from 'path';

/**
 * TRANSCRIPT PARSER
 * 
 * Parses Cursor agent transcript files (.txt) from:
 * ~/.cursor/projects/{project-name}/agent-transcripts/
 * 
 * Format:
 * user:
 * <user_query>...</user_query>
 * 
 * A:
 * [Thinking] ...
 * [Tool call] ...
 * [Tool result] ...
 */

export interface TranscriptMessage {
  id: string;
  timestamp: Date;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: ToolCall[];
  thinking?: string;
}

export interface ToolCall {
  name: string;
  args?: Record<string, unknown>;
}

export interface Transcript {
  id: string;
  filePath: string;
  messages: TranscriptMessage[];
  createdAt: Date;
  modifiedAt: Date;
}

/**
 * Find the Cursor projects folder for a given workspace path
 */
export function findCursorProjectsFolder(workspacePath: string): string | null {
  // Convert workspace path to Cursor folder name format
  // e.g., /mnt/private1/ai-projects/foo -> mnt-private1-ai-projects-foo
  const folderName = workspacePath.replace(/^\//, '').replace(/\//g, '-');
  const cursorFolder = path.join(
    process.env.HOME || '~',
    '.cursor',
    'projects',
    folderName
  );
  
  if (fs.existsSync(cursorFolder)) {
    return cursorFolder;
  }
  
  return null;
}

/**
 * Get all transcripts for a workspace
 */
export async function getTranscripts(workspacePath: string): Promise<Transcript[]> {
  const transcripts: Transcript[] = [];
  
  const cursorFolder = findCursorProjectsFolder(workspacePath);
  if (!cursorFolder) {
    console.log('[TranscriptParser] No Cursor folder found for:', workspacePath);
    return transcripts;
  }
  
  const transcriptsDir = path.join(cursorFolder, 'agent-transcripts');
  if (!fs.existsSync(transcriptsDir)) {
    console.log('[TranscriptParser] No agent-transcripts folder found');
    return transcripts;
  }
  
  const files = fs.readdirSync(transcriptsDir);
  console.log('[TranscriptParser] Found', files.length, 'transcript files');
  
  for (const file of files) {
    if (!file.endsWith('.txt')) continue;
    
    const filePath = path.join(transcriptsDir, file);
    const stats = fs.statSync(filePath);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const messages = parseTranscript(content, file);
      
      transcripts.push({
        id: file.replace('.txt', ''),
        filePath,
        messages,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      });
      
      console.log('[TranscriptParser] Parsed', file, 'with', messages.length, 'messages');
    } catch (error) {
      console.error('[TranscriptParser] Error parsing', file, error);
    }
  }
  
  // Sort by modification time (newest first)
  transcripts.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
  
  return transcripts;
}

/**
 * Parse a single transcript file
 */
function parseTranscript(content: string, filename: string): TranscriptMessage[] {
  const messages: TranscriptMessage[] = [];
  
  // Split into blocks by role markers
  const blocks = content.split(/(?=^user:|^A:)/gm);
  
  let msgIndex = 0;
  const baseTime = Date.now() - 3600000; // 1 hour ago as base
  
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith('user:')) {
      // User message
      const userContent = extractUserQuery(trimmed);
      if (userContent) {
        messages.push({
          id: `${filename}-user-${msgIndex}`,
          timestamp: new Date(baseTime + msgIndex * 60000), // Simulate timestamps
          role: 'user',
          content: userContent,
          toolCalls: [],
        });
        msgIndex++;
      }
    } else if (trimmed.startsWith('A:')) {
      // Assistant message
      const { content: assistantContent, thinking, toolCalls } = extractAssistantContent(trimmed);
      if (assistantContent || thinking) {
        messages.push({
          id: `${filename}-assistant-${msgIndex}`,
          timestamp: new Date(baseTime + msgIndex * 60000),
          role: 'assistant',
          content: assistantContent,
          toolCalls,
          thinking,
        });
        msgIndex++;
      }
    }
  }
  
  return messages;
}

/**
 * Extract user query from user block
 */
function extractUserQuery(block: string): string {
  const match = block.match(/<user_query>([\s\S]*?)<\/user_query>/);
  if (match) {
    return match[1].trim();
  }
  
  // Fallback: take everything after "user:"
  return block.replace(/^user:\s*/i, '').trim().slice(0, 1000);
}

/**
 * Extract assistant content, thinking, and tool calls
 */
function extractAssistantContent(block: string): {
  content: string;
  thinking?: string;
  toolCalls: ToolCall[];
} {
  let thinking: string | undefined;
  const toolCalls: ToolCall[] = [];
  
  // Extract thinking blocks
  const thinkingMatch = block.match(/\[Thinking\]([\s\S]*?)(?=\[Tool call\]|\[Tool result\]|$)/i);
  if (thinkingMatch) {
    thinking = thinkingMatch[1].trim().slice(0, 500);
  }
  
  // Extract tool calls
  const toolCallMatches = block.matchAll(/\[Tool call\]\s*(\w+)(?:\s+([^\[]+))?/gi);
  for (const match of toolCallMatches) {
    toolCalls.push({
      name: match[1],
      args: match[2] ? parseToolArgs(match[2]) : undefined,
    });
  }
  
  // Extract main content (text that's not thinking or tool calls)
  let content = block
    .replace(/^A:\s*/i, '')
    .replace(/\[Thinking\][\s\S]*?(?=\[Tool call\]|\[Tool result\]|[A-Z]|$)/gi, '')
    .replace(/\[Tool call\][\s\S]*?(?=\[Tool result\]|\[Tool call\]|$)/gi, '')
    .replace(/\[Tool result\][\s\S]*?(?=\[Tool call\]|A:|user:|$)/gi, '')
    .trim();
  
  // Take only the meaningful text (first paragraph or so)
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('['));
  content = lines.slice(0, 5).join(' ').trim().slice(0, 1000);
  
  return { content, thinking, toolCalls };
}

/**
 * Parse tool arguments (simple key: value format)
 */
function parseToolArgs(argsStr: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const lines = argsStr.trim().split('\n');
  
  for (const line of lines) {
    const match = line.match(/^\s*(\w+):\s*(.+)/);
    if (match) {
      args[match[1]] = match[2].trim();
    }
  }
  
  return args;
}

/**
 * Convert transcript messages to ChatMessage format
 */
export function transcriptsToChatMessages(transcripts: Transcript[]): {
  id: string;
  timestamp: Date;
  role: 'user' | 'assistant';
  content: string;
  relatedFiles: string[];
  model?: string;
  tokenCost?: number;
}[] {
  const messages: {
    id: string;
    timestamp: Date;
    role: 'user' | 'assistant';
    content: string;
    relatedFiles: string[];
    model?: string;
    tokenCost?: number;
  }[] = [];
  
  for (const transcript of transcripts) {
    for (const msg of transcript.messages) {
      // Extract file paths from content
      const relatedFiles = extractFilePaths(msg.content);
      
      // Estimate token cost (roughly 1 token per 4 characters)
      const tokenCost = Math.ceil(msg.content.length / 4);
      
      messages.push({
        id: msg.id,
        timestamp: msg.timestamp,
        role: msg.role,
        content: msg.content.slice(0, 500) + (msg.content.length > 500 ? '...' : ''),
        relatedFiles,
        model: 'claude-opus',
        tokenCost: msg.role === 'assistant' ? tokenCost : undefined,
      });
    }
  }
  
  // Sort by timestamp
  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  return messages;
}

/**
 * Extract file paths from content
 */
function extractFilePaths(content: string): string[] {
  const paths: string[] = [];
  
  // Match paths in backticks
  const backtickMatches = content.match(/`([^`]+\.[a-z]{1,10})`/gi);
  if (backtickMatches) {
    for (const match of backtickMatches) {
      const p = match.slice(1, -1);
      if (isLikelyPath(p)) paths.push(p);
    }
  }
  
  // Match @-prefixed paths
  const atMatches = content.match(/@([\w\-./]+\.[a-z]{1,10})/gi);
  if (atMatches) {
    for (const match of atMatches) {
      const p = match.slice(1);
      if (isLikelyPath(p)) paths.push(p);
    }
  }
  
  return [...new Set(paths)].slice(0, 10);
}

function isLikelyPath(str: string): boolean {
  const extensions = ['ts', 'tsx', 'js', 'jsx', 'css', 'html', 'json', 'md', 'py', 'go', 'rs'];
  const ext = str.split('.').pop()?.toLowerCase();
  return ext !== undefined && extensions.includes(ext) && str.length < 150;
}
