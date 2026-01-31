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
 * Tries the exact path first, then parent directories
 */
export function findCursorProjectsFolder(workspacePath: string): string | null {
  const homeDir = process.env.HOME || '/home/' + process.env.USER || '~';
  const cursorProjectsBase = path.join(homeDir, '.cursor', 'projects');
  
  // Try the exact path and parent paths
  let currentPath = workspacePath;
  const triedPaths: string[] = [];
  
  for (let i = 0; i < 5; i++) {
    // Convert workspace path to Cursor folder name format
    // e.g., /mnt/private1/ai-projects/foo -> mnt-private1-ai-projects-foo
    const folderName = currentPath.replace(/^\//, '').replace(/\//g, '-');
    const cursorFolder = path.join(cursorProjectsBase, folderName);
    triedPaths.push(cursorFolder);
    
    if (fs.existsSync(cursorFolder)) {
      console.log('[TranscriptParser] Found Cursor folder:', cursorFolder);
      return cursorFolder;
    }
    
    // Try parent directory
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) break; // Reached root
    currentPath = parentPath;
  }
  
  console.log('[TranscriptParser] Tried paths:', triedPaths);
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
 * IMPROVED: Better extraction of actual visible assistant text
 */
function extractAssistantContent(block: string): {
  content: string;
  thinking?: string;
  toolCalls: ToolCall[];
} {
  let thinking: string | undefined;
  const toolCalls: ToolCall[] = [];
  
  // Extract thinking blocks (between [Thinking] and next bracket or end of section)
  const thinkingMatch = block.match(/\[Thinking\]([\s\S]*?)(?=\[Tool call\]|\[Tool result\]|\n[A-Z]|$)/i);
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
  
  // IMPROVED: Extract the VISIBLE assistant text
  // This is the text that appears AFTER tool results, not in brackets
  let content = '';
  
  // Split by newlines and find lines that are NOT tool-related
  const lines = block.split('\n');
  const contentLines: string[] = [];
  let inToolSection = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip header and tool markers
    if (trimmed.startsWith('A:')) continue;
    if (trimmed.startsWith('[Thinking]')) { inToolSection = true; continue; }
    if (trimmed.startsWith('[Tool call]')) { inToolSection = true; continue; }
    if (trimmed.startsWith('[Tool result]')) { inToolSection = true; continue; }
    
    // End of tool section when we see actual content (not empty, not starting with bracket)
    if (inToolSection && trimmed && !trimmed.startsWith('[')) {
      inToolSection = false;
    }
    
    // Collect non-tool content
    if (!inToolSection && trimmed && !trimmed.startsWith('[')) {
      contentLines.push(trimmed);
    }
  }
  
  // Join the actual visible content
  content = contentLines.slice(0, 10).join(' ').trim().slice(0, 1000);
  
  // Fallback: if no content found, use first non-empty line after A:
  if (!content) {
    const firstLine = block.replace(/^A:\s*/i, '').split('\n').find(l => 
      l.trim() && !l.trim().startsWith('[')
    );
    content = firstLine?.trim().slice(0, 1000) || '[Tool operations]';
  }
  
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
