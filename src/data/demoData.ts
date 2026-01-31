import type { ProjectData, ProjectSnapshot, FileNode, ChatMessage } from '../types';

/**
 * Generate demo project data to showcase the visualization
 */
export function generateDemoProject(): ProjectData {
  const snapshots = generateDemoSnapshots();
  
  return {
    name: 'Vector Vision Demo',
    path: '/',
    snapshots,
    currentIndex: snapshots.length - 1
  };
}

function generateDemoSnapshots(): ProjectSnapshot[] {
  const snapshots: ProjectSnapshot[] = [];
  const baseTime = Date.now() - 7200000; // 2 hours ago
  
  // Snapshot 1: Initial setup
  snapshots.push({
    timestamp: new Date(baseTime),
    commitHash: 'abc1234',
    commitMessage: 'Initial project setup with Vite + TypeScript',
    author: 'Developer',
    files: [
      createFile('/package.json', 'json', 45, 'added'),
      createFile('/tsconfig.json', 'json', 25, 'added'),
      createFile('/vite.config.ts', 'ts', 20, 'added'),
      createFile('/index.html', 'html', 50, 'added'),
      createFile('/src/main.ts', 'ts', 30, 'added'),
    ],
    chats: [
      createChat('user', 'Create a new Vite + TypeScript project for 3D visualization', baseTime, ['/package.json', '/tsconfig.json']),
      createChat('assistant', 'I\'ll set up a new Vite project with TypeScript support. This includes configuring the build tools and creating the entry point...', baseTime + 30000, ['/vite.config.ts', '/src/main.ts']),
    ],
    terminalCommands: []
  });
  
  // Snapshot 2: Add Three.js
  snapshots.push({
    timestamp: new Date(baseTime + 600000),
    commitHash: 'def5678',
    commitMessage: 'Add Three.js and create basic scene',
    author: 'Developer',
    files: [
      ...snapshots[0].files.map(f => ({ ...f, status: 'unchanged' as const })),
      createFile('/src/3d/scene.ts', 'ts', 150, 'added'),
      createFile('/src/types/index.ts', 'ts', 200, 'added'),
    ],
    chats: [
      createChat('user', 'Add Three.js and create a basic 3D scene with orbit controls', baseTime + 600000, ['/src/3d/scene.ts']),
      createChat('assistant', 'I\'ll create a SceneManager class that handles the Three.js setup including camera, renderer, lighting, and orbit controls...', baseTime + 630000, ['/src/3d/scene.ts', '/src/types/index.ts']),
    ],
    terminalCommands: []
  });
  
  // Snapshot 3: Code City visualization
  snapshots.push({
    timestamp: new Date(baseTime + 1200000),
    commitHash: 'ghi9012',
    commitMessage: 'Implement Code City 3D visualization',
    author: 'Developer',
    files: [
      ...snapshots[1].files.map(f => ({ ...f, status: 'unchanged' as const })),
      createFile('/src/3d/codeCity.ts', 'ts', 450, 'added'),
      createFile('/src/3d/effects.ts', 'ts', 300, 'added'),
    ],
    chats: [
      createChat('user', 'Create a Code City visualization where files are buildings', baseTime + 1200000, ['/src/3d/codeCity.ts']),
      createChat('assistant', 'I\'ll implement a CodeCity class that generates 3D buildings for each file. Building height represents lines of code, colors represent file types...', baseTime + 1230000, ['/src/3d/codeCity.ts', '/src/3d/effects.ts']),
    ],
    terminalCommands: []
  });
  
  // Snapshot 4: File parser
  snapshots.push({
    timestamp: new Date(baseTime + 1800000),
    commitHash: 'jkl3456',
    commitMessage: 'Add file and Cursor data parsers',
    author: 'Developer',
    files: [
      ...snapshots[2].files.map(f => ({ ...f, status: 'unchanged' as const })),
      createFile('/src/data/fileParser.ts', 'ts', 180, 'added'),
      createFile('/src/data/cursorParser.ts', 'ts', 220, 'added'),
    ],
    chats: [
      createChat('user', 'Implement parsers for project files and Cursor chat data', baseTime + 1800000, ['/src/data/fileParser.ts']),
      createChat('assistant', 'I\'ll create parsers that can read files from a dropped folder and extract Cursor AI conversation data to visualize the development process...', baseTime + 1830000, ['/src/data/fileParser.ts', '/src/data/cursorParser.ts']),
    ],
    terminalCommands: []
  });
  
  // Snapshot 5: Chat bubbles
  snapshots.push({
    timestamp: new Date(baseTime + 2400000),
    commitHash: 'mno7890',
    commitMessage: 'Add floating chat bubbles with causality lines',
    author: 'Developer',
    files: [
      ...snapshots[3].files.map(f => ({ ...f, status: 'unchanged' as const })),
      createFile('/src/3d/chatBubbles.ts', 'ts', 280, 'added'),
      { ...snapshots[3].files.find(f => f.name === 'main.ts')!, linesOfCode: 350, status: 'modified' as const },
    ],
    chats: [
      createChat('user', 'Add chat bubbles that float above related files', baseTime + 2400000, ['/src/3d/chatBubbles.ts']),
      createChat('assistant', 'I\'ll create a ChatBubbleManager that displays AI conversations as floating sprites connected to their related files with animated bezier curves...', baseTime + 2430000, ['/src/3d/chatBubbles.ts', '/src/main.ts']),
    ],
    terminalCommands: []
  });
  
  // Snapshot 6: Video recording
  snapshots.push({
    timestamp: new Date(baseTime + 3000000),
    commitHash: 'pqr1234',
    commitMessage: 'Implement video recording and cinematic mode',
    author: 'Developer',
    files: [
      ...snapshots[4].files.map(f => ({ ...f, status: 'unchanged' as const })),
      createFile('/src/utils/videoRecorder.ts', 'ts', 200, 'added'),
      createFile('/src/store/index.ts', 'ts', 120, 'added'),
    ],
    chats: [
      createChat('user', 'Add video recording and a cinematic camera mode', baseTime + 3000000, ['/src/utils/videoRecorder.ts']),
      createChat('assistant', 'I\'ll implement a VideoRecorder using the MediaRecorder API and create cinematic camera paths that automatically orbit the scene during playback...', baseTime + 3030000, ['/src/utils/videoRecorder.ts', '/src/store/index.ts']),
    ],
    terminalCommands: []
  });
  
  // Snapshot 7: UI polish
  snapshots.push({
    timestamp: new Date(baseTime + 3600000),
    commitHash: 'stu5678',
    commitMessage: 'Polish UI with timeline, stats, and controls',
    author: 'Developer',
    files: [
      ...snapshots[5].files.map(f => ({ ...f, status: 'unchanged' as const })),
      { ...snapshots[5].files.find(f => f.name === 'index.html')!, linesOfCode: 350, status: 'modified' as const },
      createFile('/src/styles/main.css', 'css', 400, 'added'),
    ],
    chats: [
      createChat('user', 'Add a beautiful dark theme UI with timeline controls', baseTime + 3600000, ['/index.html']),
      createChat('assistant', 'I\'ll create a polished dark theme with glassmorphism effects, smooth animations, and intuitive controls for timeline navigation and video export...', baseTime + 3630000, ['/index.html', '/src/styles/main.css']),
    ],
    terminalCommands: []
  });
  
  // Snapshot 8: Final touches
  snapshots.push({
    timestamp: new Date(baseTime + 4200000),
    commitHash: 'vwx9012',
    commitMessage: 'Add demo mode and keyboard shortcuts',
    author: 'Developer',
    files: [
      ...snapshots[6].files.map(f => ({ ...f, status: 'unchanged' as const })),
      createFile('/src/data/demoData.ts', 'ts', 180, 'added'),
      { ...snapshots[6].files.find(f => f.name === 'main.ts')!, linesOfCode: 450, status: 'modified' as const },
    ],
    chats: [
      createChat('user', 'Add a demo mode with sample data for showcasing', baseTime + 4200000, ['/src/data/demoData.ts']),
      createChat('assistant', 'I\'ll create a demo data generator that produces realistic project snapshots to showcase the visualization without requiring a real project folder...', baseTime + 4230000, ['/src/data/demoData.ts', '/src/main.ts']),
    ],
    terminalCommands: []
  });
  
  return snapshots;
}

function createFile(
  path: string,
  ext: string,
  lines: number,
  status: 'added' | 'modified' | 'deleted' | 'unchanged'
): FileNode {
  const parts = path.split('/');
  const name = parts[parts.length - 1];
  const directory = parts.slice(0, -1).join('/') || '/';
  
  return {
    path,
    name,
    extension: '.' + ext,
    linesOfCode: lines,
    directory,
    createdAt: new Date(),
    modifiedAt: new Date(),
    status
  };
}

let chatCounter = 0;

function createChat(
  role: 'user' | 'assistant',
  content: string,
  timestamp: number,
  relatedFiles: string[]
): ChatMessage {
  return {
    id: `demo-chat-${chatCounter++}`,
    timestamp: new Date(timestamp),
    role,
    content,
    relatedFiles
  };
}
