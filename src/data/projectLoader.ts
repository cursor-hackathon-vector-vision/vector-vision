import { api, ProjectScanResult, GitCommit } from '../api/client';
import type { ProjectData, ProjectSnapshot, FileNode } from '../types';

/**
 * Load project from backend API
 */
export async function loadProjectFromBackend(projectPath: string): Promise<ProjectData> {
  const result = await api.scanProject(projectPath);
  
  // Convert to ProjectData format
  return convertToProjectData(result);
}

function convertToProjectData(result: ProjectScanResult): ProjectData {
  const snapshots = buildSnapshots(result);
  
  return {
    name: result.name,
    path: result.path,
    snapshots,
    currentIndex: snapshots.length - 1
  };
}

function buildSnapshots(result: ProjectScanResult): ProjectSnapshot[] {
  const { files, gitHistory, cursorData } = result;
  
  // If we have git history, use it to create snapshots
  if (gitHistory.isGitRepo && gitHistory.commits.length > 0) {
    return buildSnapshotsFromGit(files, gitHistory.commits, cursorData.chats);
  }
  
  // Otherwise, create snapshots from file modification times
  return buildSnapshotsFromFiles(files, cursorData.chats);
}

function buildSnapshotsFromGit(
  allFiles: ProjectScanResult['files'],
  commits: GitCommit[],
  chats: ProjectScanResult['cursorData']['chats']
): ProjectSnapshot[] {
  const snapshots: ProjectSnapshot[] = [];
  
  // Map files by path for quick lookup
  const fileMap = new Map(allFiles.map(f => [f.relativePath, f]));
  
  // Process commits in chronological order (oldest first)
  const sortedCommits = [...commits].reverse();
  
  // Track cumulative files
  const cumulativeFiles = new Map<string, FileNode>();
  
  for (const commit of sortedCommits) {
    const commitDate = new Date(commit.date);
    
    // Apply changes from this commit
    for (const change of commit.files) {
      if (change.status === 'deleted') {
        cumulativeFiles.delete(change.path);
      } else {
        const existingFile = fileMap.get(change.path);
        if (existingFile) {
          cumulativeFiles.set(change.path, {
            path: change.path,
            name: existingFile.name,
            extension: existingFile.extension,
            linesOfCode: existingFile.linesOfCode,
            directory: existingFile.directory,
            createdAt: new Date(existingFile.createdAt),
            modifiedAt: commitDate,
            status: change.status === 'added' ? 'added' : 'modified'
          });
        } else {
          // File was in commit but not in current scan (maybe deleted later)
          const parts = change.path.split('/');
          const name = parts[parts.length - 1];
          const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
          
          cumulativeFiles.set(change.path, {
            path: change.path,
            name,
            extension: ext,
            linesOfCode: (change.additions || 0) + (change.deletions || 0),
            directory: parts.slice(0, -1).join('/') || '/',
            createdAt: commitDate,
            modifiedAt: commitDate,
            status: change.status === 'added' ? 'added' : 'modified'
          });
        }
      }
    }
    
    // Find chats related to this commit (within 1 hour)
    const relatedChats = chats.filter(chat => {
      const chatDate = new Date(chat.timestamp);
      const diffMs = Math.abs(chatDate.getTime() - commitDate.getTime());
      return diffMs < 3600000; // 1 hour
    }).map(chat => ({
      id: chat.id,
      timestamp: new Date(chat.timestamp),
      role: chat.role as 'user' | 'assistant',
      content: chat.content,
      relatedFiles: chat.relatedFiles,
      model: chat.model
    }));
    
    // Create snapshot
    const snapshotFiles = Array.from(cumulativeFiles.values()).map(f => ({ ...f }));
    
    // Reset status for next iteration
    cumulativeFiles.forEach(f => f.status = 'unchanged');
    
    snapshots.push({
      timestamp: commitDate,
      commitHash: commit.hash,
      commitMessage: commit.message,
      author: commit.author,
      files: snapshotFiles,
      chats: relatedChats,
      terminalCommands: []
    });
  }
  
  // Add final snapshot with current state if different from last commit
  if (allFiles.length > cumulativeFiles.size) {
    const finalFiles: FileNode[] = allFiles.map(f => ({
      path: f.relativePath,
      name: f.name,
      extension: f.extension,
      linesOfCode: f.linesOfCode,
      directory: f.directory,
      createdAt: new Date(f.createdAt),
      modifiedAt: new Date(f.modifiedAt),
      status: cumulativeFiles.has(f.relativePath) ? 'unchanged' : 'added'
    }));
    
    snapshots.push({
      timestamp: new Date(),
      commitHash: 'current',
      commitMessage: 'Current state (uncommitted)',
      author: 'Local',
      files: finalFiles,
      chats: chats.map(c => ({
        id: c.id,
        timestamp: new Date(c.timestamp),
        role: c.role as 'user' | 'assistant',
        content: c.content,
        relatedFiles: c.relatedFiles,
        model: c.model
      })),
      terminalCommands: []
    });
  }
  
  return snapshots;
}

function buildSnapshotsFromFiles(
  files: ProjectScanResult['files'],
  chats: ProjectScanResult['cursorData']['chats']
): ProjectSnapshot[] {
  // Group files by modification date (day granularity)
  const filesByDate = new Map<string, typeof files>();
  
  for (const file of files) {
    const dateKey = new Date(file.modifiedAt).toISOString().split('T')[0];
    if (!filesByDate.has(dateKey)) {
      filesByDate.set(dateKey, []);
    }
    filesByDate.get(dateKey)!.push(file);
  }
  
  // Sort dates
  const sortedDates = Array.from(filesByDate.keys()).sort();
  
  // Build progressive snapshots
  const snapshots: ProjectSnapshot[] = [];
  const cumulativeFiles = new Map<string, FileNode>();
  
  for (const dateKey of sortedDates) {
    const dayFiles = filesByDate.get(dateKey)!;
    const dayDate = new Date(dateKey);
    
    // Add/update files from this day
    for (const file of dayFiles) {
      const status = cumulativeFiles.has(file.relativePath) ? 'modified' : 'added';
      cumulativeFiles.set(file.relativePath, {
        path: file.relativePath,
        name: file.name,
        extension: file.extension,
        linesOfCode: file.linesOfCode,
        directory: file.directory,
        createdAt: new Date(file.createdAt),
        modifiedAt: new Date(file.modifiedAt),
        status: status as 'added' | 'modified'
      });
    }
    
    // Find chats from this day
    const dayChats = chats.filter(chat => {
      const chatDate = new Date(chat.timestamp).toISOString().split('T')[0];
      return chatDate === dateKey;
    }).map(chat => ({
      id: chat.id,
      timestamp: new Date(chat.timestamp),
      role: chat.role as 'user' | 'assistant',
      content: chat.content,
      relatedFiles: chat.relatedFiles,
      model: chat.model
    }));
    
    // Create snapshot
    const snapshotFiles = Array.from(cumulativeFiles.values()).map(f => ({ ...f }));
    
    snapshots.push({
      timestamp: dayDate,
      commitHash: `day-${dateKey}`,
      commitMessage: `${dayFiles.length} file(s) modified`,
      author: 'System',
      files: snapshotFiles,
      chats: dayChats,
      terminalCommands: []
    });
    
    // Reset status
    cumulativeFiles.forEach(f => f.status = 'unchanged');
  }
  
  // Ensure at least one snapshot
  if (snapshots.length === 0) {
    snapshots.push({
      timestamp: new Date(),
      commitHash: 'initial',
      commitMessage: 'Initial state',
      author: 'System',
      files: files.map(f => ({
        path: f.relativePath,
        name: f.name,
        extension: f.extension,
        linesOfCode: f.linesOfCode,
        directory: f.directory,
        createdAt: new Date(f.createdAt),
        modifiedAt: new Date(f.modifiedAt),
        status: 'added' as const
      })),
      chats: chats.map(c => ({
        id: c.id,
        timestamp: new Date(c.timestamp),
        role: c.role as 'user' | 'assistant',
        content: c.content,
        relatedFiles: c.relatedFiles,
        model: c.model
      })),
      terminalCommands: []
    });
  }
  
  return snapshots;
}

/**
 * Check if backend is available
 */
export async function checkBackendAvailable(): Promise<boolean> {
  return api.checkHealth();
}
