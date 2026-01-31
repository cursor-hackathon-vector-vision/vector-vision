/**
 * API Client for Vector Vision Backend
 */

const API_BASE = 'http://localhost:3333/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  isGitRepo: boolean;
}

export interface BrowseResponse {
  currentPath: string;
  parentPath: string;
  directories: DirectoryEntry[];
}

export interface ScannedFile {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  directory: string;
  linesOfCode: number;
  size: number;
  createdAt: string;
  modifiedAt: string;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  files: {
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    additions?: number;
    deletions?: number;
  }[];
}

export interface GitHistory {
  isGitRepo: boolean;
  branch?: string;
  commits: GitCommit[];
  totalCommits: number;
}

export interface CursorChat {
  id: string;
  timestamp: string;
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

export interface ProjectScanResult {
  name: string;
  path: string;
  files: ScannedFile[];
  gitHistory: GitHistory;
  cursorData: CursorData;
}

export interface AgentSession {
  id: string;
  type: 'chat' | 'composer' | 'agent' | 'unknown';
  timestamp: string;
  messageCount: number;
  title?: string;
  model?: string;
}

export interface DiscoveredProject {
  name: string;
  path: string;
  hasCursor: boolean;
  hasGit: boolean;
  lastModified: string;
  conversationCount: number;
  agentSessions: AgentSession[];
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Check if backend is running
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.fetch<{ status: string }>('/health');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get suggested project paths
   */
  async getRecentPaths(): Promise<string[]> {
    const response = await this.fetch<{ suggestions: string[] }>('/recent-paths');
    return response.suggestions;
  }

  /**
   * Browse a directory
   */
  async browse(dirPath?: string): Promise<BrowseResponse> {
    return this.fetch<BrowseResponse>('/browse', {
      method: 'POST',
      body: JSON.stringify({ dirPath }),
    });
  }

  /**
   * Scan a project directory
   */
  async scanProject(projectPath: string): Promise<ProjectScanResult> {
    const response = await this.fetch<{ success: boolean; project: ProjectScanResult }>('/scan', {
      method: 'POST',
      body: JSON.stringify({ projectPath }),
    });
    return response.project;
  }

  /**
   * Get file content
   */
  async getFileContent(filePath: string): Promise<{ content: string; size: number; modified: string }> {
    return this.fetch('/file', {
      method: 'POST',
      body: JSON.stringify({ filePath }),
    });
  }

  /**
   * Discover Cursor projects
   */
  async discoverProjects(searchPaths?: string[]): Promise<DiscoveredProject[]> {
    const response = await this.fetch<{ projects: DiscoveredProject[] }>('/discover', {
      method: 'POST',
      body: JSON.stringify({ searchPaths }),
    });
    return response.projects;
  }

  /**
   * Quick scan for Cursor projects in a directory
   */
  async quickScan(basePath: string): Promise<string[]> {
    const response = await this.fetch<{ projectPaths: string[] }>('/quick-scan', {
      method: 'POST',
      body: JSON.stringify({ basePath }),
    });
    return response.projectPaths;
  }

  /**
   * Get conversations for a project
   */
  async getConversations(projectPath: string): Promise<{ conversations: AgentSession[]; totalMessages: number }> {
    return this.fetch('/conversations', {
      method: 'POST',
      body: JSON.stringify({ projectPath }),
    });
  }

  /**
   * Scan multiple projects at once
   */
  async scanMultipleProjects(projectPaths: string[]): Promise<{ projects: ProjectScanResult[]; errors: unknown[] }> {
    return this.fetch('/scan-multi', {
      method: 'POST',
      body: JSON.stringify({ projectPaths }),
    });
  }
}

// Export singleton instance
export const api = new ApiClient();

// Also export class for custom instances
export { ApiClient };
