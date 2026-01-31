import * as THREE from 'three';
import { SceneManager } from './3d/scene';
import { CodeArchitecture } from './3d/codeArchitecture';
import { ChatBubbleManager } from './3d/chatBubbles';
import { store, getState, subscribe } from './store';
import { VideoRecorder, CameraPath } from './utils/videoRecorder';
import { 
  parseDroppedFolder, 
  generateHistoricalSnapshots 
} from './data/fileParser';
import { generateDemoProject } from './data/demoData';
import { loadProjectFromBackend, checkBackendAvailable } from './data/projectLoader';
import { api } from './api/client';
import { UIPanels } from './ui/panels';
import { DiscoveryPanel } from './ui/discovery';
import type { ProjectData, Building, ProjectSnapshot } from './types';

// Visualization mode
type VisualizationMode = 'city' | 'neural' | 'architecture';

// API base URL
const API_BASE = 'http://localhost:3333/api';

// ============================================
// MAIN APPLICATION
// ============================================

class VectorVisionApp {
  private sceneManager: SceneManager | null = null;
  private codeArchitecture: CodeArchitecture | null = null;
  private chatBubbleManager: ChatBubbleManager | null = null;
  private videoRecorder: VideoRecorder | null = null;
  private cameraPath: CameraPath | null = null;
  private playbackInterval: number | null = null;
  private cinematicAnimationId: number | null = null;
  
  // Visualization mode - default to new architecture mode
  private visualizationMode: VisualizationMode = 'architecture';
  
  // File contents cache
  private fileContentsCache: Record<string, { content: string; lines: string[]; functions: string[]; imports: string[] }> = {};
  private currentProjectPath: string = '';
  
  // UI Panels
  private uiPanels: UIPanels | null = null;
  private discoveryPanel: DiscoveryPanel | null = null;
  
  // DOM Elements
  private loadingEl: HTMLElement;
  private projectSelectorEl: HTMLElement;
  private timelineSlider: HTMLInputElement;
  private commitMessage: HTMLElement;
  private commitMeta: HTMLElement;
  private fileInfoPanel: HTMLElement;
  private pathInput: HTMLInputElement;
  private directoryList: HTMLElement;
  private currentPathEl: HTMLElement;
  
  // State
  private backendAvailable: boolean = false;
  private currentBrowsePath: string = '';
  
  // Stats elements
  private statFiles: HTMLElement;
  private statCommits: HTMLElement;
  private statLines: HTMLElement;
  private statChats: HTMLElement;
  
  // Token Counter & Message Popup
  private tokenCountEl: HTMLElement;
  private tokenCostEl: HTMLElement;
  private messagePopup: HTMLElement;
  private totalTokens: number = 0;
  private lastSnapshotIndex: number = -1;

  constructor() {
    // Get DOM elements
    this.loadingEl = document.getElementById('loading')!;
    this.projectSelectorEl = document.getElementById('project-selector')!;
    this.timelineSlider = document.getElementById('timeline-slider') as HTMLInputElement;
    this.commitMessage = document.getElementById('commit-message')!;
    this.commitMeta = document.getElementById('commit-meta')!;
    this.fileInfoPanel = document.getElementById('file-info')!;
    this.pathInput = document.getElementById('path-input') as HTMLInputElement;
    this.directoryList = document.getElementById('directory-list')!;
    this.currentPathEl = document.getElementById('current-path')!;
    
    this.statFiles = document.getElementById('stat-files')!;
    this.statCommits = document.getElementById('stat-commits')!;
    this.statLines = document.getElementById('stat-lines')!;
    this.statChats = document.getElementById('stat-chats')!;
    
    // Token Counter & Message Popup
    this.tokenCountEl = document.getElementById('token-count')!;
    this.tokenCostEl = document.getElementById('token-cost')!;
    this.messagePopup = document.getElementById('message-popup')!;
    
    this.init();
  }

  private async init(): Promise<void> {
    // Initialize 3D scene
    const container = document.getElementById('canvas-container')!;
    this.sceneManager = new SceneManager(container);
    
    // Initialize the main visualization (Code Architecture - combines city + neural)
    this.codeArchitecture = new CodeArchitecture(this.sceneManager.scene);
    
    // Keep legacy visualizations for mode switching
    // this.codeCity = new CodeCity(this.sceneManager.scene);
    // this.neuralNetwork = new NeuralNetworkVisualization(this.sceneManager.scene);
    this.chatBubbleManager = new ChatBubbleManager(this.sceneManager.scene);
    
    // Initialize video recorder
    this.videoRecorder = new VideoRecorder(this.sceneManager.renderer.domElement);
    this.videoRecorder.setStatusCallback((recording) => {
      store.getState().setIsRecording(recording);
      this.updateRecordingUI(recording);
    });
    
    // Setup scene callbacks
    this.sceneManager.onUpdate = (delta) => this.onSceneUpdate(delta);
    this.sceneManager.onHover = (obj) => this.onBuildingHover(obj);
    this.sceneManager.onClick = (obj) => this.onBuildingClick(obj);
    
    // Setup UI event listeners
    this.setupProjectSelector();
    this.setupTimeline();
    this.setupControls();
    this.setupKeyboardShortcuts();
    this.setupDemoButton();
    this.setupPanelToggles();
    
    // Initialize UI Panels
    this.uiPanels = new UIPanels();
    this.discoveryPanel = new DiscoveryPanel();
    
    // Check backend and setup
    this.initBackend();
    
    // Hide loading screen
    setTimeout(() => {
      this.loadingEl.classList.add('hidden');
    }, 500);
    
    // Subscribe to store changes
    subscribe((state, prevState) => {
      if (state.currentSnapshotIndex !== prevState.currentSnapshotIndex) {
        this.onSnapshotChange(state.currentSnapshotIndex);
      }
      if (state.showChatBubbles !== prevState.showChatBubbles) {
        this.chatBubbleManager?.setVisibility(state.showChatBubbles);
      }
    });
  }

  // Default demo project - Vector Vision itself!
  private static readonly DEMO_PROJECT_PATH = '/mnt/private1/ai-projects/hackathon-cursor-vector-vision/vector-vision';
  
  private async initBackend(): Promise<void> {
    const statusEl = document.getElementById('backend-status')!;
    
    this.backendAvailable = await checkBackendAvailable();
    
    if (this.backendAvailable) {
      statusEl.textContent = 'Backend connected - Loading demo...';
      statusEl.classList.add('connected');
      statusEl.classList.remove('disconnected');
      
      // Auto-load Vector Vision project as demo
      this.pathInput.value = VectorVisionApp.DEMO_PROJECT_PATH;
      await this.loadProjectFromPath(VectorVisionApp.DEMO_PROJECT_PATH);
      
      statusEl.textContent = 'Backend connected - Vector Vision loaded';
    } else {
      statusEl.textContent = 'Backend offline - Use drag & drop or demo';
      statusEl.classList.add('disconnected');
      statusEl.classList.remove('connected');
    }
  }

  private setupProjectSelector(): void {
    const folderInput = document.getElementById('folder-input') as HTMLInputElement;
    const dropZoneMini = document.getElementById('drop-zone-mini')!;
    const scanBtn = document.getElementById('btn-scan')!;
    const parentBtn = document.getElementById('btn-parent')!;
    
    // Scan button
    scanBtn.addEventListener('click', () => {
      const path = this.pathInput.value.trim();
      if (path) {
        this.loadProjectFromPath(path);
      }
    });
    
    // Enter key in path input
    this.pathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const path = this.pathInput.value.trim();
        if (path) {
          this.loadProjectFromPath(path);
        }
      }
    });
    
    // Parent directory button
    parentBtn.addEventListener('click', () => {
      if (this.currentBrowsePath) {
        const parent = this.currentBrowsePath.split('/').slice(0, -1).join('/') || '/';
        this.browseTo(parent);
      }
    });
    
    // Mini drop zone handlers
    dropZoneMini.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZoneMini.classList.add('dragover');
    });
    
    dropZoneMini.addEventListener('dragleave', () => {
      dropZoneMini.classList.remove('dragover');
    });
    
    dropZoneMini.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZoneMini.classList.remove('dragover');
      
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        await this.loadProjectFromFiles(files);
      }
    });
    
    dropZoneMini.addEventListener('click', () => {
      folderInput.click();
    });
    
    // File input handler
    folderInput.addEventListener('change', async () => {
      if (folderInput.files && folderInput.files.length > 0) {
        await this.loadProjectFromFiles(folderInput.files);
      }
    });
  }

  private async browseTo(dirPath: string): Promise<void> {
    if (!this.backendAvailable) return;
    
    try {
      const result = await api.browse(dirPath);
      
      this.currentBrowsePath = result.currentPath;
      this.currentPathEl.textContent = result.currentPath;
      this.pathInput.value = result.currentPath;
      
      // Render directory list
      this.directoryList.innerHTML = '';
      
      for (const dir of result.directories) {
        const item = document.createElement('div');
        item.className = 'dir-item' + (dir.isGitRepo ? ' git-repo' : '');
        item.innerHTML = `
          <span class="dir-icon">${dir.isGitRepo ? '📂' : '📁'}</span>
          <span class="dir-name">${dir.name}</span>
          ${dir.isGitRepo ? '<span class="dir-badge">Git</span>' : ''}
        `;
        
        // Double click to open project, single click to navigate
        item.addEventListener('click', () => {
          if (dir.isGitRepo) {
            this.pathInput.value = dir.path;
          } else {
            this.browseTo(dir.path);
          }
        });
        
        item.addEventListener('dblclick', () => {
          this.loadProjectFromPath(dir.path);
        });
        
        this.directoryList.appendChild(item);
      }
      
    } catch (error) {
      console.error('Browse error:', error);
      this.showToast('Failed to browse directory');
    }
  }

  private async loadProjectFromPath(projectPath: string): Promise<void> {
    if (!this.backendAvailable) {
      this.showToast('Backend not available');
      return;
    }
    
    try {
      store.getState().setLoading(true);
      this.projectSelectorEl.classList.add('hidden');
      this.showToast('Scanning project...');
      
      // Clear cache and store project path
      this.fileContentsCache = {};
      this.currentProjectPath = projectPath;
      
      const projectData = await loadProjectFromBackend(projectPath);
      
      // Reset token counter for new project
      this.resetTokenCounter();
      
      // Update store
      store.getState().setProjectData(projectData);
      
      // Update UI
      this.updateStats(projectData);
      this.updateTimeline(projectData);
      
      // Load final snapshot
      this.onSnapshotChange(projectData.snapshots.length - 1);
      
      this.showToast(`Loaded: ${projectData.name} (${projectData.snapshots.length} snapshots)`);
      console.log('Project loaded:', projectData.name);
      
    } catch (error) {
      console.error('Failed to load project:', error);
      this.showToast(error instanceof Error ? error.message : 'Failed to load project');
      this.projectSelectorEl.classList.remove('hidden');
    } finally {
      store.getState().setLoading(false);
    }
  }

  private async loadProjectFromFiles(files: FileList): Promise<void> {
    try {
      store.getState().setLoading(true);
      this.projectSelectorEl.classList.add('hidden');
      
      // Parse files
      const { files: fileNodes, chats, projectName } = await parseDroppedFolder(files);
      
      if (fileNodes.length === 0) {
        throw new Error('No valid files found in the selected folder');
      }
      
      // Generate historical snapshots from file modification times
      const snapshots = generateHistoricalSnapshots(fileNodes, chats);
      
      // Create project data
      const projectData: ProjectData = {
        name: projectName,
        path: '/',
        snapshots,
        currentIndex: snapshots.length - 1
      };
      
      // Reset token counter for new project
      this.resetTokenCounter();
      
      // Update store
      store.getState().setProjectData(projectData);
      
      // Update UI
      this.updateStats(projectData);
      this.updateTimeline(projectData);
      
      // Load initial snapshot
      this.onSnapshotChange(snapshots.length - 1);
      
      console.log(`Loaded project: ${projectName}`);
      console.log(`Files: ${fileNodes.length}, Snapshots: ${snapshots.length}, Chats: ${chats.length}`);
      
    } catch (error) {
      console.error('Failed to load project:', error);
      store.getState().setError(error instanceof Error ? error.message : 'Failed to load project');
      this.projectSelectorEl.classList.remove('hidden');
    } finally {
      store.getState().setLoading(false);
    }
  }

  private updateStats(projectData: ProjectData): void {
    const currentSnapshot = projectData.snapshots[projectData.snapshots.length - 1];
    
    const totalFiles = currentSnapshot.files.length;
    const totalCommits = projectData.snapshots.length;
    const totalLines = currentSnapshot.files.reduce((sum, f) => sum + f.linesOfCode, 0);
    const totalChats = currentSnapshot.chats.length;
    
    this.statFiles.textContent = totalFiles.toString();
    this.statCommits.textContent = totalCommits.toString();
    this.statLines.textContent = this.formatNumber(totalLines);
    this.statChats.textContent = totalChats.toString();
  }

  private updateTimeline(projectData: ProjectData): void {
    this.timelineSlider.max = (projectData.snapshots.length - 1).toString();
    this.timelineSlider.value = (projectData.snapshots.length - 1).toString();
    
    // Update markers
    const markersContainer = document.getElementById('timeline-markers')!;
    markersContainer.innerHTML = '';
    
    projectData.snapshots.forEach((snapshot, index) => {
      const marker = document.createElement('div');
      marker.className = 'commit-marker';
      const percentage = projectData.snapshots.length > 1 
        ? (index / (projectData.snapshots.length - 1)) * 100 
        : 50;
      marker.style.left = `${percentage}%`;
      
      // Height based on file changes
      const changedFiles = snapshot.files.filter(f => f.status !== 'unchanged').length;
      marker.style.height = `${Math.min(20, 5 + changedFiles * 2)}px`;
      
      markersContainer.appendChild(marker);
    });
  }

  private setupTimeline(): void {
    // Slider change
    this.timelineSlider.addEventListener('input', () => {
      const index = parseInt(this.timelineSlider.value);
      store.getState().setCurrentSnapshot(index);
    });
    
    // Play/Pause button
    document.getElementById('btn-play')!.addEventListener('click', () => {
      this.togglePlayback();
    });
    
    // Previous button
    document.getElementById('btn-prev')!.addEventListener('click', () => {
      store.getState().prevSnapshot();
    });
    
    // Next button
    document.getElementById('btn-next')!.addEventListener('click', () => {
      store.getState().nextSnapshot();
    });
  }

  private togglePlayback(): void {
    const state = getState();
    
    if (state.isPlaying) {
      // Stop playback
      if (this.playbackInterval) {
        clearInterval(this.playbackInterval);
        this.playbackInterval = null;
      }
      store.getState().setIsPlaying(false);
      document.getElementById('btn-play')!.innerHTML = '&#9654;';
    } else {
      // Start playback
      store.getState().setIsPlaying(true);
      document.getElementById('btn-play')!.innerHTML = '&#10074;&#10074;';
      
      // Reset to beginning if at end
      if (state.projectData && state.currentSnapshotIndex >= state.projectData.snapshots.length - 1) {
        store.getState().setCurrentSnapshot(0);
      }
      
      this.playbackInterval = window.setInterval(() => {
        const currentState = getState();
        if (!currentState.projectData) return;
        
        const nextIndex = currentState.currentSnapshotIndex + 1;
        
        if (nextIndex >= currentState.projectData.snapshots.length) {
          // Reached end, stop playback
          this.togglePlayback();
        } else {
          store.getState().setCurrentSnapshot(nextIndex);
        }
      }, state.playbackSpeed);
    }
  }

  private setupControls(): void {
    // Reset camera
    document.getElementById('btn-reset')!.addEventListener('click', () => {
      this.sceneManager?.resetCamera();
    });
    
    // Record button
    document.getElementById('btn-record')!.addEventListener('click', () => {
      this.toggleRecording();
    });
    
    // Cinematic button
    document.getElementById('btn-ar')!.addEventListener('click', () => {
      this.startCinematicMode();
    });
    
    // Chat toggle button
    document.getElementById('btn-chat')?.addEventListener('click', () => {
      this.toggleChatBubbles();
    });
    
    // Discovery button
    document.getElementById('btn-discover')?.addEventListener('click', () => {
      this.discoveryPanel?.toggle();
    });
  }

  private setupPanelToggles(): void {
    // File list toggle
    document.getElementById('toggle-files')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      btn.classList.toggle('active');
      this.uiPanels?.toggleFileList();
    });
    
    // Chat panel toggle
    document.getElementById('toggle-chatpanel')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      btn.classList.toggle('active');
      this.uiPanels?.toggleChatPanel();
    });
    
    // Visualization mode toggle
    document.getElementById('toggle-viz')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      this.toggleVisualizationMode();
      // Update button text
      btn.innerHTML = this.visualizationMode === 'neural' 
        ? '&#129504; Neural' 
        : '&#127961; City';
    });
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement) return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePlayback();
          break;
        case 'ArrowLeft':
          store.getState().prevSnapshot();
          break;
        case 'ArrowRight':
          store.getState().nextSnapshot();
          break;
        case 'KeyR':
          this.sceneManager?.resetCamera();
          this.showToast('Camera reset');
          break;
        case 'KeyC':
          this.toggleChatBubbles();
          this.showToast(getState().showChatBubbles ? 'Chat bubbles visible' : 'Chat bubbles hidden');
          break;
        case 'KeyV':
          this.toggleRecording();
          break;
        case 'KeyF':
          // Toggle file list panel
          this.uiPanels?.toggleFileList();
          document.getElementById('toggle-files')?.classList.toggle('active');
          break;
        case 'KeyG':
          // Toggle chat panel
          this.uiPanels?.toggleChatPanel();
          document.getElementById('toggle-chatpanel')?.classList.toggle('active');
          break;
        case 'KeyD':
          // Open discovery
          this.discoveryPanel?.toggle();
          break;
        case 'KeyM':
          // Start cinematic mode
          this.startCinematicMode();
          this.showToast('Cinematic mode started');
          break;
        case 'KeyN':
          // Toggle visualization mode
          this.toggleVisualizationMode();
          break;
        case 'KeyP':
          this.sceneManager?.togglePostProcessing();
          this.showToast(this.sceneManager?.usePostProcessing ? 'Effects enabled' : 'Effects disabled');
          break;
        case 'Slash':
        case 'Digit1':
          if (e.shiftKey) {
            this.toggleShortcutsPanel();
          }
          break;
        case 'Escape':
          // Close any open panels/modals
          this.discoveryPanel?.close();
          store.getState().setExpandedChat(null);
          break;
      }
    });
  }

  private setupDemoButton(): void {
    const demoBtn = document.getElementById('btn-demo');
    demoBtn?.addEventListener('click', () => {
      this.loadDemoProject();
    });
  }

  private async loadDemoProject(): Promise<void> {
    try {
      store.getState().setLoading(true);
      this.projectSelectorEl.classList.add('hidden');
      
      // LOAD LIVE DATA FROM THIS PROJECT ITSELF!
      // The visualization visualizes itself - meta!
      const selfPath = '/mnt/private1/ai-projects/hackathon-cursor-vector-vision/vector-vision';
      
      if (this.backendAvailable) {
        console.log('[Demo] Loading LIVE data from:', selfPath);
        
        // Load real project data from backend
        const projectData = await loadProjectFromBackend(selfPath);
        
        if (projectData) {
          this.currentProjectPath = selfPath;
          this.resetTokenCounter();
          store.getState().setProjectData(projectData);
          this.updateStats(projectData);
          this.updateTimeline(projectData);
          
          // Start from BEGINNING for replay effect! (index 0)
          store.getState().setCurrentSnapshot(0);
          this.onSnapshotChange(0);
          
          this.showToast('🎉 Visualizing ITSELF! Press Space to replay!');
          console.log('[Demo] Loaded', projectData.snapshots.length, 'message-snapshots');
          return;
        }
      }
      
      // Fallback to generated demo data if backend unavailable
      console.log('[Demo] Backend unavailable, using generated demo data');
      this.resetTokenCounter();
      const projectData = generateDemoProject();
      store.getState().setProjectData(projectData);
      this.updateStats(projectData);
      this.updateTimeline(projectData);
      store.getState().setCurrentSnapshot(0);
      this.onSnapshotChange(0);
      this.showToast('Demo project loaded! Press Space to play.');
      
    } catch (error) {
      console.error('Failed to load demo:', error);
      store.getState().setError('Failed to load demo');
      this.projectSelectorEl.classList.remove('hidden');
    } finally {
      store.getState().setLoading(false);
    }
  }

  private showToast(message: string, duration: number = 2000): void {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.classList.add('visible');
    
    setTimeout(() => {
      toast.classList.remove('visible');
    }, duration);
  }

  private toggleShortcutsPanel(): void {
    const panel = document.getElementById('shortcuts');
    panel?.classList.toggle('hidden');
  }

  private toggleChatBubbles(): void {
    const state = getState();
    store.getState().setShowChatBubbles(!state.showChatBubbles);
  }

  private async loadFileContents(filePaths: string[]): Promise<Record<string, { content: string; lines: string[]; functions: string[]; imports: string[] }>> {
    if (!this.currentProjectPath || !this.backendAvailable) {
      return this.fileContentsCache;
    }
    
    // Check which files we need to load
    const pathsToLoad = filePaths.filter(p => !this.fileContentsCache[p]);
    
    if (pathsToLoad.length === 0) {
      return this.fileContentsCache;
    }
    
    try {
      const response = await fetch(`${API_BASE}/files-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: this.currentProjectPath,
          filePaths: pathsToLoad
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.files) {
          Object.assign(this.fileContentsCache, data.files);
        }
      }
    } catch (error) {
      console.error('Failed to load file contents:', error);
    }
    
    return this.fileContentsCache;
  }

  // @ts-ignore - Will be used for future mode switching
  private setVisualizationMode(_mode: VisualizationMode): void {
    // Currently using unified Code Architecture visualization
    // Mode switching is available for future expansion
    this.showToast('Living Code Architecture');
  }

  private toggleVisualizationMode(): void {
    // Re-render with current mode
    const projectData = getState().projectData;
    if (projectData) {
      this.onSnapshotChange(getState().currentSnapshotIndex);
    }
    this.showToast('Visualization refreshed');
  }

  private toggleRecording(): void {
    if (!this.videoRecorder) return;
    
    const state = getState();
    
    if (state.isRecording) {
      // Stop and download
      this.videoRecorder.stopAndDownload(`vector-vision-${Date.now()}`);
    } else {
      // Start recording
      this.videoRecorder.startRecording();
    }
  }

  private updateRecordingUI(recording: boolean): void {
    const btn = document.getElementById('btn-record')!;
    if (recording) {
      btn.classList.add('recording');
      btn.title = 'Stop Recording';
    } else {
      btn.classList.remove('recording');
      btn.title = 'Record Video';
    }
  }

  private startCinematicMode(): void {
    if (!this.sceneManager) return;
    
    // Cancel any existing animation
    if (this.cinematicAnimationId) {
      cancelAnimationFrame(this.cinematicAnimationId);
    }
    
    // Create camera path
    this.cameraPath = CameraPath.createOrbitPath(0, 0, 25, 15, 15000);
    
    // Disable orbit controls during cinematic
    this.sceneManager.controls.enabled = false;
    
    const startTime = Date.now();
    const duration = this.cameraPath.getDuration();
    
    // Also start playback of timeline
    if (!getState().isPlaying && getState().projectData) {
      store.getState().setCurrentSnapshot(0);
      this.togglePlayback();
    }
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed >= duration) {
        // End cinematic mode
        this.sceneManager!.controls.enabled = true;
        this.cameraPath = null;
        return;
      }
      
      const pose = this.cameraPath!.getPositionAtTime(elapsed);
      if (pose && this.sceneManager) {
        this.sceneManager.camera.position.set(pose.position.x, pose.position.y, pose.position.z);
        this.sceneManager.controls.target.set(pose.target.x, pose.target.y, pose.target.z);
      }
      
      this.cinematicAnimationId = requestAnimationFrame(animate);
    };
    
    animate();
  }

  private onSnapshotChange(index: number): void {
    const projectData = getState().projectData;
    if (!projectData || !this.codeArchitecture) return;
    
    const snapshot = projectData.snapshots[index];
    const prevSnapshot = index > 0 ? projectData.snapshots[index - 1] : undefined;
    
    // Update timeline slider
    this.timelineSlider.value = index.toString();
    
    // Update commit info
    this.commitMessage.textContent = snapshot.commitMessage;
    this.commitMeta.textContent = `${snapshot.author} • ${this.formatDate(snapshot.timestamp)}`;
    
    // 🎬 SHOW MESSAGE POPUP & UPDATE TOKEN COUNTER
    this.showMessagePopup(snapshot, index);
    
    // Update 3D visualization with file contents
    if (this.codeArchitecture) {
      // Load file contents if we have a project path
      // NEW: Use message timeline system!
      if (snapshot.chats && snapshot.chats.length > 0) {
        this.codeArchitecture.updateWithMessageTimeline(snapshot);
      } else {
        // Fallback to old system if no messages
        if (this.currentProjectPath && this.backendAvailable) {
          this.loadFileContents(snapshot.files.map(f => f.path)).then(contents => {
            this.codeArchitecture?.updateFromSnapshot(snapshot, contents);
          });
        } else {
          this.codeArchitecture.updateFromSnapshot(snapshot);
        }
      }
    }
    
    // Update UI panels
    if (this.uiPanels) {
      this.uiPanels.updateFiles(snapshot, prevSnapshot);
      
      // Collect all chats from all snapshots for timeline
      const allChats = projectData.snapshots.flatMap(s => s.chats);
      this.uiPanels.updateChats(snapshot.chats, allChats);
    }
    
    // Update stats for current snapshot
    const totalLines = snapshot.files.reduce((sum, f) => sum + f.linesOfCode, 0);
    this.statFiles.textContent = snapshot.files.length.toString();
    this.statLines.textContent = this.formatNumber(totalLines);
    this.statChats.textContent = snapshot.chats.length.toString();
  }
  
  /**
   * Show message popup and update token counter during replay
   */
  private showMessagePopup(snapshot: ProjectSnapshot, index: number): void {
    // Get the latest message from this snapshot
    const latestChat = snapshot.chats[snapshot.chats.length - 1];
    if (!latestChat) return;
    
    // Only show popup if we're moving forward (not backward)
    const isForward = index > this.lastSnapshotIndex;
    this.lastSnapshotIndex = index;
    
    // Calculate tokens for this step
    const prevChats = index > 0 ? 
      getState().projectData?.snapshots[index - 1]?.chats || [] : [];
    const newChats = snapshot.chats.filter(
      c => !prevChats.some(p => p.id === c.id)
    );
    
    // Sum up token costs from new messages
    const newTokens = newChats.reduce((sum, chat) => {
      // Estimate token cost if not provided
      const cost = (chat as any).tokenCost || Math.ceil(chat.content.length / 4);
      return sum + cost;
    }, 0);
    
    // Update total tokens (only when moving forward)
    if (isForward && newTokens > 0) {
      this.totalTokens += newTokens;
      this.animateTokenCounter(newTokens);
    }
    
    // Update token display
    this.tokenCountEl.textContent = this.formatNumber(this.totalTokens);
    // Estimate cost: ~$0.015 per 1K tokens (average)
    const estimatedCost = (this.totalTokens / 1000) * 0.015;
    this.tokenCostEl.textContent = estimatedCost.toFixed(2);
    
    // Show message popup
    const roleIcon = latestChat.role === 'user' ? '👤' : '🤖';
    const popup = this.messagePopup;
    
    // Update popup content
    popup.querySelector('.message-popup-icon')!.textContent = roleIcon;
    popup.querySelector('.message-popup-role')!.textContent = 
      latestChat.role === 'user' ? 'User' : 'Assistant';
    popup.querySelector('.message-popup-text')!.textContent = 
      latestChat.content.slice(0, 200) + (latestChat.content.length > 200 ? '...' : '');
    popup.querySelector('.cost-tokens')!.textContent = 
      newTokens > 0 ? `+${this.formatNumber(newTokens)}` : '—';
    
    // Set role class for styling
    popup.classList.remove('user', 'assistant', 'hidden');
    popup.classList.add(latestChat.role);
    
    // Animate in
    requestAnimationFrame(() => {
      popup.classList.add('visible');
    });
    
    // Auto-hide after delay (unless playing)
    if (!getState().isPlaying) {
      setTimeout(() => {
        popup.classList.remove('visible');
      }, 3000);
    }
  }
  
  /**
   * Animate the token counter when tokens are added
   */
  private animateTokenCounter(_addedTokens: number): void {
    // Add counting animation class
    this.tokenCountEl.classList.add('counting');
    
    // Flash the counter
    const counter = document.getElementById('token-counter');
    if (counter) {
      counter.style.transform = 'translateX(-50%) scale(1.05)';
      counter.style.borderColor = 'rgba(255, 235, 59, 0.8)';
      
      setTimeout(() => {
        counter.style.transform = 'translateX(-50%) scale(1)';
        counter.style.borderColor = 'rgba(255, 193, 7, 0.3)';
        this.tokenCountEl.classList.remove('counting');
      }, 300);
    }
  }
  
  /**
   * Reset token counter when loading new project
   */
  private resetTokenCounter(): void {
    this.totalTokens = 0;
    this.lastSnapshotIndex = -1;
    this.tokenCountEl.textContent = '0';
    this.tokenCostEl.textContent = '0.00';
    this.messagePopup.classList.add('hidden');
    this.messagePopup.classList.remove('visible');
  }

  private onSceneUpdate(delta: number): void {
    this.codeArchitecture?.update(delta);
  }

  private onBuildingHover(object: THREE.Object3D | null): void {
    if (object && object.userData.isBuilding) {
      const filePath = object.userData.filePath;
      const buildings = this.codeArchitecture?.getAllBuildings() || [];
      const building = buildings.find(b => b.id === filePath);
      
      if (building) {
        // Create a compatible Building object for the store
        const compatBuilding = {
          id: building.id,
          mesh: building.mesh,
          fileNode: building.fileNode,
          position: building.position,
          height: building.height,
          baseHeight: 0,
          targetHeight: building.height,
          width: 2,
          depth: 2,
          color: new THREE.Color(0x4fc3f7),
          status: 'stable' as const,
          animationProgress: 1,
          glowMesh: building.glowMesh,
        } as Building;
        store.getState().setHoveredBuilding(compatBuilding);
        this.showFileInfo(compatBuilding);
        document.body.style.cursor = 'pointer';
      }
    } else {
      store.getState().setHoveredBuilding(null);
      this.hideFileInfo();
      document.body.style.cursor = 'default';
    }
  }

  private onBuildingClick(object: THREE.Object3D | null): void {
    if (object && object.userData.isBuilding) {
      const filePath = object.userData.filePath;
      const buildings = this.codeArchitecture?.getAllBuildings() || [];
      const building = buildings.find(b => b.id === filePath);
      
      if (building) {
        const compatBuilding = {
          id: building.id,
          mesh: building.mesh,
          fileNode: building.fileNode,
          position: building.position,
          height: building.height,
          baseHeight: 0,
          targetHeight: building.height,
          width: 2,
          depth: 2,
          color: new THREE.Color(0x4fc3f7),
          status: 'stable' as const,
          animationProgress: 1,
          glowMesh: building.glowMesh,
        } as Building;
        store.getState().setSelectedBuilding(compatBuilding);
        this.sceneManager?.focusOnPoint(building.position);
      }
    } else {
      store.getState().setSelectedBuilding(null);
    }
  }

  private showFileInfo(building: Building): void {
    const file = building.fileNode;
    
    document.getElementById('file-name')!.textContent = file.name;
    document.getElementById('file-path')!.textContent = file.directory;
    document.getElementById('file-lines')!.textContent = file.linesOfCode.toString();
    document.getElementById('file-status')!.textContent = this.capitalizeFirst(file.status);
    
    this.fileInfoPanel.classList.add('visible');
  }

  private hideFileInfo(): void {
    this.fileInfoPanel.classList.remove('visible');
  }

  // Utility methods
  private formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// ============================================
// INITIALIZE APP
// ============================================

declare global {
  interface Window {
    app: VectorVisionApp;
  }
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new VectorVisionApp();
});
