import * as THREE from 'three';

/**
 * SIMPLE SEMANTIC LAYOUT
 * 
 * Clean, understandable layout:
 * - Main road = Timeline (X-axis)
 * - Buildings lined up along the road by directory
 * - North side = Source code
 * - South side = Assets/Config
 * - Chat trees along the roadside
 */

export interface SimpleFileData {
  path: string;
  name: string;
  directory: string;
  extension: string;
  linesOfCode: number;
}

export interface SimpleChatEntry {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
}

export interface SimpleLayout {
  buildings: SimpleBuildingPosition[];
  chatTrees: SimpleChatTreePosition[];
  directoryLabels: DirectoryLabel[];
}

export interface SimpleBuildingPosition {
  file: SimpleFileData;
  x: number;
  z: number;
}

export interface SimpleChatTreePosition {
  chat: SimpleChatEntry;
  x: number;
  z: number;
  treeType: 'pine' | 'round' | 'cyber';
  scale: number;
}

export interface DirectoryLabel {
  name: string;
  x: number;
  z: number;
  side: 'north' | 'south';
}

// Source code extensions
const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h',
  '.rb', '.php', '.swift', '.kt', '.scala'
]);

/**
 * Simple Layout Calculator
 */
export class SimpleLayoutEngine {
  private roadLength: number;
  
  constructor(roadLength: number = 300) {
    this.roadLength = roadLength;
  }
  
  public calculateLayout(
    files: SimpleFileData[],
    chats: SimpleChatEntry[]
  ): SimpleLayout {
    const buildings: SimpleBuildingPosition[] = [];
    const directoryLabels: DirectoryLabel[] = [];
    
    // Classify files
    const sourceFiles = files.filter(f => SOURCE_EXTENSIONS.has(f.extension.toLowerCase()));
    const assetFiles = files.filter(f => !SOURCE_EXTENSIONS.has(f.extension.toLowerCase()));
    
    // Group by directory
    const sourceDirs = this.groupByDirectory(sourceFiles);
    const assetDirs = this.groupByDirectory(assetFiles);
    
    // Position source files on NORTH side (z > 0)
    let northZ = 25;
    const halfLength = this.roadLength / 2;
    
    for (const [dir, dirFiles] of sourceDirs) {
      // Calculate X spread for this directory
      const startX = -halfLength + 20;
      const spacing = Math.min(12, (this.roadLength - 40) / Math.max(dirFiles.length, 1));
      
      // Add directory label
      directoryLabels.push({
        name: dir.split('/').pop() || dir || 'root',
        x: startX - 5,
        z: northZ,
        side: 'north'
      });
      
      // Position files in a row
      dirFiles.forEach((file, i) => {
        buildings.push({
          file,
          x: startX + i * spacing,
          z: northZ
        });
      });
      
      northZ += 20; // Next directory row
    }
    
    // Position asset files on SOUTH side (z < 0)
    let southZ = -25;
    
    for (const [dir, dirFiles] of assetDirs) {
      const startX = -halfLength + 20;
      const spacing = Math.min(12, (this.roadLength - 40) / Math.max(dirFiles.length, 1));
      
      directoryLabels.push({
        name: dir.split('/').pop() || dir || 'root',
        x: startX - 5,
        z: southZ,
        side: 'south'
      });
      
      dirFiles.forEach((file, i) => {
        buildings.push({
          file,
          x: startX + i * spacing,
          z: southZ
        });
      });
      
      southZ -= 20;
    }
    
    // Position chat trees along the roadside
    const chatTrees = this.positionChatTrees(chats);
    
    return { buildings, chatTrees, directoryLabels };
  }
  
  private groupByDirectory(files: SimpleFileData[]): Map<string, SimpleFileData[]> {
    const groups = new Map<string, SimpleFileData[]>();
    
    for (const file of files) {
      const dir = file.directory || '/';
      if (!groups.has(dir)) {
        groups.set(dir, []);
      }
      groups.get(dir)!.push(file);
    }
    
    // Sort by directory name
    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }
  
  private positionChatTrees(chats: SimpleChatEntry[]): SimpleChatTreePosition[] {
    const trees: SimpleChatTreePosition[] = [];
    const halfLength = this.roadLength / 2;
    
    // Spread chats evenly along the road
    const spacing = chats.length > 1 ? (this.roadLength - 40) / (chats.length - 1) : 0;
    
    chats.forEach((chat, i) => {
      const x = -halfLength + 20 + i * spacing;
      const z = (i % 2 === 0) ? 12 : -12; // Alternate sides
      
      let treeType: 'pine' | 'round' | 'cyber';
      if (chat.role === 'user') {
        treeType = 'pine';
      } else if (chat.role === 'assistant') {
        treeType = 'round';
      } else {
        treeType = 'cyber';
      }
      
      const scale = 0.6 + Math.min(chat.content.length / 500, 1);
      
      trees.push({ chat, x, z, treeType, scale });
    });
    
    return trees;
  }
}

/**
 * Create directory label
 */
export function createDirectoryLabel(label: DirectoryLabel): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  
  const ctx = canvas.getContext('2d')!;
  
  // Background color based on side
  const bgColor = label.side === 'north' ? 'rgba(79, 195, 247, 0.9)' : 'rgba(255, 152, 0, 0.9)';
  ctx.fillStyle = bgColor;
  ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 8);
  ctx.fill();
  
  // Text
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const displayName = label.name.length > 15 ? label.name.slice(0, 12) + '...' : label.name;
  ctx.fillText(displayName, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(10, 2.5, 1);
  sprite.position.set(label.x, 3, label.z);
  
  return sprite;
}
