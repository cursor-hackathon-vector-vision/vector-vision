import type { FileNode, ProjectSnapshot, ChatMessage } from '../types';

/**
 * Parse files from a dropped folder using the File System Access API
 */
export async function parseDroppedFolder(files: FileList): Promise<{
  files: FileNode[];
  chats: ChatMessage[];
  projectName: string;
}> {
  const fileNodes: FileNode[] = [];
  const chats: ChatMessage[] = [];
  let projectName = 'Unknown Project';
  
  // Find the root directory name
  const paths = Array.from(files).map(f => f.webkitRelativePath);
  if (paths.length > 0) {
    projectName = paths[0].split('/')[0];
  }
  
  // Process each file
  for (const file of Array.from(files)) {
    const relativePath = file.webkitRelativePath;
    const pathParts = relativePath.split('/');
    
    // Skip hidden files and directories (except .cursor)
    if (pathParts.some(part => part.startsWith('.') && part !== '.cursor')) {
      // Check for cursor chat data
      if (relativePath.includes('.cursor/')) {
        const chatData = await parseCursorFile(file, relativePath);
        if (chatData) {
          chats.push(...chatData);
        }
      }
      continue;
    }
    
    // Skip node_modules and other common ignored directories
    if (pathParts.some(part => 
      ['node_modules', 'dist', 'build', '.git', '__pycache__', 'venv', '.venv'].includes(part)
    )) {
      continue;
    }
    
    // Parse the file
    const fileNode = await parseFile(file, relativePath);
    if (fileNode) {
      fileNodes.push(fileNode);
    }
  }
  
  return { files: fileNodes, chats, projectName };
}

async function parseFile(file: File, relativePath: string): Promise<FileNode | null> {
  const pathParts = relativePath.split('/');
  const fileName = pathParts[pathParts.length - 1];
  const directory = pathParts.slice(1, -1).join('/') || '/';
  const extension = fileName.includes('.') ? '.' + fileName.split('.').pop()! : '';
  
  // Count lines of code for text files
  let linesOfCode = 0;
  let content: string | undefined;
  
  if (isTextFile(extension)) {
    try {
      content = await file.text();
      linesOfCode = content.split('\n').length;
    } catch {
      linesOfCode = 0;
    }
  }
  
  return {
    path: '/' + pathParts.slice(1).join('/'),
    name: fileName,
    extension,
    linesOfCode,
    directory: '/' + directory,
    createdAt: new Date(file.lastModified),
    modifiedAt: new Date(file.lastModified),
    status: 'unchanged',
    content
  };
}

async function parseCursorFile(file: File, relativePath: string): Promise<ChatMessage[] | null> {
  // Try to parse Cursor conversation files
  if (!relativePath.endsWith('.json')) return null;
  
  try {
    const content = await file.text();
    const data = JSON.parse(content);
    
    // Handle different Cursor data formats
    if (Array.isArray(data)) {
      return data
        .filter((item: Record<string, unknown>) => item.role && item.content)
        .map((item: Record<string, unknown>, index: number) => ({
          id: `chat-${index}`,
          timestamp: new Date(item.timestamp as string || Date.now()),
          role: item.role as 'user' | 'assistant',
          content: String(item.content).slice(0, 500), // Limit content length
          relatedFiles: Array.isArray(item.files) ? item.files as string[] : [],
          model: item.model as string | undefined
        }));
    }
    
    // Handle object format with messages array
    if (data.messages && Array.isArray(data.messages)) {
      return data.messages
        .filter((item: Record<string, unknown>) => item.role && item.content)
        .map((item: Record<string, unknown>, index: number) => ({
          id: `chat-${index}`,
          timestamp: new Date(item.timestamp as string || Date.now()),
          role: item.role as 'user' | 'assistant',
          content: String(item.content).slice(0, 500),
          relatedFiles: Array.isArray(item.files) ? item.files as string[] : [],
          model: item.model as string | undefined
        }));
    }
  } catch {
    // Not a valid JSON or not a chat file
  }
  
  return null;
}

function isTextFile(extension: string): boolean {
  const textExtensions = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.css', '.scss', '.sass', '.less',
    '.html', '.htm', '.vue', '.svelte',
    '.json', '.yaml', '.yml', '.xml', '.toml',
    '.md', '.mdx', '.txt', '.rst',
    '.py', '.pyw', '.pyx',
    '.rs', '.go', '.rb', '.php',
    '.java', '.kt', '.kts',
    '.c', '.cpp', '.h', '.hpp',
    '.sh', '.bash', '.zsh',
    '.env', '.gitignore', '.editorconfig',
    '.sql', '.graphql', '.gql'
  ];
  
  return textExtensions.includes(extension.toLowerCase());
}

/**
 * Create a mock project snapshot from parsed files
 * (Used when no Git history is available)
 */
export function createSnapshotFromFiles(
  files: FileNode[], 
  chats: ChatMessage[],
  _projectName: string
): ProjectSnapshot {
  return {
    timestamp: new Date(),
    commitHash: 'current',
    commitMessage: 'Current state',
    author: 'Unknown',
    files,
    chats,
    terminalCommands: []
  };
}

/**
 * Simulate historical snapshots by analyzing file modification times
 */
export function generateHistoricalSnapshots(
  files: FileNode[],
  chats: ChatMessage[],
  _projectName?: string
): ProjectSnapshot[] {
  // Group files by modification date (day granularity)
  const filesByDate = new Map<string, FileNode[]>();
  
  files.forEach(file => {
    const dateKey = file.modifiedAt.toISOString().split('T')[0];
    if (!filesByDate.has(dateKey)) {
      filesByDate.set(dateKey, []);
    }
    filesByDate.get(dateKey)!.push(file);
  });
  
  // Sort dates
  const sortedDates = Array.from(filesByDate.keys()).sort();
  
  // Create progressive snapshots
  const snapshots: ProjectSnapshot[] = [];
  const cumulativeFiles: FileNode[] = [];
  
  sortedDates.forEach((dateKey, index) => {
    const dayFiles = filesByDate.get(dateKey)!;
    
    // Mark new files as 'added', existing as 'unchanged'
    dayFiles.forEach(file => {
      const existingIndex = cumulativeFiles.findIndex(f => f.path === file.path);
      if (existingIndex >= 0) {
        cumulativeFiles[existingIndex] = { ...file, status: 'modified' };
      } else {
        cumulativeFiles.push({ ...file, status: 'added' });
      }
    });
    
    // Find chats from this day
    const dayChats = chats.filter(chat => {
      const chatDate = chat.timestamp.toISOString().split('T')[0];
      return chatDate === dateKey;
    });
    
    snapshots.push({
      timestamp: new Date(dateKey),
      commitHash: `snapshot-${index}`,
      commitMessage: `Day ${index + 1}: ${dayFiles.length} file(s) modified`,
      author: 'System',
      files: cumulativeFiles.map(f => ({ ...f })), // Deep copy
      chats: dayChats,
      terminalCommands: []
    });
    
    // Reset status for next iteration
    cumulativeFiles.forEach(f => f.status = 'unchanged');
  });
  
  return snapshots.length > 0 ? snapshots : [{
    timestamp: new Date(),
    commitHash: 'initial',
    commitMessage: 'Initial state',
    author: 'System',
    files: files.map(f => ({ ...f, status: 'added' })),
    chats,
    terminalCommands: []
  }];
}
