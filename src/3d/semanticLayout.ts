import * as THREE from 'three';

/**
 * SEMANTIC LAYOUT ENGINE
 * 
 * Everything has meaning:
 * - Main road = Timeline (X-axis)
 * - Trees = Chat entries
 * - North = Source code files
 * - South = Assets/Config files
 * - Branches = Directories
 */

export interface SemanticFileData {
  path: string;
  name: string;
  directory: string;
  extension: string;
  linesOfCode: number;
  imports?: string[];
  createdAt?: number;
  modifiedAt?: number;
}

export interface ChatEntry {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  relatedFiles?: string[];
}

export interface DirectoryBranch {
  name: string;
  path: string;
  side: 'north' | 'south';
  startX: number;  // Where it branches from main road
  files: SemanticFileData[];
}

export interface SemanticLayout {
  timeline: {
    startTime: number;
    endTime: number;
    totalLength: number;
  };
  branches: DirectoryBranch[];
  chatTrees: ChatTreePosition[];
  buildings: BuildingPosition[];
}

export interface ChatTreePosition {
  chat: ChatEntry;
  x: number;
  z: number;
  treeType: 'pine' | 'round' | 'cyber';
  scale: number;
}

export interface BuildingPosition {
  file: SemanticFileData;
  x: number;
  z: number;
  branch: string;
}

// Source code extensions (North side)
const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h',
  '.rb', '.php', '.swift', '.kt', '.scala'
]);

/**
 * Semantic Layout Calculator
 */
export class SemanticLayoutEngine {
  private roadLength: number;
  private branchSpacing: number;
  private buildingSpacing: number;
  
  constructor(roadLength: number = 400) {
    this.roadLength = roadLength;
    this.branchSpacing = 30;
    this.buildingSpacing = 8;
  }
  
  /**
   * Calculate complete semantic layout
   */
  public calculateLayout(
    files: SemanticFileData[],
    chats: ChatEntry[]
  ): SemanticLayout {
    // 1. Determine timeline bounds
    const timeline = this.calculateTimeline(files, chats);
    
    // 2. Classify files by side (source vs assets)
    const { sourceFiles, assetFiles } = this.classifyFiles(files);
    
    // 3. Group files by directory and create branches
    const branches = this.createBranches(sourceFiles, assetFiles, timeline);
    
    // 4. Position buildings along branches
    const buildings = this.positionBuildings(branches, timeline);
    
    // 5. Position chat trees along the road
    const chatTrees = this.positionChatTrees(chats, timeline);
    
    return { timeline, branches, chatTrees, buildings };
  }
  
  /**
   * Calculate timeline bounds from files and chats
   */
  private calculateTimeline(
    files: SemanticFileData[],
    chats: ChatEntry[]
  ): { startTime: number; endTime: number; totalLength: number } {
    let minTime = Date.now();
    let maxTime = 0;
    
    for (const file of files) {
      if (file.createdAt) {
        minTime = Math.min(minTime, file.createdAt);
        maxTime = Math.max(maxTime, file.createdAt);
      }
      if (file.modifiedAt) {
        maxTime = Math.max(maxTime, file.modifiedAt);
      }
    }
    
    for (const chat of chats) {
      if (chat.timestamp) {
        minTime = Math.min(minTime, chat.timestamp);
        maxTime = Math.max(maxTime, chat.timestamp);
      }
    }
    
    // Default to now if no timestamps
    if (minTime === Date.now()) {
      minTime = Date.now() - 86400000; // 24h ago
    }
    if (maxTime === 0) {
      maxTime = Date.now();
    }
    
    return {
      startTime: minTime,
      endTime: maxTime,
      totalLength: this.roadLength
    };
  }
  
  /**
   * Classify files into source code vs assets/config
   */
  private classifyFiles(files: SemanticFileData[]): {
    sourceFiles: SemanticFileData[];
    assetFiles: SemanticFileData[];
  } {
    const sourceFiles: SemanticFileData[] = [];
    const assetFiles: SemanticFileData[] = [];
    
    for (const file of files) {
      const ext = file.extension.toLowerCase();
      if (SOURCE_EXTENSIONS.has(ext)) {
        sourceFiles.push(file);
      } else {
        assetFiles.push(file);
      }
    }
    
    return { sourceFiles, assetFiles };
  }
  
  /**
   * Create directory branches
   */
  private createBranches(
    sourceFiles: SemanticFileData[],
    assetFiles: SemanticFileData[],
    timeline: { startTime: number; endTime: number; totalLength: number }
  ): DirectoryBranch[] {
    const branches: DirectoryBranch[] = [];
    
    // Group source files by directory
    const sourceDirs = this.groupByDirectory(sourceFiles);
    const assetDirs = this.groupByDirectory(assetFiles);
    
    // Create north branches (source code)
    let northIndex = 0;
    for (const [dirPath, dirFiles] of sourceDirs) {
      const avgTime = this.getAverageTime(dirFiles);
      const startX = this.timeToX(avgTime, timeline);
      
      branches.push({
        name: dirPath.split('/').pop() || dirPath,
        path: dirPath,
        side: 'north',
        startX,
        files: dirFiles
      });
      northIndex++;
    }
    
    // Create south branches (assets/config)
    let southIndex = 0;
    for (const [dirPath, dirFiles] of assetDirs) {
      const avgTime = this.getAverageTime(dirFiles);
      const startX = this.timeToX(avgTime, timeline);
      
      branches.push({
        name: dirPath.split('/').pop() || dirPath,
        path: dirPath,
        side: 'south',
        startX,
        files: dirFiles
      });
      southIndex++;
    }
    
    return branches;
  }
  
  /**
   * Group files by their directory
   */
  private groupByDirectory(files: SemanticFileData[]): Map<string, SemanticFileData[]> {
    const groups = new Map<string, SemanticFileData[]>();
    
    for (const file of files) {
      const dir = file.directory || '/';
      if (!groups.has(dir)) {
        groups.set(dir, []);
      }
      groups.get(dir)!.push(file);
    }
    
    return groups;
  }
  
  /**
   * Get average creation time of files
   */
  private getAverageTime(files: SemanticFileData[]): number {
    let sum = 0;
    let count = 0;
    
    for (const file of files) {
      if (file.createdAt) {
        sum += file.createdAt;
        count++;
      }
    }
    
    return count > 0 ? sum / count : Date.now();
  }
  
  /**
   * Convert timestamp to X position on road
   */
  private timeToX(
    timestamp: number,
    timeline: { startTime: number; endTime: number; totalLength: number }
  ): number {
    const duration = timeline.endTime - timeline.startTime;
    if (duration === 0) return 0;
    
    const t = (timestamp - timeline.startTime) / duration;
    return -timeline.totalLength / 2 + t * timeline.totalLength;
  }
  
  /**
   * Position buildings along their branches
   */
  private positionBuildings(
    branches: DirectoryBranch[],
    timeline: { startTime: number; endTime: number; totalLength: number }
  ): BuildingPosition[] {
    const buildings: BuildingPosition[] = [];
    
    // Track branch positions to avoid overlap
    const northBranchZ: number[] = [];
    const southBranchZ: number[] = [];
    
    for (const branch of branches) {
      // Calculate Z position for this branch
      let baseZ: number;
      if (branch.side === 'north') {
        const index = northBranchZ.length;
        baseZ = 25 + index * this.branchSpacing;
        northBranchZ.push(baseZ);
      } else {
        const index = southBranchZ.length;
        baseZ = -25 - index * this.branchSpacing;
        southBranchZ.push(baseZ);
      }
      
      // Sort files by creation time
      const sortedFiles = [...branch.files].sort((a, b) => 
        (a.createdAt || 0) - (b.createdAt || 0)
      );
      
      // Position each file
      for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i];
        
        // X = time-based or sequential along branch
        let x: number;
        if (file.createdAt) {
          x = this.timeToX(file.createdAt, timeline);
        } else {
          // Distribute along branch
          x = branch.startX + i * this.buildingSpacing;
        }
        
        buildings.push({
          file,
          x,
          z: baseZ,
          branch: branch.path
        });
      }
    }
    
    return buildings;
  }
  
  /**
   * Position chat trees along the roadside
   */
  private positionChatTrees(
    chats: ChatEntry[],
    timeline: { startTime: number; endTime: number; totalLength: number }
  ): ChatTreePosition[] {
    const trees: ChatTreePosition[] = [];
    
    // Alternate sides for trees
    let sideToggle = true;
    
    for (const chat of chats) {
      const x = this.timeToX(chat.timestamp, timeline);
      const z = sideToggle ? 12 : -12; // Just outside sidewalk
      
      // Tree type based on role
      let treeType: 'pine' | 'round' | 'cyber';
      if (chat.role === 'user') {
        treeType = 'pine';
      } else if (chat.role === 'assistant') {
        treeType = 'round';
      } else {
        treeType = 'cyber'; // tool calls
      }
      
      // Scale based on content length
      const scale = 0.5 + Math.min(chat.content.length / 500, 1.5);
      
      trees.push({
        chat,
        x,
        z,
        treeType,
        scale
      });
      
      sideToggle = !sideToggle;
    }
    
    return trees;
  }
}

/**
 * Create a chat tree mesh
 */
export function createChatTree(
  position: ChatTreePosition,
  createPineTree: () => THREE.Group,
  createRoundTree: () => THREE.Group,
  createCyberTree: () => THREE.Group
): THREE.Group {
  let tree: THREE.Group;
  
  switch (position.treeType) {
    case 'pine':
      tree = createPineTree();
      break;
    case 'round':
      tree = createRoundTree();
      break;
    case 'cyber':
      tree = createCyberTree();
      break;
  }
  
  tree.scale.setScalar(position.scale);
  tree.position.set(position.x, 0, position.z);
  
  // Store chat data for hover/click
  tree.userData = {
    isChatTree: true,
    chat: position.chat
  };
  
  return tree;
}

/**
 * Create a directory branch road
 */
export function createBranchRoad(branch: DirectoryBranch): THREE.Group {
  const group = new THREE.Group();
  
  const branchLength = Math.max(branch.files.length * 8, 30);
  const direction = branch.side === 'north' ? 1 : -1;
  
  // Road surface
  const roadGeom = new THREE.PlaneGeometry(6, branchLength);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.8,
  });
  const road = new THREE.Mesh(roadGeom, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.rotation.z = Math.PI / 2; // Perpendicular to main road
  road.position.set(branch.startX, 0.02, direction * (15 + branchLength / 2));
  group.add(road);
  
  // Center stripe
  const stripeGeom = new THREE.PlaneGeometry(0.2, branchLength);
  const stripeMat = new THREE.MeshBasicMaterial({
    color: branch.side === 'north' ? 0x4fc3f7 : 0xff9800,
    transparent: true,
    opacity: 0.8,
  });
  const stripe = new THREE.Mesh(stripeGeom, stripeMat);
  stripe.rotation.x = -Math.PI / 2;
  stripe.rotation.z = Math.PI / 2;
  stripe.position.set(branch.startX, 0.03, direction * (15 + branchLength / 2));
  group.add(stripe);
  
  // Branch label
  const label = createBranchLabel(branch.name, branch.side);
  label.position.set(branch.startX, 1, direction * 18);
  group.add(label);
  
  return group;
}

/**
 * Create branch label sprite
 */
function createBranchLabel(name: string, side: 'north' | 'south'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  
  const ctx = canvas.getContext('2d')!;
  
  // Background
  ctx.fillStyle = side === 'north' ? 'rgba(79, 195, 247, 0.8)' : 'rgba(255, 152, 0, 0.8)';
  ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 8);
  ctx.fill();
  
  // Text
  ctx.font = 'bold 24px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(8, 2, 1);
  
  return sprite;
}
