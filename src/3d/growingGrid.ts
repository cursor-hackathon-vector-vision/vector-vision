import * as THREE from 'three';

/**
 * GROWING GRID LAYOUT
 * 
 * Buildings arranged in a grid that grows over time:
 * - Start with a few buildings in center
 * - Grid expands as more files are added
 * - Small cat paths between buildings
 * - Colored connection paths overlay for imports/functions
 */

// Grid configuration
const CONFIG = {
  // Building spacing
  buildingSpacing: 6,      // Space between building centers
  buildingSize: 4,         // Base building footprint
  
  // Path (cat walkway) width
  pathWidth: 1.5,          // Narrow paths for cats
  
  // Connection path width
  connectionWidth: 0.3,    // Thin colored lines for connections
};

export interface GrowingGridLayout {
  buildings: GridBuilding[];
  paths: GridPath[];
  connections: GridConnection[];
  gridSize: number;
  center: THREE.Vector3;
}

export interface GridBuilding {
  id: string;
  gridX: number;
  gridZ: number;
  worldX: number;
  worldZ: number;
  addedAt: number; // Timeline index when this building appeared
}

export interface GridPath {
  start: THREE.Vector3;
  end: THREE.Vector3;
  type: 'horizontal' | 'vertical';
}

export interface GridConnection {
  from: string;  // File path
  to: string;    // File path
  type: 'import' | 'function' | 'reference';
  points: THREE.Vector3[];
}

/**
 * Growing Grid Engine
 * Grid expands in a spiral pattern as buildings are added
 */
export class GrowingGridEngine {
  
  /**
   * Calculate grid layout for files at a specific timeline point
   */
  public calculateLayout(
    files: { path: string; imports?: string[] }[],
    visibleCount: number // How many files are visible at this timeline point
  ): GrowingGridLayout {
    const buildings: GridBuilding[] = [];
    const paths: GridPath[] = [];
    const connections: GridConnection[] = [];
    
    // Take only visible files
    const visibleFiles = files.slice(0, visibleCount);
    
    // Calculate grid size needed (spiral growth)
    const gridSize = Math.ceil(Math.sqrt(visibleFiles.length));
    
    // Place buildings in spiral pattern from center
    const positions = this.generateSpiralPositions(visibleFiles.length);
    
    visibleFiles.forEach((file, index) => {
      const pos = positions[index];
      buildings.push({
        id: file.path,
        gridX: pos.x,
        gridZ: pos.z,
        worldX: pos.x * CONFIG.buildingSpacing,
        worldZ: pos.z * CONFIG.buildingSpacing,
        addedAt: index,
      });
    });
    
    // Create paths between adjacent buildings
    this.createPaths(buildings, paths);
    
    // Create connection overlays for imports
    this.createConnections(visibleFiles, buildings, connections);
    
    return {
      buildings,
      paths,
      connections,
      gridSize,
      center: new THREE.Vector3(0, 0, 0),
    };
  }
  
  /**
   * Generate positions in a spiral pattern from center
   * This makes the grid grow organically from the middle
   */
  private generateSpiralPositions(count: number): { x: number; z: number }[] {
    const positions: { x: number; z: number }[] = [];
    
    // Start at center
    let x = 0, z = 0;
    let dx = 0, dz = -1;
    let stepSize = 1;
    let stepsTaken = 0;
    let turnCount = 0;
    
    for (let i = 0; i < count; i++) {
      positions.push({ x, z });
      
      // Move to next position
      x += dx;
      z += dz;
      stepsTaken++;
      
      // Turn when we've taken enough steps
      if (stepsTaken === stepSize) {
        stepsTaken = 0;
        turnCount++;
        
        // Turn right (clockwise spiral)
        const temp = dx;
        dx = -dz;
        dz = temp;
        
        // Increase step size every 2 turns
        if (turnCount % 2 === 0) {
          stepSize++;
        }
      }
    }
    
    return positions;
  }
  
  /**
   * Create paths (cat walkways) between adjacent buildings
   */
  private createPaths(buildings: GridBuilding[], paths: GridPath[]): void {
    const buildingMap = new Map<string, GridBuilding>();
    
    // Create lookup by grid position
    buildings.forEach(b => {
      buildingMap.set(`${b.gridX},${b.gridZ}`, b);
    });
    
    // For each building, check if neighbors exist and create paths
    const processedPaths = new Set<string>();
    
    buildings.forEach(building => {
      const neighbors = [
        { dx: 1, dz: 0, type: 'horizontal' as const },
        { dx: 0, dz: 1, type: 'vertical' as const },
      ];
      
      neighbors.forEach(({ dx, dz, type }) => {
        const neighborKey = `${building.gridX + dx},${building.gridZ + dz}`;
        const neighbor = buildingMap.get(neighborKey);
        
        if (neighbor) {
          const pathKey = [
            `${building.gridX},${building.gridZ}`,
            neighborKey
          ].sort().join('-');
          
          if (!processedPaths.has(pathKey)) {
            processedPaths.add(pathKey);
            
            paths.push({
              start: new THREE.Vector3(building.worldX, 0, building.worldZ),
              end: new THREE.Vector3(neighbor.worldX, 0, neighbor.worldZ),
              type,
            });
          }
        }
      });
    });
  }
  
  /**
   * Create connection paths for imports/functions
   */
  private createConnections(
    files: { path: string; imports?: string[] }[],
    buildings: GridBuilding[],
    connections: GridConnection[]
  ): void {
    const buildingByPath = new Map<string, GridBuilding>();
    buildings.forEach(b => buildingByPath.set(b.id, b));
    
    files.forEach(file => {
      if (!file.imports) return;
      
      const fromBuilding = buildingByPath.get(file.path);
      if (!fromBuilding) return;
      
      file.imports.forEach(importPath => {
        // Find the imported file's building
        const toBuilding = Array.from(buildingByPath.values()).find(b => 
          b.id.endsWith(importPath) || importPath.endsWith(b.id.split('/').pop() || '')
        );
        
        if (toBuilding && fromBuilding.id !== toBuilding.id) {
          // Create connection path following the grid
          const points = this.calculateConnectionPath(fromBuilding, toBuilding);
          
          connections.push({
            from: file.path,
            to: toBuilding.id,
            type: 'import',
            points,
          });
        }
      });
    });
  }
  
  /**
   * Calculate a path that follows the grid (L-shaped or straight)
   */
  private calculateConnectionPath(
    from: GridBuilding,
    to: GridBuilding
  ): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    const y = 0.05; // Slightly above ground
    
    // Start point (edge of building)
    points.push(new THREE.Vector3(from.worldX, y, from.worldZ));
    
    // If not aligned, create L-shaped path
    if (from.gridX !== to.gridX && from.gridZ !== to.gridZ) {
      // Go horizontal first, then vertical
      points.push(new THREE.Vector3(to.worldX, y, from.worldZ));
    }
    
    // End point
    points.push(new THREE.Vector3(to.worldX, y, to.worldZ));
    
    return points;
  }
}

/**
 * Render the growing grid
 */
export function renderGrowingGrid(
  layout: GrowingGridLayout,
  streetGroup: THREE.Group,
  connectionGroup: THREE.Group
): void {
  // Clear existing
  streetGroup.clear();
  connectionGroup.clear();
  
  // Render paths (cat walkways)
  for (const path of layout.paths) {
    const pathMesh = createCatPath(path);
    streetGroup.add(pathMesh);
  }
  
  // Render connections as colored lines on paths
  for (const conn of layout.connections) {
    const connMesh = createConnectionPath(conn);
    connectionGroup.add(connMesh);
  }
}

/**
 * Create a narrow cat path between buildings
 */
function createCatPath(path: GridPath): THREE.Group {
  const group = new THREE.Group();
  
  const start = path.start;
  const end = path.end;
  const length = start.distanceTo(end);
  const isVertical = path.type === 'vertical';
  
  const midX = (start.x + end.x) / 2;
  const midZ = (start.z + end.z) / 2;
  
  // Path surface (cobblestone-like)
  const pathGeom = new THREE.PlaneGeometry(
    isVertical ? CONFIG.pathWidth : length,
    isVertical ? length : CONFIG.pathWidth
  );
  const pathMat = new THREE.MeshStandardMaterial({
    color: 0x555560,
    roughness: 0.8,
  });
  const pathMesh = new THREE.Mesh(pathGeom, pathMat);
  pathMesh.rotation.x = -Math.PI / 2;
  pathMesh.position.set(midX, 0.01, midZ);
  group.add(pathMesh);
  
  // Edge stones
  const edgeGeom = new THREE.PlaneGeometry(
    isVertical ? 0.1 : length,
    isVertical ? length : 0.1
  );
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0x777780,
    roughness: 0.6,
  });
  
  for (const side of [-1, 1]) {
    const edge = new THREE.Mesh(edgeGeom, edgeMat);
    edge.rotation.x = -Math.PI / 2;
    
    if (isVertical) {
      edge.position.set(midX + side * CONFIG.pathWidth / 2, 0.015, midZ);
    } else {
      edge.position.set(midX, 0.015, midZ + side * CONFIG.pathWidth / 2);
    }
    group.add(edge);
  }
  
  return group;
}

/**
 * Create a colored connection path (import/function link)
 */
function createConnectionPath(conn: GridConnection): THREE.Group {
  const group = new THREE.Group();
  
  // Color based on connection type
  const colors = {
    import: 0x4fc3f7,    // Light blue for imports
    function: 0x81c784,  // Green for function calls
    reference: 0xffb74d, // Orange for references
  };
  const color = colors[conn.type] || colors.import;
  
  // Create tube geometry following the path
  if (conn.points.length >= 2) {
    const curve = new THREE.CatmullRomCurve3(conn.points);
    const tubeGeom = new THREE.TubeGeometry(curve, 20, CONFIG.connectionWidth / 2, 6, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
    });
    const tube = new THREE.Mesh(tubeGeom, tubeMat);
    group.add(tube);
    
    // Add glow effect
    const glowGeom = new THREE.TubeGeometry(curve, 20, CONFIG.connectionWidth, 6, false);
    const glowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
    });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    group.add(glow);
    
    // Add small spheres at endpoints
    const sphereGeom = new THREE.SphereGeometry(0.2, 8, 8);
    const sphereMat = new THREE.MeshBasicMaterial({ color });
    
    const startSphere = new THREE.Mesh(sphereGeom, sphereMat);
    startSphere.position.copy(conn.points[0]);
    startSphere.position.y = 0.2;
    group.add(startSphere);
    
    const endSphere = new THREE.Mesh(sphereGeom, sphereMat);
    endSphere.position.copy(conn.points[conn.points.length - 1]);
    endSphere.position.y = 0.2;
    group.add(endSphere);
  }
  
  return group;
}

/**
 * Create a small streetlamp for paths
 */
export function createPathLamp(x: number, z: number): THREE.Group {
  const lamp = new THREE.Group();
  lamp.position.set(x, 0, z);
  
  // Short pole
  const poleGeom = new THREE.CylinderGeometry(0.03, 0.04, 1.8, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333340 });
  const pole = new THREE.Mesh(poleGeom, poleMat);
  pole.position.y = 0.9;
  lamp.add(pole);
  
  // Lamp head
  const headGeom = new THREE.SphereGeometry(0.1, 8, 8);
  const headMat = new THREE.MeshBasicMaterial({ 
    color: 0xffffdd,
    transparent: true,
    opacity: 0.9
  });
  const head = new THREE.Mesh(headGeom, headMat);
  head.position.y = 1.85;
  lamp.add(head);
  
  // Subtle light
  const light = new THREE.PointLight(0xffffdd, 0.3, 5);
  light.position.y = 1.85;
  lamp.add(light);
  
  return lamp;
}

/**
 * Animate connections (pulse effect)
 */
export function animateConnections(connectionGroup: THREE.Group, time: number): void {
  connectionGroup.traverse(child => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
      // Pulse opacity
      const pulse = 0.5 + 0.3 * Math.sin(time * 2);
      if (child.material.opacity < 0.5) {
        child.material.opacity = pulse * 0.4; // Glow
      } else {
        child.material.opacity = pulse + 0.2; // Main tube
      }
    }
  });
}
