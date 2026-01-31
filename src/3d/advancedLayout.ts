import * as THREE from 'three';
import squarify from 'squarify';

/**
 * ADVANCED LAYOUT SYSTEM
 * 
 * Combines:
 * - Squarified Treemap for directory districts
 * - Force-directed placement within districts
 * - Automatic street generation along boundaries
 * - Connection arcs between linked files
 */

export interface FileData {
  path: string;
  name: string;
  directory: string;
  extension: string;
  linesOfCode: number;
  imports?: string[];
  size?: number;
  createdAt?: number; // Timestamp for timeline positioning
}

export interface DistrictLayout {
  directory: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  depth: number;
  color: number;
  files: FileData[];
}

export interface BuildingPosition {
  path: string;
  x: number;
  z: number;
  district: string;
}

export interface StreetSegment {
  start: THREE.Vector3;
  end: THREE.Vector3;
  width: number;
  type: 'main' | 'boulevard' | 'alley';
  color: number;
}

export interface ConnectionArc {
  from: string;
  to: string;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  height: number;
  color: number;
}

// Color palette for districts by depth
const DISTRICT_COLORS = [
  0x1a237e, // Deep blue (root)
  0x283593, // Indigo
  0x303f9f, // Blue
  0x3949ab, // Light blue
  0x3f51b5, // Lighter
  0x5c6bc0, // Even lighter
];

/**
 * Main layout calculator
 */
export class AdvancedLayoutEngine {
  private totalWidth: number;
  private totalDepth: number;
  private padding: number;
  
  constructor(width: number = 200, depth: number = 200, padding: number = 2) {
    this.totalWidth = width;
    this.totalDepth = depth;
    this.padding = padding;
  }
  
  /**
   * Calculate complete layout for a project
   */
  public calculateLayout(files: FileData[]): {
    districts: DistrictLayout[];
    buildings: BuildingPosition[];
    streets: StreetSegment[];
    connections: ConnectionArc[];
  } {
    // 1. Build directory hierarchy
    const hierarchy = this.buildHierarchy(files);
    
    // 2. Calculate district layouts using squarified treemap
    const districts = this.calculateDistrictLayouts(hierarchy);
    
    // 3. Position buildings within districts
    const buildings = this.positionBuildings(files, districts);
    
    // 4. Generate streets along district boundaries
    const streets = this.generateStreets(districts);
    
    // 5. Calculate connection arcs based on imports
    const connections = this.calculateConnections(files, buildings);
    
    return { districts, buildings, streets, connections };
  }
  
  /**
   * Build directory hierarchy from file list
   */
  private buildHierarchy(files: FileData[]): Map<string, { 
    files: FileData[]; 
    totalLOC: number;
    depth: number;
    children: string[];
  }> {
    const hierarchy = new Map<string, { 
      files: FileData[]; 
      totalLOC: number;
      depth: number;
      children: string[];
    }>();
    
    // Group files by directory
    for (const file of files) {
      const dir = file.directory || '/';
      
      if (!hierarchy.has(dir)) {
        const depth = (dir.match(/\//g) || []).length;
        hierarchy.set(dir, { 
          files: [], 
          totalLOC: 0, 
          depth,
          children: []
        });
      }
      
      hierarchy.get(dir)!.files.push(file);
      hierarchy.get(dir)!.totalLOC += file.linesOfCode || 10;
    }
    
    // Build parent-child relationships
    hierarchy.forEach((_, dir) => {
      const parentDir = dir.split('/').slice(0, -1).join('/') || '/';
      if (parentDir !== dir && hierarchy.has(parentDir)) {
        hierarchy.get(parentDir)!.children.push(dir);
      }
    });
    
    return hierarchy;
  }
  
  /**
   * Calculate district layouts - placed on SIDES of main highway (not crossing it)
   * Main highway runs along z=0, districts are north (z>20) and south (z<-20)
   */
  private calculateDistrictLayouts(
    hierarchy: Map<string, { files: FileData[]; totalLOC: number; depth: number; children: string[] }>
  ): DistrictLayout[] {
    const districts: DistrictLayout[] = [];
    
    // Prepare data for squarify
    const data: { value: number; directory: string; depth: number; files: FileData[] }[] = [];
    
    hierarchy.forEach((info, dir) => {
      if (info.files.length > 0 || info.children.length === 0) {
        data.push({
          value: Math.max(info.totalLOC, 100),
          directory: dir,
          depth: info.depth,
          files: info.files
        });
      }
    });
    
    // Sort by value for better layout
    data.sort((a, b) => b.value - a.value);
    
    // Split data into north and south sides
    const northData = data.filter((_, i) => i % 2 === 0);
    const southData = data.filter((_, i) => i % 2 === 1);
    
    // Highway clearance zone (main street area)
    const highwayClearance = 20;
    
    // North side container (z > 20)
    const northContainer = {
      x0: -this.totalWidth / 2 + this.padding,
      y0: highwayClearance,
      x1: this.totalWidth / 2 - this.padding,
      y1: this.totalDepth / 2 - this.padding
    };
    
    // South side container (z < -20)
    const southContainer = {
      x0: -this.totalWidth / 2 + this.padding,
      y0: -this.totalDepth / 2 + this.padding,
      x1: this.totalWidth / 2 - this.padding,
      y1: -highwayClearance
    };
    
    // Apply squarified treemap to both sides
    if (northData.length > 0) {
      const northLayout = squarify(northData, northContainer);
      for (const rect of northLayout) {
        const depth = rect.depth || 0;
        districts.push({
          directory: rect.directory,
          x0: rect.x0 + this.padding,
          y0: rect.y0 + this.padding,
          x1: rect.x1 - this.padding,
          y1: rect.y1 - this.padding,
          depth,
          color: DISTRICT_COLORS[Math.min(depth, DISTRICT_COLORS.length - 1)],
          files: rect.files || []
        });
      }
    }
    
    if (southData.length > 0) {
      const southLayout = squarify(southData, southContainer);
      for (const rect of southLayout) {
        const depth = rect.depth || 0;
        districts.push({
          directory: rect.directory,
          x0: rect.x0 + this.padding,
          y0: rect.y0 + this.padding,
          x1: rect.x1 - this.padding,
          y1: rect.y1 - this.padding,
          depth,
          color: DISTRICT_COLORS[Math.min(depth, DISTRICT_COLORS.length - 1)],
          files: rect.files || []
        });
      }
    }
    
    return districts;
  }
  
  /**
   * Position buildings within their districts
   */
  private positionBuildings(_files: FileData[], districts: DistrictLayout[]): BuildingPosition[] {
    const positions: BuildingPosition[] = [];
    
    // Create lookup for file -> district
    const fileToDistrict = new Map<string, DistrictLayout>();
    for (const district of districts) {
      for (const file of district.files) {
        fileToDistrict.set(file.path, district);
      }
    }
    
    // Position each file within its district
    for (const district of districts) {
      const districtWidth = district.x1 - district.x0;
      const districtDepth = district.y1 - district.y0;
      const centerX = (district.x0 + district.x1) / 2;
      const centerZ = (district.y0 + district.y1) / 2;
      
      const fileCount = district.files.length;
      
      if (fileCount === 0) continue;
      
      // Sort files by LOC (largest first for center placement)
      const sortedFiles = [...district.files].sort(
        (a, b) => (b.linesOfCode || 0) - (a.linesOfCode || 0)
      );
      
      if (fileCount === 1) {
        // Single file: center of district
        positions.push({
          path: sortedFiles[0].path,
          x: centerX,
          z: centerZ,
          district: district.directory
        });
      } else if (fileCount <= 7) {
        // Small number: hexagonal pattern
        sortedFiles.forEach((file, i) => {
          if (i === 0) {
            // Largest in center
            positions.push({ path: file.path, x: centerX, z: centerZ, district: district.directory });
          } else {
            const angle = ((i - 1) / (fileCount - 1)) * Math.PI * 2;
            const radius = Math.min(districtWidth, districtDepth) * 0.3;
            positions.push({
              path: file.path,
              x: centerX + Math.cos(angle) * radius,
              z: centerZ + Math.sin(angle) * radius,
              district: district.directory
            });
          }
        });
      } else {
        // Many files: grid with size-based spacing
        const cols = Math.ceil(Math.sqrt(fileCount * districtWidth / districtDepth));
        const rows = Math.ceil(fileCount / cols);
        const cellWidth = districtWidth / (cols + 1);
        const cellDepth = districtDepth / (rows + 1);
        
        sortedFiles.forEach((file, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          
          positions.push({
            path: file.path,
            x: district.x0 + cellWidth * (col + 1),
            z: district.y0 + cellDepth * (row + 1),
            district: district.directory
          });
        });
      }
    }
    
    return positions;
  }
  
  /**
   * Generate streets along district boundaries
   */
  private generateStreets(districts: DistrictLayout[]): StreetSegment[] {
    const streets: StreetSegment[] = [];
    const streetWidth = 2;
    
    // Main boulevard through center
    streets.push({
      start: new THREE.Vector3(-this.totalWidth / 2, 0.01, 0),
      end: new THREE.Vector3(this.totalWidth / 2, 0.01, 0),
      width: 4,
      type: 'main',
      color: 0x00ffff
    });
    
    // Cross street
    streets.push({
      start: new THREE.Vector3(0, 0.01, -this.totalDepth / 2),
      end: new THREE.Vector3(0, 0.01, this.totalDepth / 2),
      width: 3,
      type: 'main',
      color: 0x00ffff
    });
    
    // District boundary streets
    for (const district of districts) {
      // Top edge
      streets.push({
        start: new THREE.Vector3(district.x0, 0.01, district.y0),
        end: new THREE.Vector3(district.x1, 0.01, district.y0),
        width: streetWidth,
        type: 'boulevard',
        color: district.color
      });
      
      // Right edge
      streets.push({
        start: new THREE.Vector3(district.x1, 0.01, district.y0),
        end: new THREE.Vector3(district.x1, 0.01, district.y1),
        width: streetWidth,
        type: 'boulevard',
        color: district.color
      });
    }
    
    return streets;
  }
  
  /**
   * Calculate connection arcs between files that import each other
   */
  private calculateConnections(files: FileData[], buildings: BuildingPosition[]): ConnectionArc[] {
    const arcs: ConnectionArc[] = [];
    
    // Create position lookup
    const positionMap = new Map<string, THREE.Vector3>();
    for (const building of buildings) {
      positionMap.set(building.path, new THREE.Vector3(building.x, 0, building.z));
    }
    
    // Create name -> path lookup for import resolution
    const nameToPath = new Map<string, string>();
    for (const file of files) {
      nameToPath.set(file.name, file.path);
      // Also add without extension
      const nameNoExt = file.name.replace(/\.[^.]+$/, '');
      nameToPath.set(nameNoExt, file.path);
    }
    
    // Process imports
    for (const file of files) {
      if (!file.imports) continue;
      
      const fromPos = positionMap.get(file.path);
      if (!fromPos) continue;
      
      for (const importPath of file.imports) {
        // Try to resolve import to a file
        const importName = importPath.split('/').pop() || importPath;
        const targetPath = nameToPath.get(importName) || nameToPath.get(importName.replace(/\.[^.]+$/, ''));
        
        if (targetPath && targetPath !== file.path) {
          const toPos = positionMap.get(targetPath);
          if (toPos) {
            const distance = fromPos.distanceTo(toPos);
            const arcHeight = Math.min(distance * 0.3, 15) + 3;
            
            arcs.push({
              from: file.path,
              to: targetPath,
              fromPos: fromPos.clone(),
              toPos: toPos.clone(),
              height: arcHeight,
              color: 0x66ffcc
            });
          }
        }
      }
    }
    
    return arcs;
  }
}

/**
 * Create 3D meshes for districts - minimal, just border outline
 */
export function createDistrictMesh(district: DistrictLayout): THREE.Group {
  const group = new THREE.Group();
  
  const width = district.x1 - district.x0;
  const depth = district.y1 - district.y0;
  const centerX = (district.x0 + district.x1) / 2;
  const centerZ = (district.y0 + district.y1) / 2;
  
  // Just a thin outline on the ground - no solid plate
  const outlinePoints = [
    new THREE.Vector3(district.x0, 0.02, district.y0),
    new THREE.Vector3(district.x1, 0.02, district.y0),
    new THREE.Vector3(district.x1, 0.02, district.y1),
    new THREE.Vector3(district.x0, 0.02, district.y1),
    new THREE.Vector3(district.x0, 0.02, district.y0),
  ];
  
  const outlineGeom = new THREE.BufferGeometry().setFromPoints(outlinePoints);
  const outlineMat = new THREE.LineBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.6,
  });
  const outline = new THREE.Line(outlineGeom, outlineMat);
  group.add(outline);
  
  // Corner markers (small glowing dots)
  const corners = [
    new THREE.Vector3(district.x0, 0.1, district.y0),
    new THREE.Vector3(district.x1, 0.1, district.y0),
    new THREE.Vector3(district.x1, 0.1, district.y1),
    new THREE.Vector3(district.x0, 0.1, district.y1),
  ];
  
  for (const corner of corners) {
    const dotGeom = new THREE.SphereGeometry(0.3, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
    });
    const dot = new THREE.Mesh(dotGeom, dotMat);
    dot.position.copy(corner);
    group.add(dot);
  }
  
  // District label - only for larger districts
  if (width > 15 && depth > 15) {
    const label = createDistrictLabel(district.directory, width);
    label.position.set(centerX, 0.5, centerZ);
    group.add(label);
  }
  
  return group;
}

/**
 * Create district label sprite
 */
function createDistrictLabel(name: string, maxWidth: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  
  const ctx = canvas.getContext('2d')!;
  
  // Background
  ctx.fillStyle = 'rgba(0, 20, 40, 0.8)';
  ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 10);
  ctx.fill();
  
  // Border
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 10);
  ctx.stroke();
  
  // Text
  ctx.font = 'bold 36px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Truncate name if needed
  const displayName = name.length > 25 ? '...' + name.slice(-22) : name;
  ctx.fillText(displayName, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  
  const scale = Math.min(maxWidth * 0.8, 20);
  sprite.scale.set(scale, scale * 0.25, 1);
  
  return sprite;
}

/**
 * Create street mesh
 */
export function createStreetMesh(segment: StreetSegment): THREE.Mesh {
  const direction = segment.end.clone().sub(segment.start);
  const length = direction.length();
  
  const geometry = new THREE.PlaneGeometry(segment.width, length);
  const material = new THREE.MeshBasicMaterial({
    color: segment.type === 'main' ? 0x00ffff : segment.color,
    transparent: true,
    opacity: segment.type === 'main' ? 0.6 : 0.4,
    side: THREE.DoubleSide,
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  
  // Position and rotate to align with direction
  const center = segment.start.clone().add(segment.end).multiplyScalar(0.5);
  mesh.position.copy(center);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = Math.atan2(direction.x, direction.z);
  
  return mesh;
}

/**
 * Create animated connection arc
 */
export function createConnectionArc(arc: ConnectionArc): THREE.Group {
  const group = new THREE.Group();
  
  // Create curved path
  const midPoint = arc.fromPos.clone().add(arc.toPos).multiplyScalar(0.5);
  midPoint.y = arc.height;
  
  const curve = new THREE.QuadraticBezierCurve3(
    arc.fromPos.clone().add(new THREE.Vector3(0, 1, 0)),
    midPoint,
    arc.toPos.clone().add(new THREE.Vector3(0, 1, 0))
  );
  
  // Arc line
  const points = curve.getPoints(50);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: arc.color,
    transparent: true,
    opacity: 0.6,
  });
  const line = new THREE.Line(geometry, material);
  group.add(line);
  
  // Glow tube
  const tubeGeometry = new THREE.TubeGeometry(curve, 32, 0.1, 8, false);
  const tubeMaterial = new THREE.MeshBasicMaterial({
    color: arc.color,
    transparent: true,
    opacity: 0.3,
  });
  const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
  group.add(tube);
  
  // Traveling particles
  const particleCount = 5;
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  
  for (let i = 0; i < particleCount; i++) {
    const t = i / particleCount;
    const point = curve.getPoint(t);
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
  }
  
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const particleMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.3,
    transparent: true,
    opacity: 0.9,
  });
  
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.userData = { curve, particleCount, phase: Math.random() * Math.PI * 2 };
  group.add(particles);
  
  group.userData = { arc, curve };
  
  return group;
}

/**
 * Update connection arc animation
 */
export function updateConnectionArcs(arcGroups: THREE.Group[], time: number): void {
  for (const group of arcGroups) {
    // Find particles in group
    group.traverse((child) => {
      if (child instanceof THREE.Points && child.userData.curve) {
        const { curve, particleCount, phase } = child.userData;
        const positions = child.geometry.attributes.position.array as Float32Array;
        
        for (let i = 0; i < particleCount; i++) {
          const t = ((time * 0.3 + phase + i / particleCount) % 1);
          const point = curve.getPoint(t);
          positions[i * 3] = point.x;
          positions[i * 3 + 1] = point.y;
          positions[i * 3 + 2] = point.z;
        }
        
        child.geometry.attributes.position.needsUpdate = true;
      }
    });
  }
}
