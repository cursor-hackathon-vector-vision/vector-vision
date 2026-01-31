import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import os from 'os';

export interface DiscoveredProject {
  name: string;
  path: string;
  hasCursor: boolean;
  hasGit: boolean;
  lastModified: Date;
  conversationCount: number;
  agentSessions: AgentSession[];
}

export interface AgentSession {
  id: string;
  type: 'chat' | 'composer' | 'agent' | 'unknown';
  timestamp: Date;
  messageCount: number;
  title?: string;
  model?: string;
}

export interface ConversationDiscovery {
  projectPath: string;
  conversations: AgentSession[];
  totalMessages: number;
}

/**
 * Discover Cursor projects in common locations
 */
export async function discoverCursorProjects(customPaths?: string[]): Promise<DiscoveredProject[]> {
  const projects: DiscoveredProject[] = [];
  const homeDir = os.homedir();
  
  // Use custom paths or defaults
  const searchPaths = customPaths || [
    path.join(homeDir, 'projects'),
    path.join(homeDir, 'dev'),
    path.join(homeDir, 'code'),
  ];
  
  console.log('Searching in paths:', searchPaths);
  
  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) {
      console.log(`Path does not exist: ${searchPath}`);
      continue;
    }
    
    try {
      console.log(`Scanning: ${searchPath}`);
      
      // Use a timeout wrapper for glob
      const cursorDirs = await Promise.race([
        glob('**/.cursor', {
          cwd: searchPath,
          ignore: [
            '**/node_modules/**', 
            '**/.git/**', 
            '**/dist/**', 
            '**/build/**',
            '**/venv/**',
            '**/__pycache__/**',
            '**/target/**',
          ],
          absolute: true,
          maxDepth: 3, // Reduced depth for faster scanning
        }),
        new Promise<string[]>((_, reject) => 
          setTimeout(() => reject(new Error('Glob timeout')), 30000)
        )
      ]);
      
      console.log(`Found ${cursorDirs.length} .cursor directories in ${searchPath}`);
      
      // Process in batches to avoid overwhelming
      const batchSize = 10;
      for (let i = 0; i < cursorDirs.length; i += batchSize) {
        const batch = cursorDirs.slice(i, i + batchSize);
        
        const batchResults = await Promise.all(
          batch.map(async (cursorPath) => {
            const projectPath = path.dirname(cursorPath);
            
            // Skip if already discovered
            if (projects.some(p => p.path === projectPath)) return null;
            
            try {
              return await analyzeProjectFast(projectPath);
            } catch (err) {
              console.debug(`Error analyzing ${projectPath}:`, err);
              return null;
            }
          })
        );
        
        for (const project of batchResults) {
          if (project) projects.push(project);
        }
      }
      
    } catch (error) {
      console.error(`Error scanning ${searchPath}:`, error);
    }
  }
  
  // Sort by last modified
  projects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  
  console.log(`Total projects found: ${projects.length}`);
  return projects;
}

/**
 * Fast project analysis without deep session scanning
 */
async function analyzeProjectFast(projectPath: string): Promise<DiscoveredProject | null> {
  try {
    const name = path.basename(projectPath);
    const cursorPath = path.join(projectPath, '.cursor');
    const gitPath = path.join(projectPath, '.git');
    
    const hasCursor = fs.existsSync(cursorPath);
    const hasGit = fs.existsSync(gitPath);
    
    // Get last modified time
    const stats = fs.statSync(projectPath);
    
    // Quick count of JSON files (don't parse them)
    let conversationCount = 0;
    if (hasCursor) {
      try {
        const files = fs.readdirSync(cursorPath);
        conversationCount = files.filter(f => f.endsWith('.json')).length;
      } catch {
        // Ignore read errors
      }
    }
    
    return {
      name,
      path: projectPath,
      hasCursor,
      hasGit,
      lastModified: stats.mtime,
      conversationCount,
      agentSessions: [], // Skip detailed analysis for speed
    };
  } catch (error) {
    return null;
  }
}

/**
 * Analyze a single project for Cursor data
 */
async function analyzeProject(projectPath: string): Promise<DiscoveredProject | null> {
  try {
    const name = path.basename(projectPath);
    const cursorPath = path.join(projectPath, '.cursor');
    const gitPath = path.join(projectPath, '.git');
    
    const hasCursor = fs.existsSync(cursorPath);
    const hasGit = fs.existsSync(gitPath);
    
    // Get last modified time
    const stats = fs.statSync(projectPath);
    
    // Discover agent sessions
    const agentSessions = hasCursor ? await discoverAgentSessions(cursorPath) : [];
    
    return {
      name,
      path: projectPath,
      hasCursor,
      hasGit,
      lastModified: stats.mtime,
      conversationCount: agentSessions.length,
      agentSessions,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Discover all agent sessions in a .cursor directory
 */
async function discoverAgentSessions(cursorPath: string): Promise<AgentSession[]> {
  const sessions: AgentSession[] = [];
  
  try {
    // Find all JSON files that might contain conversations
    const jsonFiles = await glob('**/*.json', {
      cwd: cursorPath,
      absolute: true,
    });
    
    for (const filePath of jsonFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        const session = parseSessionData(data, filePath);
        if (session) {
          sessions.push(session);
        }
      } catch {
        // Skip invalid files
      }
    }
    
    // Also check for state.vscdb or similar databases
    const dbFiles = await glob('**/*.vscdb', {
      cwd: cursorPath,
      absolute: true,
    });
    
    // Note: For SQLite databases, we'd need better-sqlite3
    // For now, we focus on JSON files
    
  } catch (error) {
    console.debug('Error discovering sessions:', error);
  }
  
  // Sort by timestamp
  sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  return sessions;
}

function parseSessionData(data: unknown, filePath: string): AgentSession | null {
  if (typeof data !== 'object' || data === null) return null;
  
  const obj = data as Record<string, unknown>;
  const fileName = path.basename(filePath, '.json');
  
  // Try to determine session type from structure
  let type: AgentSession['type'] = 'unknown';
  let messageCount = 0;
  let title: string | undefined;
  let model: string | undefined;
  let timestamp = new Date();
  
  // Check for messages array
  if (Array.isArray(obj.messages)) {
    messageCount = obj.messages.length;
    type = 'chat';
    
    // Extract model if present
    const firstMsg = obj.messages[0] as Record<string, unknown> | undefined;
    if (firstMsg?.model) model = String(firstMsg.model);
    
    // Try to get timestamp
    if (firstMsg?.timestamp) {
      timestamp = new Date(firstMsg.timestamp as number);
    } else if (firstMsg?.created_at) {
      timestamp = new Date(firstMsg.created_at as number);
    }
    
    // Generate title from first user message
    const userMsg = obj.messages.find((m: unknown) => 
      (m as Record<string, unknown>).role === 'user'
    ) as Record<string, unknown> | undefined;
    
    if (userMsg?.content) {
      const content = String(userMsg.content);
      title = content.slice(0, 60) + (content.length > 60 ? '...' : '');
    }
  }
  
  // Check for tabs (composer style)
  if (Array.isArray(obj.tabs)) {
    type = 'composer';
    messageCount = (obj.tabs as unknown[]).reduce((sum, tab) => {
      const t = tab as Record<string, unknown>;
      return sum + (Array.isArray(t.messages) ? t.messages.length : 0);
    }, 0);
  }
  
  // Check for agent indicators
  if (obj.agentMode || obj.isAgent || fileName.includes('agent')) {
    type = 'agent';
  }
  
  if (messageCount === 0) return null;
  
  return {
    id: fileName,
    type,
    timestamp,
    messageCount,
    title,
    model,
  };
}

/**
 * Get detailed conversation data for a project
 */
export async function getProjectConversations(projectPath: string): Promise<ConversationDiscovery> {
  const cursorPath = path.join(projectPath, '.cursor');
  
  if (!fs.existsSync(cursorPath)) {
    return {
      projectPath,
      conversations: [],
      totalMessages: 0,
    };
  }
  
  const conversations = await discoverAgentSessions(cursorPath);
  const totalMessages = conversations.reduce((sum, c) => sum + c.messageCount, 0);
  
  return {
    projectPath,
    conversations,
    totalMessages,
  };
}

/**
 * Quick scan for .cursor directories
 */
export async function quickScanForCursor(basePath: string): Promise<string[]> {
  try {
    const results = await glob('**/.cursor', {
      cwd: basePath,
      ignore: ['**/node_modules/**'],
      absolute: true,
      maxDepth: 4,
    });
    
    return results.map(p => path.dirname(p));
  } catch {
    return [];
  }
}
