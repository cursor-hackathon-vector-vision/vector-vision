import * as THREE from 'three';

/**
 * SIMPLE GRID CITY LAYOUT
 * 
 * Clean, understandable grid structure:
 * - Horizontal and vertical streets form a grid
 * - Each block is a directory/file type
 * - Buildings sit inside blocks
 * - Like a real city with city blocks
 */

export interface GridFileData {
  path: string;
  name: string;
  directory: string;
  extension: string;
  linesOfCode: number;
}

export interface GridLayout {
  buildings: GridBuildingPosition[];
  streets: GridStreet[];
  blocks: GridBlock[];
  decorations: GridDecoration[];
}

export interface GridBuildingPosition {
  file: GridFileData;
  x: number;
  z: number;
  rotation: number;
}

export interface GridStreet {
  start: THREE.Vector2;
  end: THREE.Vector2;
  width: number;
  isMainStreet: boolean;
}

export interface GridBlock {
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  color: number;
}

export interface GridDecoration {
  type: 'tree' | 'lamp';
  x: number;
  z: number;
  scale: number;
}

// Block colors by type
const TYPE_COLORS: Record<string, number> = {
  '.ts': 0x3178c6,
  '.tsx': 0x61dafb,
  '.js': 0xf7df1e,
  '.css': 0x264de4,
  '.json': 0x5a9a5a,
  '.md': 0x083fa1,
  '.html': 0xe34c26,
  '.py': 0x3776ab,
  'default': 0x6a6a7a,
};

/**
 * Grid Layout Engine
 */
export class GridLayoutEngine {
  private blockSize: number;
  private streetWidth: number;
  private gridCols: number;
  private gridRows: number;
  
  constructor(blockSize: number = 50, streetWidth: number = 12) {
    this.blockSize = blockSize;
    this.streetWidth = streetWidth;
    this.gridCols = 4;
    this.gridRows = 3;
  }
  
  public calculateLayout(files: GridFileData[]): GridLayout {
    const streets: GridStreet[] = [];
    const blocks: GridBlock[] = [];
    const decorations: GridDecoration[] = [];
    const buildings: GridBuildingPosition[] = [];
    
    // Group files by directory
    const filesByDir = this.groupByDirectory(files);
    const dirArray = Array.from(filesByDir.entries());
    
    // Calculate grid dimensions based on number of directories
    const numDirs = dirArray.length;
    this.gridCols = Math.ceil(Math.sqrt(numDirs * 1.5));
    this.gridRows = Math.ceil(numDirs / this.gridCols);
    
    // Total grid dimensions
    const totalWidth = this.gridCols * (this.blockSize + this.streetWidth);
    const totalDepth = this.gridRows * (this.blockSize + this.streetWidth);
    
    // Offset to center the grid
    const offsetX = -totalWidth / 2 + this.blockSize / 2;
    const offsetZ = -totalDepth / 2 + this.blockSize / 2;
    
    // Create horizontal streets
    for (let row = 0; row <= this.gridRows; row++) {
      const z = offsetZ - this.blockSize / 2 - this.streetWidth / 2 + row * (this.blockSize + this.streetWidth);
      streets.push({
        start: new THREE.Vector2(offsetX - this.blockSize / 2 - this.streetWidth, z),
        end: new THREE.Vector2(offsetX + totalWidth - this.blockSize / 2, z),
        width: this.streetWidth,
        isMainStreet: row === Math.floor(this.gridRows / 2),
      });
    }
    
    // Create vertical streets
    for (let col = 0; col <= this.gridCols; col++) {
      const x = offsetX - this.blockSize / 2 - this.streetWidth / 2 + col * (this.blockSize + this.streetWidth);
      streets.push({
        start: new THREE.Vector2(x, offsetZ - this.blockSize / 2 - this.streetWidth),
        end: new THREE.Vector2(x, offsetZ + totalDepth - this.blockSize / 2),
        width: this.streetWidth,
        isMainStreet: col === Math.floor(this.gridCols / 2),
      });
    }
    
    // Create blocks and place buildings
    let blockIndex = 0;
    for (let row = 0; row < this.gridRows && blockIndex < dirArray.length; row++) {
      for (let col = 0; col < this.gridCols && blockIndex < dirArray.length; col++) {
        const [dir, dirFiles] = dirArray[blockIndex];
        
        const blockX = offsetX + col * (this.blockSize + this.streetWidth);
        const blockZ = offsetZ + row * (this.blockSize + this.streetWidth);
        
        // Get dominant file type for color
        const dominantExt = this.getDominantExtension(dirFiles);
        const color = TYPE_COLORS[dominantExt] || TYPE_COLORS['default'];
        
        // Create block
        blocks.push({
          name: this.getShortDirName(dir),
          x: blockX,
          z: blockZ,
          width: this.blockSize,
          depth: this.blockSize,
          color,
        });
        
        // Position buildings inside block
        this.positionBuildingsInBlock(blockX, blockZ, dirFiles, buildings);
        
        // Add trees at block corners
        const treeOffset = this.blockSize / 2 - 2;
        for (const [tx, tz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          if (Math.random() > 0.3) {
            decorations.push({
              type: 'tree',
              x: blockX + tx * treeOffset,
              z: blockZ + tz * treeOffset,
              scale: 0.5 + Math.random() * 0.3,
            });
          }
        }
        
        blockIndex++;
      }
    }
    
    // Add lamps along main streets
    this.addStreetLamps(streets, decorations);
    
    return { buildings, streets, blocks, decorations };
  }
  
  private positionBuildingsInBlock(
    blockX: number,
    blockZ: number,
    files: GridFileData[],
    buildings: GridBuildingPosition[]
  ): void {
    const innerMargin = 5;
    const usableSize = this.blockSize - innerMargin * 2;
    
    // Calculate grid for buildings inside block
    const numFiles = files.length;
    const cols = Math.ceil(Math.sqrt(numFiles));
    const rows = Math.ceil(numFiles / cols);
    
    const cellWidth = usableSize / cols;
    const cellDepth = usableSize / rows;
    
    files.forEach((file, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      const x = blockX - usableSize / 2 + cellWidth / 2 + col * cellWidth;
      const z = blockZ - usableSize / 2 + cellDepth / 2 + row * cellDepth;
      
      buildings.push({
        file,
        x,
        z,
        rotation: 0, // Face forward
      });
    });
  }
  
  private addStreetLamps(streets: GridStreet[], decorations: GridDecoration[]): void {
    for (const street of streets) {
      if (!street.isMainStreet) continue;
      
      const length = street.start.distanceTo(street.end);
      const numLamps = Math.floor(length / 25);
      const dir = street.end.clone().sub(street.start).normalize();
      const perp = new THREE.Vector2(-dir.y, dir.x);
      
      for (let i = 1; i < numLamps; i++) {
        const t = i / numLamps;
        const pos = street.start.clone().lerp(street.end, t);
        
        const offset = street.width / 2 + 1;
        decorations.push({
          type: 'lamp',
          x: pos.x + perp.x * offset,
          z: pos.y + perp.y * offset,
          scale: 0.7,
        });
        decorations.push({
          type: 'lamp',
          x: pos.x - perp.x * offset,
          z: pos.y - perp.y * offset,
          scale: 0.7,
        });
      }
    }
  }
  
  private groupByDirectory(files: GridFileData[]): Map<string, GridFileData[]> {
    const groups = new Map<string, GridFileData[]>();
    
    for (const file of files) {
      const dir = file.directory || '/';
      if (!groups.has(dir)) {
        groups.set(dir, []);
      }
      groups.get(dir)!.push(file);
    }
    
    // Sort by file count (largest first)
    return new Map([...groups.entries()].sort((a, b) => b[1].length - a[1].length));
  }
  
  private getDominantExtension(files: GridFileData[]): string {
    const counts = new Map<string, number>();
    for (const file of files) {
      const ext = file.extension.toLowerCase();
      counts.set(ext, (counts.get(ext) || 0) + 1);
    }
    
    let maxExt = 'default';
    let maxCount = 0;
    for (const [ext, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        maxExt = ext;
      }
    }
    return maxExt;
  }
  
  private getShortDirName(dir: string): string {
    const parts = dir.split('/').filter(p => p);
    if (parts.length === 0) return 'root';
    return parts[parts.length - 1] || 'root';
  }
}

/**
 * Create block ground mesh
 */
export function createBlockMesh(block: GridBlock): THREE.Group {
  const group = new THREE.Group();
  
  // Simple ground indicator - very subtle
  const groundGeom = new THREE.PlaneGeometry(block.width - 2, block.depth - 2);
  const groundMat = new THREE.MeshStandardMaterial({
    color: block.color,
    transparent: true,
    opacity: 0.08,
    roughness: 0.9,
  });
  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(block.x, 0.01, block.z);
  group.add(ground);
  
  // Corner markers only
  const markerSize = 1;
  for (const [cx, cz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const cornerX = block.x + cx * (block.width / 2 - markerSize);
    const cornerZ = block.z + cz * (block.depth / 2 - markerSize);
    
    const markerGeom = new THREE.BoxGeometry(markerSize, 0.3, markerSize);
    const markerMat = new THREE.MeshBasicMaterial({
      color: block.color,
      transparent: true,
      opacity: 0.5,
    });
    const marker = new THREE.Mesh(markerGeom, markerMat);
    marker.position.set(cornerX, 0.15, cornerZ);
    group.add(marker);
  }
  
  // Block label
  const label = createBlockLabel(block.name, block.color);
  label.position.set(block.x, 8, block.z);
  group.add(label);
  
  return group;
}

function createBlockLabel(text: string, color: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  
  const ctx = canvas.getContext('2d')!;
  
  const colorHex = '#' + color.toString(16).padStart(6, '0');
  ctx.fillStyle = colorHex + 'dd';
  ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 8);
  ctx.fill();
  
  ctx.strokeStyle = '#ffffff66';
  ctx.lineWidth = 2;
  ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 8);
  ctx.stroke();
  
  ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const displayName = text.length > 12 ? text.slice(0, 10) + '..' : text;
  ctx.fillText(displayName, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(12, 3, 1);
  
  return sprite;
}

/**
 * Create street with dashed center line and sidewalks (from hexLayout - it looks great)
 */
export function createGridStreet(street: GridStreet): THREE.Group {
  const group = new THREE.Group();
  
  const start = street.start;
  const end = street.end;
  const length = start.distanceTo(end);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const midX = (start.x + end.x) / 2;
  const midZ = (start.y + end.y) / 2;
  
  const roadWidth = street.width;
  const sidewalkWidth = 2;
  
  // Main road surface
  const roadGeom = new THREE.PlaneGeometry(length, roadWidth);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a3a,
    roughness: 0.9,
  });
  const road = new THREE.Mesh(roadGeom, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.rotation.z = -angle;
  road.position.set(midX, 0.02, midZ);
  group.add(road);
  
  // Dashed yellow center line
  const dashLength = 3;
  const gapLength = 2;
  const numDashes = Math.floor(length / (dashLength + gapLength));
  
  for (let i = 0; i < numDashes; i++) {
    const dashGeom = new THREE.PlaneGeometry(dashLength, 0.3);
    const dashMat = new THREE.MeshBasicMaterial({
      color: 0xffdd00,
      transparent: true,
      opacity: 0.9,
    });
    const dash = new THREE.Mesh(dashGeom, dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.rotation.z = -angle;
    
    const t = (i * (dashLength + gapLength) + dashLength / 2 + gapLength) / length;
    const dashX = start.x + (end.x - start.x) * t;
    const dashZ = start.y + (end.y - start.y) * t;
    
    dash.position.set(dashX, 0.03, dashZ);
    group.add(dash);
  }
  
  // White edge lines
  for (const side of [-1, 1]) {
    const edgeGeom = new THREE.PlaneGeometry(length, 0.2);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
    });
    const edge = new THREE.Mesh(edgeGeom, edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.rotation.z = -angle;
    
    const perpX = Math.sin(angle) * (roadWidth / 2 - 0.2) * side;
    const perpZ = -Math.cos(angle) * (roadWidth / 2 - 0.2) * side;
    edge.position.set(midX + perpX, 0.03, midZ + perpZ);
    group.add(edge);
  }
  
  // Sidewalks
  for (const side of [-1, 1]) {
    const walkGeom = new THREE.PlaneGeometry(length, sidewalkWidth);
    const walkMat = new THREE.MeshStandardMaterial({
      color: 0x5a5a6a,
      roughness: 0.7,
    });
    const walk = new THREE.Mesh(walkGeom, walkMat);
    walk.rotation.x = -Math.PI / 2;
    walk.rotation.z = -angle;
    
    const offset = roadWidth / 2 + sidewalkWidth / 2;
    const perpX = Math.sin(angle) * offset * side;
    const perpZ = -Math.cos(angle) * offset * side;
    walk.position.set(midX + perpX, 0.015, midZ + perpZ);
    walk.userData = { isSidewalk: true, side };
    group.add(walk);
    
    // Cyan curb glow
    const curbGeom = new THREE.PlaneGeometry(length, 0.15);
    const curbMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.4,
    });
    const curb = new THREE.Mesh(curbGeom, curbMat);
    curb.rotation.x = -Math.PI / 2;
    curb.rotation.z = -angle;
    
    const curbOffset = roadWidth / 2 + 0.1;
    const curbPerpX = Math.sin(angle) * curbOffset * side;
    const curbPerpZ = -Math.cos(angle) * curbOffset * side;
    curb.position.set(midX + curbPerpX, 0.025, midZ + curbPerpZ);
    group.add(curb);
  }
  
  return group;
}

/**
 * Create decorations
 */
export function createGridDecorations(decorations: GridDecoration[]): THREE.Group {
  const group = new THREE.Group();
  
  for (const deco of decorations) {
    let mesh: THREE.Group;
    
    if (deco.type === 'tree') {
      mesh = createTree(deco.scale);
    } else {
      mesh = createLamp(deco.scale);
    }
    
    mesh.position.set(deco.x, 0, deco.z);
    group.add(mesh);
  }
  
  return group;
}

function createTree(scale: number): THREE.Group {
  const tree = new THREE.Group();
  
  const trunkGeom = new THREE.CylinderGeometry(0.15, 0.25, 1.2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = 0.6;
  tree.add(trunk);
  
  const colors = [0x2d5a27, 0x3d7a37, 0x4d9a47];
  const sizes = [1.5, 1.1, 0.7];
  const heights = [1.5, 2.3, 3];
  
  colors.forEach((color, i) => {
    const foliageGeom = new THREE.ConeGeometry(sizes[i], 1.2, 6);
    const foliageMat = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
    });
    const foliage = new THREE.Mesh(foliageGeom, foliageMat);
    foliage.position.y = heights[i];
    tree.add(foliage);
  });
  
  tree.scale.setScalar(scale);
  return tree;
}

function createLamp(scale: number): THREE.Group {
  const lamp = new THREE.Group();
  
  const poleGeom = new THREE.CylinderGeometry(0.06, 0.1, 3.5, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333344 });
  const pole = new THREE.Mesh(poleGeom, poleMat);
  pole.position.y = 1.75;
  lamp.add(pole);
  
  const armGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6);
  const arm = new THREE.Mesh(armGeom, poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.4, 3.3, 0);
  lamp.add(arm);
  
  const bulbGeom = new THREE.SphereGeometry(0.2, 8, 8);
  const bulbMat = new THREE.MeshBasicMaterial({
    color: 0xffcc66,
    transparent: true,
    opacity: 0.9,
  });
  const bulb = new THREE.Mesh(bulbGeom, bulbMat);
  bulb.position.set(0.8, 3.1, 0);
  lamp.add(bulb);
  
  const coneGeom = new THREE.ConeGeometry(1.2, 2.5, 12, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffcc66,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(coneGeom, coneMat);
  cone.position.set(0.8, 1.5, 0);
  lamp.add(cone);
  
  lamp.scale.setScalar(scale);
  return lamp;
}
