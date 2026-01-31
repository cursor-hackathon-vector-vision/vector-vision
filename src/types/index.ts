import * as THREE from 'three';

// ============================================
// DATA TYPES
// ============================================

export interface ProjectData {
  name: string;
  path: string;
  snapshots: ProjectSnapshot[];
  currentIndex: number;
}

export interface ProjectSnapshot {
  timestamp: Date;
  commitHash: string;
  commitMessage: string;
  author: string;
  files: FileNode[];
  chats: ChatMessage[];
  terminalCommands: TerminalCommand[];
}

export interface FileNode {
  path: string;
  name: string;
  extension: string;
  linesOfCode: number;
  directory: string;
  createdAt: Date;
  modifiedAt: Date;
  status: 'added' | 'modified' | 'deleted' | 'unchanged';
  content?: string;
  diff?: string;
}

export interface ChatMessage {
  id: string;
  timestamp: Date;
  role: 'user' | 'assistant';
  content: string;
  relatedFiles: string[];
  model?: string;
}

export interface TerminalCommand {
  timestamp: Date;
  command: string;
  output: string;
  exitCode: number;
  duration: number;
}

// ============================================
// 3D SCENE TYPES
// ============================================

export interface Building {
  id: string;
  fileNode: FileNode;
  position: THREE.Vector3;
  height: number;
  baseHeight: number;
  targetHeight: number;
  width: number;
  depth: number;
  color: THREE.Color;
  mesh: THREE.Mesh;
  label?: THREE.Sprite;
  status: 'growing' | 'stable' | 'shrinking' | 'destroying';
  animationProgress: number;
}

export interface District {
  id: string;
  directory: string;
  buildings: Building[];
  position: THREE.Vector3;
  bounds: THREE.Box3;
  ground?: THREE.Mesh;
  label?: THREE.Sprite;
}

export interface ChatBubble3D {
  id: string;
  chat: ChatMessage;
  position: THREE.Vector3;
  targetBuilding: Building | null;
  mesh: THREE.Sprite;
  connectionLine?: THREE.Line;
  visible: boolean;
}

// ============================================
// UI STATE
// ============================================

export interface AppState {
  // Data
  projectData: ProjectData | null;
  isLoading: boolean;
  error: string | null;
  
  // Timeline
  currentSnapshotIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  
  // 3D Scene
  selectedBuilding: Building | null;
  hoveredBuilding: Building | null;
  cameraMode: 'orbit' | 'fly' | 'follow' | 'cinematic';
  
  // Recording
  isRecording: boolean;
  
  // AR
  arEnabled: boolean;
  arSupported: boolean;
  
  // Actions
  setProjectData: (data: ProjectData) => void;
  setCurrentSnapshot: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setSelectedBuilding: (building: Building | null) => void;
  setHoveredBuilding: (building: Building | null) => void;
  setIsRecording: (recording: boolean) => void;
  setArEnabled: (enabled: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// ============================================
// FILE TYPE COLORS
// ============================================

export const FILE_COLORS: Record<string, number> = {
  // TypeScript/JavaScript
  '.ts': 0x3178c6,
  '.tsx': 0x3178c6,
  '.js': 0xf7df1e,
  '.jsx': 0xf7df1e,
  '.mjs': 0xf7df1e,
  '.cjs': 0xf7df1e,
  
  // Styles
  '.css': 0xcc6699,
  '.scss': 0xcc6699,
  '.sass': 0xcc6699,
  '.less': 0xcc6699,
  '.styl': 0xcc6699,
  
  // Markup
  '.html': 0xe34c26,
  '.htm': 0xe34c26,
  '.vue': 0x42b883,
  '.svelte': 0xff3e00,
  
  // Data
  '.json': 0x4caf50,
  '.yaml': 0x4caf50,
  '.yml': 0x4caf50,
  '.xml': 0x4caf50,
  '.toml': 0x4caf50,
  
  // Documentation
  '.md': 0x888888,
  '.mdx': 0x888888,
  '.txt': 0x888888,
  
  // Python
  '.py': 0x3776ab,
  '.pyw': 0x3776ab,
  '.pyx': 0x3776ab,
  
  // Rust
  '.rs': 0xdea584,
  
  // Go
  '.go': 0x00add8,
  
  // Ruby
  '.rb': 0xcc342d,
  
  // PHP
  '.php': 0x777bb4,
  
  // Java/Kotlin
  '.java': 0xb07219,
  '.kt': 0x7f52ff,
  '.kts': 0x7f52ff,
  
  // C/C++
  '.c': 0x555555,
  '.cpp': 0x555555,
  '.h': 0x555555,
  '.hpp': 0x555555,
  
  // Shell
  '.sh': 0x89e051,
  '.bash': 0x89e051,
  '.zsh': 0x89e051,
  
  // Config
  '.env': 0xecd53f,
  '.gitignore': 0xf05032,
  
  // Images
  '.svg': 0xffb13b,
  '.png': 0x89cff0,
  '.jpg': 0x89cff0,
  '.jpeg': 0x89cff0,
  '.gif': 0x89cff0,
  '.webp': 0x89cff0,
  
  // Default
  'default': 0xffffff
};

export function getFileColor(extension: string): number {
  return FILE_COLORS[extension.toLowerCase()] || FILE_COLORS['default'];
}

// ============================================
// CONSTANTS
// ============================================

export const SCENE_CONFIG = {
  // Building dimensions
  BUILDING_BASE_SIZE: 1,
  BUILDING_HEIGHT_SCALE: 0.02, // Height per line of code
  BUILDING_MIN_HEIGHT: 0.5,
  BUILDING_MAX_HEIGHT: 15,
  BUILDING_GAP: 0.3,
  
  // District layout
  DISTRICT_PADDING: 2,
  DISTRICT_GAP: 3,
  
  // Animation
  ANIMATION_DURATION: 1000, // ms
  PLAYBACK_SPEED: 2000, // ms between commits
  
  // Camera
  CAMERA_FOV: 60,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 1000,
  CAMERA_INITIAL_POSITION: { x: 20, y: 20, z: 20 },
  
  // Colors
  GROUND_COLOR: 0x1a1a24,
  AMBIENT_LIGHT_COLOR: 0xffffff,
  AMBIENT_LIGHT_INTENSITY: 0.4,
  DIRECTIONAL_LIGHT_COLOR: 0xffffff,
  DIRECTIONAL_LIGHT_INTENSITY: 0.8,
  
  // Effects
  PARTICLE_COUNT: 50,
  GLOW_INTENSITY: 0.5
};
