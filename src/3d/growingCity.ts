import * as THREE from 'three';

/**
 * GROWING CITY LAYOUT
 * 
 * Organic city that grows over time:
 * - Main road = timeline, grows as project evolves
 * - Side streets branch off for each directory
 * - Buildings appear along roads as files are created
 * - Trees, lamps, and cats populate the streets
 * 
 * Like watching a city being built!
 */

export interface GrowingFileData {
  path: string;
  name: string;
  directory: string;
  extension: string;
  linesOfCode: number;
  createdAt?: number; // timestamp
}

export interface GrowingLayout {
  buildings: GrowingBuildingPosition[];
  roads: GrowingRoad[];
  decorations: GrowingDecoration[];
}

export interface GrowingBuildingPosition {
  file: GrowingFileData;
  x: number;
  z: number;
  rotation: number;
  delay: number; // Animation delay for growth effect
}

export interface GrowingRoad {
  points: THREE.Vector2[]; // Can be curved!
  width: number;
  type: 'main' | 'branch';
  name?: string;
  growDelay: number;
}

export interface GrowingDecoration {
  type: 'tree' | 'lamp' | 'cat';
  x: number;
  z: number;
  scale: number;
  delay: number;
}

/**
 * Growing City Layout Engine
 */
export class GrowingCityEngine {
  
  public calculateLayout(files: GrowingFileData[]): GrowingLayout {
    const roads: GrowingRoad[] = [];
    const buildings: GrowingBuildingPosition[] = [];
    const decorations: GrowingDecoration[] = [];
    
    // Sort files by creation time (or use index if no timestamp)
    const sortedFiles = [...files].sort((a, b) => {
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      return timeA - timeB;
    });
    
    // Group files by directory
    const dirGroups = this.groupByDirectory(sortedFiles);
    const dirArray = Array.from(dirGroups.entries());
    
    // Calculate main road length based on total files
    const mainRoadLength = Math.max(100, files.length * 4);
    
    // Create main road (the timeline)
    const mainRoad = this.createMainRoad(mainRoadLength);
    roads.push(mainRoad);
    
    // Add decorations along main road
    this.addMainRoadDecorations(mainRoad, decorations);
    
    // Create branch roads for each directory
    let currentX = -mainRoadLength / 2 + 20;
    const branchSpacing = mainRoadLength / (dirArray.length + 1);
    
    dirArray.forEach(([dir, dirFiles], dirIndex) => {
      const branchX = currentX + branchSpacing * (dirIndex + 0.5);
      const side = dirIndex % 2 === 0 ? 1 : -1; // Alternate sides
      
      // Create branch road
      const branchRoad = this.createBranchRoad(branchX, side, dir, dirFiles.length);
      roads.push(branchRoad);
      
      // Position buildings along this branch
      this.positionBuildingsOnRoad(branchRoad, dirFiles, buildings);
      
      // Add decorations along branch
      this.addBranchDecorations(branchRoad, decorations);
    });
    
    // Add wandering cats on sidewalks
    this.addCats(roads, decorations);
    
    return { buildings, roads, decorations };
  }
  
  private createMainRoad(length: number): GrowingRoad {
    // STRAIGHT main road - makes branch connections cleaner
    const points: THREE.Vector2[] = [
      new THREE.Vector2(-length / 2, 0),
      new THREE.Vector2(length / 2, 0)
    ];
    
    return {
      points,
      width: 14,
      type: 'main',
      name: 'Timeline',
      growDelay: 0,
    };
  }
  
  private createBranchRoad(
    startX: number,
    side: number,
    dirName: string,
    fileCount: number
  ): GrowingRoad {
    const branchLength = 20 + fileCount * 5;
    
    // SIMPLE STRAIGHT branch road perpendicular to main
    const startZ = side * 8; // Start at edge of main road
    const endZ = startZ + branchLength * side;
    
    const points: THREE.Vector2[] = [
      new THREE.Vector2(startX, startZ),
      new THREE.Vector2(startX, endZ)
    ];
    
    return {
      points,
      width: 8, // Narrower than main road
      type: 'branch',
      name: this.getShortName(dirName),
      growDelay: 0.2,
    };
  }
  
  private positionBuildingsOnRoad(
    road: GrowingRoad,
    files: GrowingFileData[],
    buildings: GrowingBuildingPosition[]
  ): void {
    files.forEach((file, i) => {
      // Position along road
      const t = (i + 1) / (files.length + 1);
      const pos = this.getPointOnRoad(road.points, t);
      const tangent = this.getTangentOnRoad(road.points, t);
      
      // Offset to side of road
      const perpendicular = new THREE.Vector2(-tangent.y, tangent.x);
      const offset = (road.width / 2 + 4) * (i % 2 === 0 ? 1 : -1);
      
      const buildingX = pos.x + perpendicular.x * offset;
      const buildingZ = pos.y + perpendicular.y * offset;
      
      // Face the road
      const rotation = Math.atan2(perpendicular.y, perpendicular.x) + (offset > 0 ? 0 : Math.PI);
      
      buildings.push({
        file,
        x: buildingX,
        z: buildingZ,
        rotation,
        delay: t * 0.5, // Staggered appearance
      });
    });
  }
  
  private addMainRoadDecorations(road: GrowingRoad, decorations: GrowingDecoration[]): void {
    const roadLength = this.getRoadLength(road.points);
    const lampInterval = 20;
    const numLamps = Math.floor(roadLength / lampInterval);
    
    for (let i = 1; i < numLamps; i++) {
      const t = i / numLamps;
      const pos = this.getPointOnRoad(road.points, t);
      const tangent = this.getTangentOnRoad(road.points, t);
      const perp = new THREE.Vector2(-tangent.y, tangent.x);
      
      const offset = road.width / 2 + 2;
      
      // Lamps on both sides
      decorations.push({
        type: 'lamp',
        x: pos.x + perp.x * offset,
        z: pos.y + perp.y * offset,
        scale: 0.8,
        delay: t * 0.3,
      });
      decorations.push({
        type: 'lamp',
        x: pos.x - perp.x * offset,
        z: pos.y - perp.y * offset,
        scale: 0.8,
        delay: t * 0.3,
      });
      
      // Trees between lamps
      if (i % 2 === 0) {
        decorations.push({
          type: 'tree',
          x: pos.x + perp.x * (offset + 4),
          z: pos.y + perp.y * (offset + 4),
          scale: 0.6 + Math.random() * 0.3,
          delay: t * 0.3 + 0.1,
        });
      }
    }
  }
  
  private addBranchDecorations(
    road: GrowingRoad,
    decorations: GrowingDecoration[]
  ): void {
    const roadLen = this.getRoadLength(road.points);
    const numTrees = Math.floor(roadLen / 15);
    
    for (let i = 1; i <= numTrees; i++) {
      const t = i / (numTrees + 1);
      const pos = this.getPointOnRoad(road.points, t);
      const tangent = this.getTangentOnRoad(road.points, t);
      const perp = new THREE.Vector2(-tangent.y, tangent.x);
      
      const offset = road.width / 2 + 3;
      
      // Trees along branch roads
      if (Math.random() > 0.4) {
        const treeSide = Math.random() > 0.5 ? 1 : -1;
        decorations.push({
          type: 'tree',
          x: pos.x + perp.x * offset * treeSide,
          z: pos.y + perp.y * offset * treeSide,
          scale: 0.5 + Math.random() * 0.3,
          delay: t * 0.5 + 0.2,
        });
      }
      
      // Occasional lamp
      if (i === Math.floor(numTrees / 2)) {
        decorations.push({
          type: 'lamp',
          x: pos.x + perp.x * (road.width / 2 + 1),
          z: pos.y + perp.y * (road.width / 2 + 1),
          scale: 0.7,
          delay: t * 0.5,
        });
      }
    }
  }
  
  private addCats(roads: GrowingRoad[], decorations: GrowingDecoration[]): void {
    // Add cats wandering on sidewalks
    const numCats = Math.min(8, roads.length * 2);
    
    for (let i = 0; i < numCats; i++) {
      const road = roads[i % roads.length];
      const t = 0.2 + Math.random() * 0.6;
      const pos = this.getPointOnRoad(road.points, t);
      const tangent = this.getTangentOnRoad(road.points, t);
      const perp = new THREE.Vector2(-tangent.y, tangent.x);
      
      const side = Math.random() > 0.5 ? 1 : -1;
      const offset = road.width / 2 + 1.5; // On sidewalk
      
      decorations.push({
        type: 'cat',
        x: pos.x + perp.x * offset * side,
        z: pos.y + perp.y * offset * side,
        scale: 0.5 + Math.random() * 0.2,
        delay: Math.random() * 2,
      });
    }
  }
  
  // Helper functions
  private getRoadLength(points: THREE.Vector2[]): number {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += points[i].distanceTo(points[i - 1]);
    }
    return length;
  }
  
  private getPointOnRoad(points: THREE.Vector2[], t: number): THREE.Vector2 {
    const totalLength = this.getRoadLength(points);
    const targetDist = t * totalLength;
    
    let traveled = 0;
    for (let i = 1; i < points.length; i++) {
      const segmentLength = points[i].distanceTo(points[i - 1]);
      if (traveled + segmentLength >= targetDist) {
        const segmentT = (targetDist - traveled) / segmentLength;
        return points[i - 1].clone().lerp(points[i], segmentT);
      }
      traveled += segmentLength;
    }
    return points[points.length - 1].clone();
  }
  
  private getTangentOnRoad(points: THREE.Vector2[], t: number): THREE.Vector2 {
    const epsilon = 0.01;
    const p1 = this.getPointOnRoad(points, Math.max(0, t - epsilon));
    const p2 = this.getPointOnRoad(points, Math.min(1, t + epsilon));
    return p2.clone().sub(p1).normalize();
  }
  
  private groupByDirectory(files: GrowingFileData[]): Map<string, GrowingFileData[]> {
    const groups = new Map<string, GrowingFileData[]>();
    for (const file of files) {
      const dir = file.directory || '/';
      if (!groups.has(dir)) groups.set(dir, []);
      groups.get(dir)!.push(file);
    }
    return new Map([...groups.entries()].sort((a, b) => b[1].length - a[1].length));
  }
  
  private getShortName(dir: string): string {
    const parts = dir.split('/').filter(p => p);
    return parts[parts.length - 1] || 'root';
  }
}

/**
 * Create curved road mesh with dashed center line and sidewalks
 */
export function createGrowingRoad(road: GrowingRoad): THREE.Group {
  const group = new THREE.Group();
  
  // Build road from segments
  for (let i = 0; i < road.points.length - 1; i++) {
    const p1 = road.points[i];
    const p2 = road.points[i + 1];
    const segment = createRoadSegment(p1, p2, road.width, road.type === 'main');
    group.add(segment);
  }
  
  // Road name label at start of branch roads
  if (road.type === 'branch' && road.name) {
    const label = createRoadLabel(road.name);
    const startPos = road.points[0];
    label.position.set(startPos.x, 6, startPos.y);
    group.add(label);
  }
  
  return group;
}

function createRoadSegment(
  start: THREE.Vector2,
  end: THREE.Vector2,
  width: number,
  isMain: boolean
): THREE.Group {
  const group = new THREE.Group();
  
  const length = start.distanceTo(end);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const midX = (start.x + end.x) / 2;
  const midZ = (start.y + end.y) / 2;
  
  // Road surface
  const roadGeom = new THREE.PlaneGeometry(length + 0.5, width);
  const roadMat = new THREE.MeshStandardMaterial({
    color: isMain ? 0x2a2a3a : 0x252530,
    roughness: 0.9,
  });
  const roadMesh = new THREE.Mesh(roadGeom, roadMat);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.rotation.z = -angle;
  roadMesh.position.set(midX, 0.02, midZ);
  group.add(roadMesh);
  
  // Dashed center line (main road only, or simpler for branches)
  const dashLength = isMain ? 3 : 2;
  const gapLength = isMain ? 2 : 2;
  const numDashes = Math.floor(length / (dashLength + gapLength));
  
  for (let i = 0; i < numDashes; i++) {
    const t = (i * (dashLength + gapLength) + dashLength / 2) / length;
    const dashX = start.x + (end.x - start.x) * t;
    const dashZ = start.y + (end.y - start.y) * t;
    
    const dashGeom = new THREE.PlaneGeometry(dashLength, isMain ? 0.4 : 0.25);
    const dashMat = new THREE.MeshBasicMaterial({
      color: isMain ? 0xffdd00 : 0xcccc00,
      transparent: true,
      opacity: isMain ? 0.9 : 0.6,
    });
    const dash = new THREE.Mesh(dashGeom, dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.rotation.z = -angle;
    dash.position.set(dashX, 0.03, dashZ);
    group.add(dash);
  }
  
  // Edge lines (main road: white, branch: subtle)
  for (const side of [-1, 1]) {
    const edgeGeom = new THREE.PlaneGeometry(length + 0.5, isMain ? 0.2 : 0.15);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: isMain ? 0xffffff : 0x888888,
      transparent: true,
      opacity: isMain ? 0.7 : 0.4,
    });
    const edge = new THREE.Mesh(edgeGeom, edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.rotation.z = -angle;
    
    const perpX = Math.sin(angle) * (width / 2 - 0.2) * side;
    const perpZ = -Math.cos(angle) * (width / 2 - 0.2) * side;
    edge.position.set(midX + perpX, 0.03, midZ + perpZ);
    group.add(edge);
  }
  
  // Sidewalks - main road has wider sidewalks
  const sidewalkWidth = isMain ? 2.5 : 1.5;
  
  for (const side of [-1, 1]) {
    const walkGeom = new THREE.PlaneGeometry(length + 0.5, sidewalkWidth);
    const walkMat = new THREE.MeshStandardMaterial({
      color: isMain ? 0x5a5a6a : 0x4a4a5a,
      roughness: 0.7,
    });
    const walk = new THREE.Mesh(walkGeom, walkMat);
    walk.rotation.x = -Math.PI / 2;
    walk.rotation.z = -angle;
    
    const offset = width / 2 + sidewalkWidth / 2;
    const perpX = Math.sin(angle) * offset * side;
    const perpZ = -Math.cos(angle) * offset * side;
    walk.position.set(midX + perpX, 0.015, midZ + perpZ);
    walk.userData = { isSidewalk: true };
    group.add(walk);
    
    // Curb glow - only for main road
    if (isMain) {
      const curbGeom = new THREE.PlaneGeometry(length + 0.5, 0.15);
      const curbMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.4,
      });
      const curb = new THREE.Mesh(curbGeom, curbMat);
      curb.rotation.x = -Math.PI / 2;
      curb.rotation.z = -angle;
      
      const curbOffset = width / 2 + 0.1;
      const curbPerpX = Math.sin(angle) * curbOffset * side;
      const curbPerpZ = -Math.cos(angle) * curbOffset * side;
      curb.position.set(midX + curbPerpX, 0.025, midZ + curbPerpZ);
      group.add(curb);
    }
  }
  
  return group;
}

function createRoadLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#333344dd';
  ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 8);
  ctx.fill();
  
  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(10, 2.5, 1);
  return sprite;
}

/**
 * Create decorations (trees, lamps, cats)
 */
export function createGrowingDecorations(decorations: GrowingDecoration[]): THREE.Group {
  const group = new THREE.Group();
  
  for (const deco of decorations) {
    let mesh: THREE.Group;
    
    switch (deco.type) {
      case 'tree':
        mesh = createTree(deco.scale);
        break;
      case 'lamp':
        mesh = createLamp(deco.scale);
        break;
      case 'cat':
        mesh = createCat(deco.scale);
        break;
    }
    
    mesh.position.set(deco.x, 0, deco.z);
    mesh.userData.animationDelay = deco.delay;
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
  lamp.userData.isLamp = true;
  return lamp;
}

function createCat(scale: number): THREE.Group {
  const cat = new THREE.Group();
  
  // Body
  const bodyGeom = new THREE.CapsuleGeometry(0.3, 0.6, 4, 8);
  const catMat = new THREE.MeshStandardMaterial({
    color: 0xff8844, // Orange tabby!
    roughness: 0.8,
  });
  const body = new THREE.Mesh(bodyGeom, catMat);
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 0.35, 0);
  cat.add(body);
  
  // Head
  const headGeom = new THREE.SphereGeometry(0.25, 8, 8);
  const head = new THREE.Mesh(headGeom, catMat);
  head.position.set(0.5, 0.45, 0);
  cat.add(head);
  
  // Ears
  for (const side of [-1, 1]) {
    const earGeom = new THREE.ConeGeometry(0.1, 0.2, 4);
    const ear = new THREE.Mesh(earGeom, catMat);
    ear.position.set(0.55, 0.65, side * 0.12);
    cat.add(ear);
  }
  
  // Tail
  const tailGeom = new THREE.CylinderGeometry(0.05, 0.08, 0.5, 6);
  const tail = new THREE.Mesh(tailGeom, catMat);
  tail.rotation.z = Math.PI / 4;
  tail.position.set(-0.5, 0.5, 0);
  cat.add(tail);
  
  // Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x44ff44 });
  for (const side of [-1, 1]) {
    const eyeGeom = new THREE.SphereGeometry(0.05, 6, 6);
    const eye = new THREE.Mesh(eyeGeom, eyeMat);
    eye.position.set(0.7, 0.5, side * 0.1);
    cat.add(eye);
  }
  
  cat.scale.setScalar(scale);
  cat.userData.isCat = true;
  cat.userData.walkDirection = Math.random() > 0.5 ? 1 : -1;
  cat.userData.walkSpeed = 0.5 + Math.random() * 0.5;
  
  // Face walking direction
  cat.rotation.y = cat.userData.walkDirection > 0 ? 0 : Math.PI;
  
  return cat;
}
