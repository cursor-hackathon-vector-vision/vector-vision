import { createStore } from 'zustand/vanilla';
import type { ProjectData, Building, ChatMessage } from '../types';

// ============================================
// MULTI-PROJECT TYPES
// ============================================

export interface MultiProjectData {
  id: string;
  data: ProjectData;
  color: string;
  visible: boolean;
  position: { x: number; z: number };
}

export interface UnifiedTimelineEvent {
  timestamp: Date;
  projectId: string;
  projectName: string;
  type: 'commit' | 'chat' | 'file_change';
  description: string;
  snapshotIndex: number;
  chatMessage?: ChatMessage;
}

// Project colors for multi-project view
const PROJECT_COLORS = [
  '#667eea', // Purple
  '#48bb78', // Green
  '#ed8936', // Orange
  '#e53e3e', // Red
  '#38b2ac', // Teal
  '#9f7aea', // Violet
  '#ed64a6', // Pink
  '#4299e1', // Blue
];

// ============================================
// APP STATE TYPE
// ============================================

export interface AppState {
  // Data - Single project (legacy)
  projectData: ProjectData | null;
  
  // Data - Multi project
  projects: MultiProjectData[];
  unifiedTimeline: UnifiedTimelineEvent[];
  unifiedTimelineIndex: number;
  
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
  mediaRecorder: MediaRecorder | null;
  recordedChunks: Blob[];
  
  // AR
  arEnabled: boolean;
  arSupported: boolean;
  
  // Chat bubbles
  showChatBubbles: boolean;
  activeChatIndex: number;
  
  // UI Panels
  showFileList: boolean;
  showChatPanel: boolean;
  expandedChat: ChatMessage | null;
}

// ============================================
// STORE ACTIONS
// ============================================

export interface AppActions {
  setProjectData: (data: ProjectData) => void;
  setCurrentSnapshot: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setSelectedBuilding: (building: Building | null) => void;
  setHoveredBuilding: (building: Building | null) => void;
  setIsRecording: (recording: boolean) => void;
  setMediaRecorder: (recorder: MediaRecorder | null) => void;
  addRecordedChunk: (chunk: Blob) => void;
  clearRecordedChunks: () => void;
  setArEnabled: (enabled: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setShowChatBubbles: (show: boolean) => void;
  setActiveChatIndex: (index: number) => void;
  nextSnapshot: () => void;
  prevSnapshot: () => void;
  
  // Multi-project actions
  addProject: (data: ProjectData) => void;
  removeProject: (id: string) => void;
  toggleProjectVisibility: (id: string) => void;
  setUnifiedTimelineIndex: (index: number) => void;
  nextTimelineEvent: () => void;
  prevTimelineEvent: () => void;
  buildUnifiedTimeline: () => void;
  
  // UI Panel actions
  setShowFileList: (show: boolean) => void;
  setShowChatPanel: (show: boolean) => void;
  setExpandedChat: (chat: ChatMessage | null) => void;
}

export type Store = AppState & AppActions;

// ============================================
// CREATE STORE (Vanilla - no React dependency)
// ============================================

export const store = createStore<Store>((set, get) => ({
  // Initial State
  projectData: null,
  projects: [],
  unifiedTimeline: [],
  unifiedTimelineIndex: 0,
  isLoading: false,
  error: null,
  currentSnapshotIndex: 0,
  isPlaying: false,
  playbackSpeed: 1500,
  selectedBuilding: null,
  hoveredBuilding: null,
  cameraMode: 'orbit',
  isRecording: false,
  mediaRecorder: null,
  recordedChunks: [],
  arEnabled: false,
  arSupported: false,
  showChatBubbles: true,
  activeChatIndex: -1,
  showFileList: true,
  showChatPanel: true,
  expandedChat: null,
  
  // Actions
  setProjectData: (data: ProjectData) => set({ 
    projectData: data, 
    currentSnapshotIndex: data.snapshots.length - 1,
    error: null 
  }),
  
  setCurrentSnapshot: (index: number) => {
    const state = get();
    if (!state.projectData) return;
    const maxIndex = state.projectData.snapshots.length - 1;
    set({ currentSnapshotIndex: Math.max(0, Math.min(index, maxIndex)) });
  },
  
  nextSnapshot: () => {
    const state = get();
    if (!state.projectData) return;
    const maxIndex = state.projectData.snapshots.length - 1;
    if (state.currentSnapshotIndex < maxIndex) {
      set({ currentSnapshotIndex: state.currentSnapshotIndex + 1 });
    }
  },
  
  prevSnapshot: () => {
    const state = get();
    if (state.currentSnapshotIndex > 0) {
      set({ currentSnapshotIndex: state.currentSnapshotIndex - 1 });
    }
  },
  
  setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),
  setSelectedBuilding: (building: Building | null) => set({ selectedBuilding: building }),
  setHoveredBuilding: (building: Building | null) => set({ hoveredBuilding: building }),
  setIsRecording: (recording: boolean) => set({ isRecording: recording }),
  setMediaRecorder: (recorder: MediaRecorder | null) => set({ mediaRecorder: recorder }),
  addRecordedChunk: (chunk: Blob) => set(state => ({ 
    recordedChunks: [...state.recordedChunks, chunk] 
  })),
  clearRecordedChunks: () => set({ recordedChunks: [] }),
  setArEnabled: (enabled: boolean) => set({ arEnabled: enabled }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setError: (error: string | null) => set({ error, isLoading: false }),
  setShowChatBubbles: (show: boolean) => set({ showChatBubbles: show }),
  setActiveChatIndex: (index: number) => set({ activeChatIndex: index }),
  
  // Multi-project actions
  addProject: (data: ProjectData) => {
    const state = get();
    
    // Generate unique ID
    const id = `project-${Date.now()}`;
    
    // Calculate position (grid layout)
    const index = state.projects.length;
    const gridSize = 150;
    const x = (index % 3) * gridSize - gridSize;
    const z = Math.floor(index / 3) * gridSize;
    
    const newProject: MultiProjectData = {
      id,
      data,
      color: PROJECT_COLORS[index % PROJECT_COLORS.length],
      visible: true,
      position: { x, z }
    };
    
    set({ 
      projects: [...state.projects, newProject],
      // Also set as main project if first
      projectData: state.projectData || data,
      currentSnapshotIndex: (state.projectData || data).snapshots.length - 1
    });
    
    // Rebuild unified timeline
    get().buildUnifiedTimeline();
  },
  
  removeProject: (id: string) => {
    const state = get();
    set({ 
      projects: state.projects.filter(p => p.id !== id) 
    });
    get().buildUnifiedTimeline();
  },
  
  toggleProjectVisibility: (id: string) => {
    const state = get();
    set({
      projects: state.projects.map(p => 
        p.id === id ? { ...p, visible: !p.visible } : p
      )
    });
  },
  
  setUnifiedTimelineIndex: (index: number) => {
    const state = get();
    const maxIndex = Math.max(0, state.unifiedTimeline.length - 1);
    set({ unifiedTimelineIndex: Math.max(0, Math.min(index, maxIndex)) });
  },
  
  nextTimelineEvent: () => {
    const state = get();
    if (state.unifiedTimelineIndex < state.unifiedTimeline.length - 1) {
      set({ unifiedTimelineIndex: state.unifiedTimelineIndex + 1 });
    }
  },
  
  prevTimelineEvent: () => {
    const state = get();
    if (state.unifiedTimelineIndex > 0) {
      set({ unifiedTimelineIndex: state.unifiedTimelineIndex - 1 });
    }
  },
  
  buildUnifiedTimeline: () => {
    const state = get();
    const events: UnifiedTimelineEvent[] = [];
    
    for (const project of state.projects) {
      if (!project.visible) continue;
      
      project.data.snapshots.forEach((snapshot, snapshotIndex) => {
        // Add commit event
        if (snapshot.commitHash) {
          events.push({
            timestamp: snapshot.timestamp,
            projectId: project.id,
            projectName: project.data.name,
            type: 'commit',
            description: snapshot.commitMessage || 'Commit',
            snapshotIndex
          });
        }
        
        // Add chat events
        for (const chat of snapshot.chats) {
          events.push({
            timestamp: chat.timestamp,
            projectId: project.id,
            projectName: project.data.name,
            type: 'chat',
            description: chat.content.slice(0, 80),
            snapshotIndex,
            chatMessage: chat
          });
        }
      });
    }
    
    // Sort by timestamp
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    set({ unifiedTimeline: events, unifiedTimelineIndex: 0 });
  },
  
  // UI Panel actions
  setShowFileList: (show: boolean) => set({ showFileList: show }),
  setShowChatPanel: (show: boolean) => set({ showChatPanel: show }),
  setExpandedChat: (chat: ChatMessage | null) => set({ expandedChat: chat })
}));

// Helper to get current state
export const getState = () => store.getState();

// Helper to subscribe to state changes
export const subscribe = store.subscribe;
