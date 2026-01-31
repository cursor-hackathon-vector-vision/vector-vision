import { api, ProjectScanResult } from '../api/client';
import type { ProjectData, ProjectSnapshot, FileNode, TimelineEvent, UnifiedTimeline } from '../types';

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
  const { files, cursorData, unifiedTimeline } = result;
  
  // 🆕 PRIORITY 1: Use UNIFIED TIMELINE (ALL sources: Git + Cursor + Claude + Antigravity + Files)
  if (unifiedTimeline && unifiedTimeline.events && unifiedTimeline.events.length > 0) {
    console.log('[Snapshots] Building from UNIFIED TIMELINE:', unifiedTimeline.events.length, 'events');
    console.log('[Snapshots] Sources:', unifiedTimeline.sources?.join(', '));
    return buildSnapshotsFromUnifiedTimeline(files, unifiedTimeline);
  }
  
  // Fallback 1: Use chat messages
  if (cursorData.chats.length > 0) {
    console.log('[Snapshots] Fallback: Building from MESSAGES:', cursorData.chats.length, 'messages');
    return buildSnapshotsFromMessages(files, cursorData.chats);
  }
  
  // Fallback 2: Use file modification times
  console.log('[Snapshots] Fallback: No events, using file dates');
  return buildSnapshotsFromFiles(files, []);
}

/**
 * 🆕 BUILD SNAPSHOTS FROM UNIFIED TIMELINE
 * Uses ALL event sources: Git commits, Cursor messages, Claude Code, Antigravity, File changes
 */
function buildSnapshotsFromUnifiedTimeline(
  allFiles: ProjectScanResult['files'],
  timeline: UnifiedTimeline
): ProjectSnapshot[] {
  const snapshots: ProjectSnapshot[] = [];
  
  // Sort events by timestamp
  let sortedEvents = [...timeline.events].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // LIMIT: Max 500 snapshots for performance
  const maxSnapshots = 500;
  if (sortedEvents.length > maxSnapshots) {
    console.log(`[Snapshots] Limiting ${sortedEvents.length} events to ${maxSnapshots} snapshots`);
    const step = Math.ceil(sortedEvents.length / maxSnapshots);
    sortedEvents = sortedEvents.filter((_, i) => i % step === 0);
  }
  
  // Prepare all files as FileNode format
  const allFileNodes: FileNode[] = allFiles.map(f => ({
    path: f.relativePath,
    name: f.name,
    extension: f.extension,
    linesOfCode: f.linesOfCode,
    directory: f.directory,
    createdAt: new Date(f.createdAt),
    modifiedAt: new Date(f.modifiedAt),
    status: 'unchanged' as const
  }));
  
  // Track which files have "appeared" in the timeline
  const appearedFiles = new Set<string>();
  const cumulativeFiles: FileNode[] = [];
  const cumulativeChats: ProjectSnapshot['chats'] = [];
  
  // Distribute files across the timeline
  const filesPerEvent = Math.max(1, Math.ceil(allFileNodes.length / Math.max(sortedEvents.length, 1)));
  let fileIndex = 0;
  
  // Create a snapshot for EACH event
  for (let i = 0; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];
    const eventTime = new Date(event.timestamp);
    
    // Add related files from this event
    for (const relPath of event.files || []) {
      const cleanPath = relPath.startsWith('/') ? relPath.slice(1) : relPath;
      const file = allFileNodes.find(f => 
        f.path === cleanPath || 
        f.path.endsWith(cleanPath) || 
        cleanPath.endsWith(f.name)
      );
      if (file && !appearedFiles.has(file.path)) {
        appearedFiles.add(file.path);
        cumulativeFiles.push({ ...file, status: 'added' });
      }
    }
    
    // Also add some files progressively
    const filesToAdd = Math.min(filesPerEvent, allFileNodes.length - fileIndex);
    for (let j = 0; j < filesToAdd; j++) {
      const file = allFileNodes[fileIndex + j];
      if (file && !appearedFiles.has(file.path)) {
        appearedFiles.add(file.path);
        cumulativeFiles.push({ ...file, status: 'added' });
      }
    }
    fileIndex += filesToAdd;
    
    // Add chat if this is a chat event
    if (event.type === 'cursor-user' || event.type === 'cursor-assistant' || event.type === 'claude-code') {
      cumulativeChats.push({
        id: event.id,
        timestamp: eventTime,
        role: event.lane === 'user' ? 'user' : 'assistant',
        content: event.content,
        relatedFiles: event.files || [],
        model: event.meta?.model,
        tokenCost: event.meta?.tokenCost
      });
    }
    
    // Determine icon based on event type
    const icon = getEventIcon(event.type);
    
    // Create snapshot for THIS event
    snapshots.push({
      timestamp: eventTime,
      commitHash: event.type === 'git-commit' ? (event.meta?.commitHash || `evt-${i}`) : `evt-${i}`,
      commitMessage: `${icon} ${event.title}`,
      author: event.meta?.author || getEventAuthor(event.type, event.lane),
      files: cumulativeFiles.map(f => ({ ...f })),
      chats: [...cumulativeChats],
      terminalCommands: [],
      // 🆕 Store the original event for visualization
      _timelineEvent: event as unknown as TimelineEvent
    } as ProjectSnapshot);
    
    // Reset file status for next iteration
    cumulativeFiles.forEach(f => f.status = 'unchanged');
  }
  
  // Make sure all remaining files appear in final snapshot
  if (fileIndex < allFileNodes.length) {
    for (let j = fileIndex; j < allFileNodes.length; j++) {
      const file = allFileNodes[j];
      if (!appearedFiles.has(file.path)) {
        appearedFiles.add(file.path);
        cumulativeFiles.push({ ...file, status: 'added' });
      }
    }
    
    // Add final snapshot with all files
    snapshots.push({
      timestamp: new Date(),
      commitHash: 'final',
      commitMessage: '✅ Current state',
      author: 'System',
      files: cumulativeFiles.map(f => ({ ...f })),
      chats: [...cumulativeChats],
      terminalCommands: []
    });
  }
  
  console.log('[Snapshots] Created', snapshots.length, 'snapshots from unified timeline');
  return snapshots;
}

function getEventIcon(type: string): string {
  const icons: Record<string, string> = {
    'git-commit': '🔀',
    'cursor-user': '💬',
    'cursor-assistant': '🤖',
    'cursor-tool': '🔧',
    'claude-code': '🧠',
    'antigravity': '🚀',
    'file-created': '📄',
    'file-modified': '✏️',
    'command': '⌨️',
  };
  return icons[type] || '📌';
}

function getEventAuthor(type: string, lane: string): string {
  if (type === 'git-commit') return 'Git';
  if (type === 'claude-code') return 'Claude';
  if (type === 'antigravity') return 'Antigravity';
  if (lane === 'user') return 'User';
  if (lane === 'ai') return 'Assistant';
  return 'System';
}

/**
 * BUILD SNAPSHOTS FROM MESSAGES - Each message = one timeline step!
 * This creates MANY more granular snapshots for smooth animation.
 */
function buildSnapshotsFromMessages(
  allFiles: ProjectScanResult['files'],
  chats: ProjectScanResult['cursorData']['chats']
): ProjectSnapshot[] {
  const snapshots: ProjectSnapshot[] = [];
  
  // Sort chats by timestamp
  const sortedChats = [...chats].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // Prepare all files as FileNode format
  const allFileNodes: FileNode[] = allFiles.map(f => ({
    path: f.relativePath,
    name: f.name,
    extension: f.extension,
    linesOfCode: f.linesOfCode,
    directory: f.directory,
    createdAt: new Date(f.createdAt),
    modifiedAt: new Date(f.modifiedAt),
    status: 'unchanged' as const
  }));
  
  // Track which files have "appeared" in the timeline
  const appearedFiles = new Set<string>();
  const cumulativeFiles: FileNode[] = [];
  
  // Calculate time span for distributing files (used for progressive file appearance)
  const _firstTime = sortedChats.length > 0 ? new Date(sortedChats[0].timestamp).getTime() : Date.now();
  const _lastTime = sortedChats.length > 0 ? new Date(sortedChats[sortedChats.length - 1].timestamp).getTime() : Date.now();
  void _firstTime; void _lastTime; // Available for future use
  
  // Distribute files across the timeline (files "appear" progressively)
  const filesPerMessage = Math.max(1, Math.ceil(allFileNodes.length / Math.max(sortedChats.length, 1)));
  let fileIndex = 0;
  
  // Create a snapshot for EACH message
  for (let i = 0; i < sortedChats.length; i++) {
    const chat = sortedChats[i];
    const chatTime = new Date(chat.timestamp);
    
    // Add related files from this message if they exist
    for (const relPath of chat.relatedFiles || []) {
      const file = allFileNodes.find(f => f.path.endsWith(relPath) || relPath.endsWith(f.name));
      if (file && !appearedFiles.has(file.path)) {
        appearedFiles.add(file.path);
        cumulativeFiles.push({ ...file, status: 'added' });
      }
    }
    
    // Also add some files progressively (to fill in files without related messages)
    const filesToAdd = Math.min(filesPerMessage, allFileNodes.length - fileIndex);
    for (let j = 0; j < filesToAdd; j++) {
      const file = allFileNodes[fileIndex + j];
      if (file && !appearedFiles.has(file.path)) {
        appearedFiles.add(file.path);
        cumulativeFiles.push({ ...file, status: 'added' });
      }
    }
    fileIndex += filesToAdd;
    
    // Collect all chats up to this point
    const chatsUpToNow = sortedChats.slice(0, i + 1).map(c => ({
      id: c.id,
      timestamp: new Date(c.timestamp),
      role: c.role as 'user' | 'assistant',
      content: c.content,
      relatedFiles: c.relatedFiles || [],
      model: c.model,
      tokenCost: c.tokenCost
    }));
    
    // Create snapshot for THIS message
    const snapshotFiles = cumulativeFiles.map(f => ({ ...f }));
    
    // Determine a short "commit message" from the chat content
    const shortContent = chat.content.slice(0, 100) + (chat.content.length > 100 ? '...' : '');
    
    snapshots.push({
      timestamp: chatTime,
      commitHash: `msg-${i}`,
      commitMessage: `${chat.role === 'user' ? '💬' : '🤖'} ${shortContent}`,
      author: chat.role === 'user' ? 'User' : 'Assistant',
      files: snapshotFiles,
      chats: chatsUpToNow,
      terminalCommands: []
    });
    
    // Reset file status for next iteration
    cumulativeFiles.forEach(f => f.status = 'unchanged');
  }
  
  // Make sure all remaining files appear in final snapshot
  if (fileIndex < allFileNodes.length) {
    for (let j = fileIndex; j < allFileNodes.length; j++) {
      const file = allFileNodes[j];
      if (!appearedFiles.has(file.path)) {
        appearedFiles.add(file.path);
        cumulativeFiles.push({ ...file, status: 'added' });
      }
    }
    
    // Add final snapshot with all files
    snapshots.push({
      timestamp: new Date(),
      commitHash: 'final',
      commitMessage: '✅ Current state',
      author: 'System',
      files: cumulativeFiles.map(f => ({ ...f })),
      chats: sortedChats.map(c => ({
        id: c.id,
        timestamp: new Date(c.timestamp),
        role: c.role as 'user' | 'assistant',
        content: c.content,
        relatedFiles: c.relatedFiles || [],
        model: c.model,
        tokenCost: c.tokenCost
      })),
      terminalCommands: []
    });
  }
  
  console.log('[Snapshots] Created', snapshots.length, 'snapshots from messages');
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
