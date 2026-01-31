import path from 'path';
import fs from 'fs';
import { glob } from 'glob';
import { getGitHistory, type GitCommit } from './gitParser';
import { getUniversalHistory, type HistoryMessage } from './universalHistoryParser';

/**
 * UNIFIED TIMELINE
 * 
 * Normalisiert und merged ALLE Datenquellen in eine einzige Timeline:
 * - Git Commits
 * - Cursor Messages (Transcripts + DB)
 * - Claude Code Activity (TODO)
 * - Antigravity Logs (TODO)
 * - File Timestamps (created/modified)
 */

// ============================================================
// TYPES
// ============================================================

export type TimelineEventType = 
  | 'git-commit'
  | 'cursor-user'
  | 'cursor-assistant'
  | 'cursor-tool'
  | 'claude-code'
  | 'antigravity'
  | 'file-created'
  | 'file-modified'
  | 'command';

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: TimelineEventType;
  source: string;           // e.g. 'git', 'cursor-transcript', 'claude', 'filesystem'
  
  // Content
  title: string;            // Short title for display
  content: string;          // Full content/message
  
  // Related files
  files: string[];          // Affected file paths
  
  // Metadata (type-specific)
  meta: {
    // Git
    commitHash?: string;
    author?: string;
    branch?: string;
    additions?: number;
    deletions?: number;
    
    // Cursor/Claude
    model?: string;
    tokenCost?: number;
    toolCalls?: string[];
    conversationId?: string;
    
    // File
    fileSize?: number;
    lineCount?: number;
  };
  
  // For visualization
  lane: 'user' | 'ai' | 'git' | 'system';
  color: number;
}

export interface UnifiedTimeline {
  events: TimelineEvent[];
  sources: string[];
  dateRange: { start: Date; end: Date } | null;
  stats: {
    totalEvents: number;
    byType: Record<TimelineEventType, number>;
    bySource: Record<string, number>;
  };
}

// ============================================================
// COLORS
// ============================================================

const EVENT_COLORS: Record<TimelineEventType, number> = {
  'git-commit': 0xf97316,      // Orange
  'cursor-user': 0x3b82f6,     // Blue
  'cursor-assistant': 0x22c55e, // Green
  'cursor-tool': 0x8b5cf6,     // Purple
  'claude-code': 0xec4899,     // Pink
  'antigravity': 0xeab308,     // Yellow
  'file-created': 0x06b6d4,    // Cyan
  'file-modified': 0x64748b,   // Slate
  'command': 0xf43f5e,         // Red
};

const EVENT_LANES: Record<TimelineEventType, TimelineEvent['lane']> = {
  'git-commit': 'git',
  'cursor-user': 'user',
  'cursor-assistant': 'ai',
  'cursor-tool': 'ai',
  'claude-code': 'ai',
  'antigravity': 'system',
  'file-created': 'system',
  'file-modified': 'system',
  'command': 'user',
};

// ============================================================
// MAIN FUNCTION
// ============================================================

/**
 * Erstellt eine unified Timeline aus allen verfügbaren Quellen
 */
export async function getUnifiedTimeline(projectPath: string): Promise<UnifiedTimeline> {
  const events: TimelineEvent[] = [];
  const sources: string[] = [];
  
  console.log('[UnifiedTimeline] Parsing all sources for:', projectPath);
  
  // 1️⃣ GIT COMMITS
  const gitEvents = await parseGitCommits(projectPath);
  if (gitEvents.length > 0) {
    events.push(...gitEvents);
    sources.push('git');
    console.log(`[UnifiedTimeline] Git: ${gitEvents.length} commits`);
  }
  
  // 2️⃣ CURSOR MESSAGES (Transcripts + DB)
  const cursorEvents = await parseCursorMessages(projectPath);
  if (cursorEvents.length > 0) {
    events.push(...cursorEvents);
    if (!sources.includes('cursor')) sources.push('cursor');
    console.log(`[UnifiedTimeline] Cursor: ${cursorEvents.length} messages`);
  }
  
  // 3️⃣ CLAUDE CODE ACTIVITY
  const claudeEvents = await parseClaudeCodeActivity(projectPath);
  if (claudeEvents.length > 0) {
    events.push(...claudeEvents);
    sources.push('claude-code');
    console.log(`[UnifiedTimeline] Claude Code: ${claudeEvents.length} events`);
  }
  
  // 4️⃣ ANTIGRAVITY LOGS
  const antigravityEvents = await parseAntigravityLogs(projectPath);
  if (antigravityEvents.length > 0) {
    events.push(...antigravityEvents);
    sources.push('antigravity');
    console.log(`[UnifiedTimeline] Antigravity: ${antigravityEvents.length} events`);
  }
  
  // 5️⃣ FILE TIMESTAMPS
  const fileEvents = await parseFileTimestamps(projectPath);
  if (fileEvents.length > 0) {
    events.push(...fileEvents);
    sources.push('filesystem');
    console.log(`[UnifiedTimeline] Files: ${fileEvents.length} events`);
  }
  
  // Sort by timestamp
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  // Assign sequential IDs
  events.forEach((e, i) => {
    e.id = `event-${i}`;
  });
  
  // Calculate stats
  const stats = calculateStats(events);
  
  // Date range
  let dateRange: { start: Date; end: Date } | null = null;
  if (events.length > 0) {
    dateRange = {
      start: events[0].timestamp,
      end: events[events.length - 1].timestamp,
    };
  }
  
  console.log(`[UnifiedTimeline] Total: ${events.length} events from ${sources.length} sources`);
  
  return { events, sources, dateRange, stats };
}

// ============================================================
// PARSERS
// ============================================================

/**
 * Parse Git commits into timeline events
 */
async function parseGitCommits(projectPath: string): Promise<TimelineEvent[]> {
  try {
    const gitHistory = await getGitHistory(projectPath, 200);
    
    if (!gitHistory.isGitRepo) return [];
    
    return gitHistory.commits.map((commit): TimelineEvent => ({
      id: `git-${commit.shortHash}`,
      timestamp: commit.date,
      type: 'git-commit',
      source: 'git',
      title: commit.message.split('\n')[0].slice(0, 60),
      content: commit.message,
      files: commit.files.map(f => f.path),
      meta: {
        commitHash: commit.hash,
        author: commit.author,
        branch: gitHistory.branch,
        additions: commit.files.reduce((sum, f) => sum + (f.additions || 0), 0),
        deletions: commit.files.reduce((sum, f) => sum + (f.deletions || 0), 0),
      },
      lane: 'git',
      color: EVENT_COLORS['git-commit'],
    }));
  } catch (error) {
    console.error('[UnifiedTimeline] Git parsing error:', error);
    return [];
  }
}

/**
 * Parse Cursor messages (transcripts + DB) into timeline events
 */
async function parseCursorMessages(projectPath: string): Promise<TimelineEvent[]> {
  try {
    const history = await getUniversalHistory(projectPath);
    
    return history.messages.map((msg): TimelineEvent => {
      const type: TimelineEventType = 
        msg.role === 'user' ? 'cursor-user' :
        msg.role === 'assistant' ? 'cursor-assistant' :
        msg.role === 'tool' ? 'cursor-tool' : 'cursor-assistant';
      
      return {
        id: msg.id,
        timestamp: msg.timestamp,
        type,
        source: msg.source,
        title: msg.content.slice(0, 60) + (msg.content.length > 60 ? '...' : ''),
        content: msg.content,
        files: msg.relatedFiles || [],
        meta: {
          model: msg.model,
          toolCalls: msg.toolCalls?.map(t => t.name) || [],
          conversationId: msg.conversationId,
        },
        lane: EVENT_LANES[type],
        color: EVENT_COLORS[type],
      };
    });
  } catch (error) {
    console.error('[UnifiedTimeline] Cursor parsing error:', error);
    return [];
  }
}

/**
 * Parse Claude Code activity (CLAUDE.md, .claude/ folder)
 */
async function parseClaudeCodeActivity(projectPath: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  
  try {
    // Check for CLAUDE.md
    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
    if (fs.existsSync(claudeMdPath)) {
      const stats = fs.statSync(claudeMdPath);
      events.push({
        id: `claude-md-${stats.mtimeMs}`,
        timestamp: stats.mtime,
        type: 'claude-code',
        source: 'claude-code',
        title: 'CLAUDE.md updated',
        content: 'Claude Code configuration file updated',
        files: ['/CLAUDE.md'],
        meta: {},
        lane: 'ai',
        color: EVENT_COLORS['claude-code'],
      });
    }
    
    // Check for .claude/ folder
    const claudeDir = path.join(projectPath, '.claude');
    if (fs.existsSync(claudeDir)) {
      const files = await glob('**/*.{json,md,txt}', { cwd: claudeDir });
      
      for (const file of files) {
        const filePath = path.join(claudeDir, file);
        const stats = fs.statSync(filePath);
        
        // Try to parse JSON files for more info
        let content = `Claude Code file: ${file}`;
        if (file.endsWith('.json')) {
          try {
            const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (json.messages) {
              // This is a conversation file
              for (const msg of json.messages) {
                const timestamp = msg.timestamp ? new Date(msg.timestamp) : stats.mtime;
                events.push({
                  id: `claude-${file}-${msg.id || events.length}`,
                  timestamp,
                  type: 'claude-code',
                  source: 'claude-code',
                  title: msg.role === 'user' ? 'User → Claude' : 'Claude response',
                  content: typeof msg.content === 'string' ? msg.content.slice(0, 500) : JSON.stringify(msg.content).slice(0, 500),
                  files: [],
                  meta: { model: json.model },
                  lane: msg.role === 'user' ? 'user' : 'ai',
                  color: EVENT_COLORS['claude-code'],
                });
              }
              continue; // Skip the file-level event
            }
          } catch {}
        }
        
        events.push({
          id: `claude-${file}-${stats.mtimeMs}`,
          timestamp: stats.mtime,
          type: 'claude-code',
          source: 'claude-code',
          title: `Claude: ${file}`,
          content,
          files: [`/.claude/${file}`],
          meta: {},
          lane: 'ai',
          color: EVENT_COLORS['claude-code'],
        });
      }
    }
  } catch (error) {
    console.error('[UnifiedTimeline] Claude Code parsing error:', error);
  }
  
  return events;
}

/**
 * Parse Antigravity logs
 */
async function parseAntigravityLogs(projectPath: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  
  try {
    // Check for antigravity-related files
    const antigravityPatterns = [
      '.antigravity/**/*.{json,log,txt}',
      'antigravity.log',
      '.ag/**/*.{json,log}',
    ];
    
    for (const pattern of antigravityPatterns) {
      const files = await glob(pattern, { cwd: projectPath });
      
      for (const file of files) {
        const filePath = path.join(projectPath, file);
        const stats = fs.statSync(filePath);
        
        // Try to parse log files
        if (file.endsWith('.log') || file.endsWith('.txt')) {
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').filter(l => l.trim());
            
            // Parse log entries (assuming format: [timestamp] message)
            const logPattern = /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\]]*)\]?\s*(.+)$/;
            
            for (const line of lines) {
              const match = line.match(logPattern);
              if (match) {
                events.push({
                  id: `ag-${events.length}`,
                  timestamp: new Date(match[1]),
                  type: 'antigravity',
                  source: 'antigravity',
                  title: match[2].slice(0, 60),
                  content: match[2],
                  files: [],
                  meta: {},
                  lane: 'system',
                  color: EVENT_COLORS['antigravity'],
                });
              }
            }
          } catch {}
        }
        
        // JSON logs
        if (file.endsWith('.json')) {
          try {
            const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (Array.isArray(json)) {
              for (const entry of json) {
                if (entry.timestamp && entry.message) {
                  events.push({
                    id: `ag-${events.length}`,
                    timestamp: new Date(entry.timestamp),
                    type: 'antigravity',
                    source: 'antigravity',
                    title: entry.message.slice(0, 60),
                    content: entry.message,
                    files: entry.files || [],
                    meta: entry.meta || {},
                    lane: 'system',
                    color: EVENT_COLORS['antigravity'],
                  });
                }
              }
            }
          } catch {}
        }
      }
    }
  } catch (error) {
    console.error('[UnifiedTimeline] Antigravity parsing error:', error);
  }
  
  return events;
}

/**
 * Parse file timestamps (created/modified)
 */
async function parseFileTimestamps(projectPath: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  
  try {
    // Get all source files
    const patterns = [
      '**/*.{ts,tsx,js,jsx,py,rs,go,java,c,cpp,h,hpp}',
      '**/*.{json,yaml,yml,toml,xml}',
      '**/*.{md,txt,rst}',
      '**/*.{css,scss,less,html}',
    ];
    
    const ignorePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/venv/**',
      '**/__pycache__/**',
    ];
    
    for (const pattern of patterns) {
      const files = await glob(pattern, { 
        cwd: projectPath,
        ignore: ignorePatterns,
      });
      
      for (const file of files.slice(0, 200)) { // Limit to avoid too many events
        try {
          const filePath = path.join(projectPath, file);
          const stats = fs.statSync(filePath);
          
          // Created event (if birthtime is available and different from mtime)
          if (stats.birthtime && stats.birthtime.getTime() !== stats.mtime.getTime()) {
            events.push({
              id: `file-create-${file}-${stats.birthtimeMs}`,
              timestamp: stats.birthtime,
              type: 'file-created',
              source: 'filesystem',
              title: `Created: ${path.basename(file)}`,
              content: `File created: ${file}`,
              files: ['/' + file],
              meta: {
                fileSize: stats.size,
              },
              lane: 'system',
              color: EVENT_COLORS['file-created'],
            });
          }
          
          // Modified event
          events.push({
            id: `file-modify-${file}-${stats.mtimeMs}`,
            timestamp: stats.mtime,
            type: 'file-modified',
            source: 'filesystem',
            title: `Modified: ${path.basename(file)}`,
            content: `File modified: ${file}`,
            files: ['/' + file],
            meta: {
              fileSize: stats.size,
            },
            lane: 'system',
            color: EVENT_COLORS['file-modified'],
          });
        } catch {}
      }
    }
  } catch (error) {
    console.error('[UnifiedTimeline] File parsing error:', error);
  }
  
  return events;
}

// ============================================================
// HELPERS
// ============================================================

function calculateStats(events: TimelineEvent[]): UnifiedTimeline['stats'] {
  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  
  for (const event of events) {
    byType[event.type] = (byType[event.type] || 0) + 1;
    bySource[event.source] = (bySource[event.source] || 0) + 1;
  }
  
  return {
    totalEvents: events.length,
    byType: byType as Record<TimelineEventType, number>,
    bySource,
  };
}

/**
 * Filtert Events nach Typ oder Zeitraum
 */
export function filterTimeline(
  timeline: UnifiedTimeline,
  options: {
    types?: TimelineEventType[];
    sources?: string[];
    after?: Date;
    before?: Date;
    limit?: number;
  }
): TimelineEvent[] {
  let events = timeline.events;
  
  if (options.types && options.types.length > 0) {
    events = events.filter(e => options.types!.includes(e.type));
  }
  
  if (options.sources && options.sources.length > 0) {
    events = events.filter(e => options.sources!.includes(e.source));
  }
  
  if (options.after) {
    events = events.filter(e => e.timestamp >= options.after!);
  }
  
  if (options.before) {
    events = events.filter(e => e.timestamp <= options.before!);
  }
  
  if (options.limit) {
    events = events.slice(0, options.limit);
  }
  
  return events;
}

/**
 * Gruppiert Events in Snapshots für die Visualisierung
 */
export function createTimelineSnapshots(
  timeline: UnifiedTimeline,
  maxSnapshots: number = 100
): TimelineEvent[][] {
  const events = timeline.events;
  
  if (events.length <= maxSnapshots) {
    // Jedes Event = ein Snapshot
    return events.map(e => [e]);
  }
  
  // Gruppiere Events in Buckets
  const bucketSize = Math.ceil(events.length / maxSnapshots);
  const snapshots: TimelineEvent[][] = [];
  
  for (let i = 0; i < events.length; i += bucketSize) {
    snapshots.push(events.slice(i, i + bucketSize));
  }
  
  return snapshots;
}
