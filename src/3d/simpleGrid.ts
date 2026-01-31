import * as THREE from 'three';

/**
 * SIMPLE MANHATTAN GRID LAYOUT
 * 
 * Based on research from procedural city generation:
 * - Simple 2D grid
 * - Main roads (avenues) every N blocks
 * - Side roads (streets) every M blocks
 * - Buildings placed in block centers
 * 
 * Reference: https://stackoverflow.com/questions/48318881
 */

// Grid configuration
const GRID_CONFIG = {
  // Cell size in world units
  cellSize: 8,
  
  // How many cells between main roads (avenues)
  mainRoadInterval: 6,
  
  // How many cells between side roads (streets)  
  sideRoadInterval: 3,
  
  // Road widths
  mainRoadWidth: 4,   // 4 lanes
  sideRoadWidth: 2,   // 2 lanes
  
  // Sidewalk width
  sidewalkWidth: 1.5,
};

export interface GridCell {
  x: number;
  z: number;
  type: 'building' | 'main-road' | 'side-road' | 'intersection';
}

export interface GridLayout {
  cells: GridCell[][];
  roads: GridRoad[];
  buildingSpots: BuildingSpot[];
  gridWidth: number;
  gridHeight: number;
}

export interface GridRoad {
  start: THREE.Vector2;
  end: THREE.Vector2;
  width: number;
  type: 'main' | 'side';
}

export interface BuildingSpot {
  x: number;
  z: number;
  width: number;
  depth: number;
}

/**
 * Simple Grid Layout Engine
 */
export class SimpleGridEngine {
  private config = GRID_CONFIG;
  
  /**
   * Calculate grid layout for given number of buildings
   */
  public calculateLayout(buildingCount: number): GridLayout {
    // Calculate grid size needed
    const blocksNeeded = Math.ceil(buildingCount / 4); // ~4 buildings per block
    const gridSize = Math.ceil(Math.sqrt(blocksNeeded)) * this.config.mainRoadInterval + 2;
    
    // Create empty grid
    const cells: GridCell[][] = [];
    for (let x = 0; x < gridSize; x++) {
      cells[x] = [];
      for (let z = 0; z < gridSize; z++) {
        cells[x][z] = { x, z, type: 'building' };
      }
    }
    
    // Mark roads
    const roads: GridRoad[] = [];
    
    // Main roads (avenues) - vertical
    for (let x = 0; x < gridSize; x += this.config.mainRoadInterval) {
      for (let z = 0; z < gridSize; z++) {
        cells[x][z].type = 'main-road';
      }
      roads.push({
        start: new THREE.Vector2(x * this.config.cellSize, 0),
        end: new THREE.Vector2(x * this.config.cellSize, (gridSize - 1) * this.config.cellSize),
        width: this.config.mainRoadWidth,
        type: 'main'
      });
    }
    
    // Main roads (avenues) - horizontal
    for (let z = 0; z < gridSize; z += this.config.mainRoadInterval) {
      for (let x = 0; x < gridSize; x++) {
        if (cells[x][z].type === 'main-road') {
          cells[x][z].type = 'intersection';
        } else {
          cells[x][z].type = 'main-road';
        }
      }
      roads.push({
        start: new THREE.Vector2(0, z * this.config.cellSize),
        end: new THREE.Vector2((gridSize - 1) * this.config.cellSize, z * this.config.cellSize),
        width: this.config.mainRoadWidth,
        type: 'main'
      });
    }
    
    // Side roads (streets) - vertical
    for (let x = this.config.sideRoadInterval; x < gridSize; x += this.config.sideRoadInterval) {
      if (x % this.config.mainRoadInterval === 0) continue; // Skip main roads
      for (let z = 0; z < gridSize; z++) {
        if (cells[x][z].type === 'building') {
          cells[x][z].type = 'side-road';
        }
      }
      roads.push({
        start: new THREE.Vector2(x * this.config.cellSize, 0),
        end: new THREE.Vector2(x * this.config.cellSize, (gridSize - 1) * this.config.cellSize),
        width: this.config.sideRoadWidth,
        type: 'side'
      });
    }
    
    // Side roads (streets) - horizontal
    for (let z = this.config.sideRoadInterval; z < gridSize; z += this.config.sideRoadInterval) {
      if (z % this.config.mainRoadInterval === 0) continue; // Skip main roads
      for (let x = 0; x < gridSize; x++) {
        if (cells[x][z].type === 'building') {
          cells[x][z].type = 'side-road';
        }
      }
      roads.push({
        start: new THREE.Vector2(0, z * this.config.cellSize),
        end: new THREE.Vector2((gridSize - 1) * this.config.cellSize, z * this.config.cellSize),
        width: this.config.sideRoadWidth,
        type: 'side'
      });
    }
    
    // Find building spots (cells that are still 'building' type)
    const buildingSpots: BuildingSpot[] = [];
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        if (cells[x][z].type === 'building') {
          buildingSpots.push({
            x: x * this.config.cellSize,
            z: z * this.config.cellSize,
            width: this.config.cellSize * 0.7,
            depth: this.config.cellSize * 0.7
          });
        }
      }
    }
    
    // Center the grid around origin
    const offsetX = (gridSize * this.config.cellSize) / 2;
    const offsetZ = (gridSize * this.config.cellSize) / 2;
    
    // Apply offset to roads
    roads.forEach(road => {
      road.start.x -= offsetX;
      road.start.y -= offsetZ;
      road.end.x -= offsetX;
      road.end.y -= offsetZ;
    });
    
    // Apply offset to building spots
    buildingSpots.forEach(spot => {
      spot.x -= offsetX;
      spot.z -= offsetZ;
    });
    
    return {
      cells,
      roads,
      buildingSpots,
      gridWidth: gridSize,
      gridHeight: gridSize
    };
  }
}

/**
 * Create road mesh from GridRoad
 */
export function createGridRoad(road: GridRoad): THREE.Group {
  const group = new THREE.Group();
  
  const start = road.start;
  const end = road.end;
  const isVertical = Math.abs(end.x - start.x) < 0.1;
  
  const length = start.distanceTo(end);
  const midX = (start.x + end.x) / 2;
  const midZ = (start.y + end.y) / 2;
  
  const roadWidth = road.width;
  const sidewalkWidth = GRID_CONFIG.sidewalkWidth;
  const totalWidth = roadWidth + sidewalkWidth * 2;
  
  // Road surface (dark asphalt)
  const roadGeom = new THREE.PlaneGeometry(
    isVertical ? roadWidth : length,
    isVertical ? length : roadWidth
  );
  const roadMat = new THREE.MeshStandardMaterial({
    color: road.type === 'main' ? 0x2a2a35 : 0x333340,
    roughness: 0.9,
  });
  const roadMesh = new THREE.Mesh(roadGeom, roadMat);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.set(midX, 0.01, midZ);
  group.add(roadMesh);
  
  // Sidewalks
  const sidewalkGeom = new THREE.PlaneGeometry(
    isVertical ? sidewalkWidth : length,
    isVertical ? length : sidewalkWidth
  );
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0x666666,
    roughness: 0.7,
  });
  
  for (const side of [-1, 1]) {
    const sidewalk = new THREE.Mesh(sidewalkGeom, sidewalkMat);
    sidewalk.rotation.x = -Math.PI / 2;
    
    if (isVertical) {
      sidewalk.position.set(midX + side * (roadWidth / 2 + sidewalkWidth / 2), 0.02, midZ);
    } else {
      sidewalk.position.set(midX, 0.02, midZ + side * (roadWidth / 2 + sidewalkWidth / 2));
    }
    group.add(sidewalk);
  }
  
  // Center line (yellow for main roads)
  if (road.type === 'main') {
    const lineGeom = new THREE.PlaneGeometry(
      isVertical ? 0.15 : length,
      isVertical ? length : 0.15
    );
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffdd00,
      transparent: true,
      opacity: 0.8,
    });
    const line = new THREE.Mesh(lineGeom, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(midX, 0.015, midZ);
    group.add(line);
  }
  
  // Lane dividers (white dashed for multi-lane roads)
  if (road.width >= 3) {
    const dashLength = 2;
    const gapLength = 2;
    const numDashes = Math.floor(length / (dashLength + gapLength));
    
    for (const laneOffset of [-roadWidth / 4, roadWidth / 4]) {
      for (let i = 0; i < numDashes; i++) {
        const dashGeom = new THREE.PlaneGeometry(
          isVertical ? 0.1 : dashLength,
          isVertical ? dashLength : 0.1
        );
        const dashMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.6,
        });
        const dash = new THREE.Mesh(dashGeom, dashMat);
        dash.rotation.x = -Math.PI / 2;
        
        const progress = (i + 0.5) / numDashes;
        if (isVertical) {
          dash.position.set(
            midX + laneOffset,
            0.015,
            start.y + progress * length
          );
        } else {
          dash.position.set(
            start.x + progress * length,
            0.015,
            midZ + laneOffset
          );
        }
        group.add(dash);
      }
    }
  }
  
  return group;
}

/**
 * Create intersection at road crossings
 */
export function createIntersection(x: number, z: number, isMain: boolean): THREE.Group {
  const group = new THREE.Group();
  
  const size = isMain ? GRID_CONFIG.mainRoadWidth + GRID_CONFIG.sidewalkWidth * 2 
                      : GRID_CONFIG.sideRoadWidth + GRID_CONFIG.sidewalkWidth * 2;
  
  // Intersection surface
  const geom = new THREE.PlaneGeometry(size, size);
  const mat = new THREE.MeshStandardMaterial({
    color: isMain ? 0x2a2a35 : 0x333340,
    roughness: 0.9,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.01, z);
  group.add(mesh);
  
  return group;
}

/**
 * Create a simple streetlamp
 */
export function createStreetLamp(x: number, z: number): THREE.Group {
  const lamp = new THREE.Group();
  lamp.position.set(x, 0, z);
  
  // Pole
  const poleGeom = new THREE.CylinderGeometry(0.05, 0.08, 3, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a });
  const pole = new THREE.Mesh(poleGeom, poleMat);
  pole.position.y = 1.5;
  lamp.add(pole);
  
  // Arm
  const armGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4);
  const arm = new THREE.Mesh(armGeom, poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.25, 2.9, 0);
  lamp.add(arm);
  
  // Light housing
  const housingGeom = new THREE.ConeGeometry(0.12, 0.15, 6);
  const housing = new THREE.Mesh(housingGeom, poleMat);
  housing.rotation.x = Math.PI;
  housing.position.set(0.5, 2.85, 0);
  lamp.add(housing);
  
  // Bulb
  const bulbGeom = new THREE.SphereGeometry(0.06, 6, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ 
    color: 0xffffcc,
    transparent: true,
    opacity: 0.9
  });
  const bulb = new THREE.Mesh(bulbGeom, bulbMat);
  bulb.position.set(0.5, 2.75, 0);
  lamp.add(bulb);
  
  // Point light (subtle)
  const light = new THREE.PointLight(0xffffcc, 0.3, 8);
  light.position.set(0.5, 2.75, 0);
  lamp.add(light);
  
  return lamp;
}

/**
 * Create a simple tree
 */
export function createSimpleTree(x: number, z: number, scale: number = 1): THREE.Group {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  
  // Trunk
  const trunkGeom = new THREE.CylinderGeometry(0.15 * scale, 0.2 * scale, 1.2 * scale, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = 0.6 * scale;
  tree.add(trunk);
  
  // Foliage (simple cone)
  const foliageGeom = new THREE.ConeGeometry(0.8 * scale, 1.8 * scale, 6);
  const foliageMat = new THREE.MeshStandardMaterial({ 
    color: 0x2d6a2e,
    flatShading: true
  });
  const foliage = new THREE.Mesh(foliageGeom, foliageMat);
  foliage.position.y = 2 * scale;
  tree.add(foliage);
  
  return tree;
}

/**
 * Render complete grid scene
 */
export function renderGridScene(
  layout: GridLayout,
  streetGroup: THREE.Group,
  decorationGroup: THREE.Group
): void {
  // Clear existing
  streetGroup.clear();
  decorationGroup.clear();
  
  // Render all roads
  for (const road of layout.roads) {
    const roadMesh = createGridRoad(road);
    streetGroup.add(roadMesh);
  }
  
  // Add streetlamps along roads (every few cells)
  const lampSpacing = GRID_CONFIG.cellSize * 2;
  for (const road of layout.roads) {
    if (road.type !== 'main') continue; // Only on main roads
    
    const isVertical = Math.abs(road.end.x - road.start.x) < 0.1;
    const length = road.start.distanceTo(road.end);
    const numLamps = Math.floor(length / lampSpacing);
    
    for (let i = 0; i < numLamps; i++) {
      const progress = (i + 0.5) / numLamps;
      const roadOffset = (road.width / 2 + GRID_CONFIG.sidewalkWidth / 2);
      
      if (isVertical) {
        const z = road.start.y + progress * length;
        decorationGroup.add(createStreetLamp(road.start.x + roadOffset, z));
        decorationGroup.add(createStreetLamp(road.start.x - roadOffset, z));
      } else {
        const x = road.start.x + progress * length;
        decorationGroup.add(createStreetLamp(x, road.start.y + roadOffset));
        decorationGroup.add(createStreetLamp(x, road.start.y - roadOffset));
      }
    }
  }
  
  // Add trees in some building spots (randomly)
  for (const spot of layout.buildingSpots) {
    if (Math.random() < 0.15) { // 15% chance of tree instead of building
      const tree = createSimpleTree(
        spot.x + (Math.random() - 0.5) * 2,
        spot.z + (Math.random() - 0.5) * 2,
        0.8 + Math.random() * 0.4
      );
      decorationGroup.add(tree);
    }
  }
}
