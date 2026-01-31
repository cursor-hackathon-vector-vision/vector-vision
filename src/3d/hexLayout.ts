import * as THREE from 'three';

/**
 * HEXAGONAL CITY LAYOUT
 * 
 * Custom hex grid without external dependencies:
 * - Central hex plaza
 * - Surrounding district hexes arranged in rings
 * - Streets with dashed center lines and sidewalks
 */

export interface HexFileData {
  path: string;
  name: string;
  directory: string;
  extension: string;
  linesOfCode: number;
}

export interface HexLayout {
  buildings: HexBuildingPosition[];
  streets: HexStreet[];
  hexes: HexDistrict[];
  decorations: HexDecoration[];
}

export interface HexBuildingPosition {
  file: HexFileData;
  x: number;
  z: number;
  rotation: number;
}

export interface HexStreet {
  start: THREE.Vector2;
  end: THREE.Vector2;
  width: number;
  type: 'main' | 'secondary';
}

export interface HexDistrict {
  name: string;
  centerX: number;
  centerZ: number;
  radius: number;
  color: number;
  corners: THREE.Vector2[];
}

export interface HexDecoration {
  type: 'tree' | 'lamp';
  x: number;
  z: number;
  scale: number;
}

// District color palette
const DISTRICT_COLORS = [
  0x3178c6, // TypeScript blue
  0x61dafb, // React cyan
  0xf7df1e, // JavaScript yellow
  0x264de4, // CSS blue
  0xff6b6b, // Red
  0x4ecdc4, // Teal
  0x95e1d3, // Mint
  0xf38181, // Coral
  0xaa96da, // Lavender
  0x45b7d1, // Sky blue
];

/**
 * Calculate hex corners for a flat-top hexagon
 */
function getHexCorners(centerX: number, centerZ: number, size: number): THREE.Vector2[] {
  const corners: THREE.Vector2[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i; // Flat-top: start at 0°
    corners.push(new THREE.Vector2(
      centerX + size * Math.cos(angle),
      centerZ + size * Math.sin(angle)
    ));
  }
  return corners;
}


/**
 * Hexagonal Layout Engine
 */
export class HexLayoutEngine {
  private hexSize: number;
  
  constructor(hexSize: number = 40) {
    this.hexSize = hexSize;
  }
  
  public calculateLayout(files: HexFileData[]): HexLayout {
    const streets: HexStreet[] = [];
    const hexes: HexDistrict[] = [];
    const decorations: HexDecoration[] = [];
    const buildings: HexBuildingPosition[] = [];
    
    // Group files by extension
    const filesByType = this.groupByExtension(files);
    const fileTypeArray = Array.from(filesByType.entries());
    
    // Create central plaza hex
    const plazaCorners = getHexCorners(0, 0, this.hexSize);
    hexes.push({
      name: 'Plaza',
      centerX: 0,
      centerZ: 0,
      radius: this.hexSize,
      color: 0x00ffff,
      corners: plazaCorners
    });
    
    // Create district hexes in rings
    const spacing = this.hexSize * 2.2; // Spacing between hex centers
    let districtIndex = 0;
    
    for (let ring = 1; ring <= 2 && districtIndex < fileTypeArray.length; ring++) {
      const numInRing = ring * 6;
      
      for (let i = 0; i < numInRing && districtIndex < fileTypeArray.length; i++) {
        const angle = (i / numInRing) * Math.PI * 2;
        const distance = ring * spacing;
        
        const centerX = Math.cos(angle) * distance;
        const centerZ = Math.sin(angle) * distance;
        
        const [ext, districtFiles] = fileTypeArray[districtIndex];
        const color = DISTRICT_COLORS[districtIndex % DISTRICT_COLORS.length];
        const corners = getHexCorners(centerX, centerZ, this.hexSize);
        
        const district: HexDistrict = {
          name: this.getDistrictName(ext),
          centerX,
          centerZ,
          radius: this.hexSize,
          color,
          corners
        };
        hexes.push(district);
        
        // Create street from center to this hex
        streets.push({
          start: new THREE.Vector2(0, 0),
          end: new THREE.Vector2(centerX, centerZ),
          width: 8,
          type: 'main'
        });
        
        // Position buildings inside hex
        this.positionBuildingsInHex(centerX, centerZ, districtFiles, buildings);
        
        // Add trees at hex corners
        this.addHexTrees(district, decorations);
        
        // Add lamps along street
        this.addStreetLamps(
          new THREE.Vector2(0, 0),
          new THREE.Vector2(centerX, centerZ),
          decorations
        );
        
        districtIndex++;
      }
    }
    
    return { buildings, streets, hexes, decorations };
  }
  
  private positionBuildingsInHex(
    centerX: number,
    centerZ: number,
    files: HexFileData[],
    buildings: HexBuildingPosition[]
  ): void {
    const innerRadius = this.hexSize * 0.75;
    
    // Arrange in concentric rings
    const maxPerRing = 6;
    let fileIndex = 0;
    let ring = 0;
    
    while (fileIndex < files.length) {
      const ringRadius = (ring === 0) ? 0 : 8 + ring * 10;
      const filesInRing = (ring === 0) ? 1 : Math.min(maxPerRing + ring * 2, files.length - fileIndex);
      
      for (let i = 0; i < filesInRing && fileIndex < files.length; i++) {
        const angle = (ring === 0) ? 0 : (i / filesInRing) * Math.PI * 2 + ring * 0.3;
        const x = centerX + Math.cos(angle) * ringRadius;
        const z = centerZ + Math.sin(angle) * ringRadius;
        
        if (ringRadius < innerRadius) {
          buildings.push({
            file: files[fileIndex],
            x,
            z,
            rotation: angle + Math.PI
          });
        }
        fileIndex++;
      }
      ring++;
      
      if (ring > 4) break; // Safety limit
    }
  }
  
  private addHexTrees(district: HexDistrict, decorations: HexDecoration[]): void {
    // Add trees at alternating corners
    for (let i = 0; i < district.corners.length; i += 2) {
      const corner = district.corners[i];
      decorations.push({
        type: 'tree',
        x: corner.x,
        z: corner.y,
        scale: 0.6 + Math.random() * 0.3
      });
    }
  }
  
  private addStreetLamps(
    start: THREE.Vector2,
    end: THREE.Vector2,
    decorations: HexDecoration[]
  ): void {
    const dist = start.distanceTo(end);
    const numLamps = Math.floor(dist / 30);
    const dir = end.clone().sub(start).normalize();
    const perp = new THREE.Vector2(-dir.y, dir.x);
    
    for (let i = 1; i < numLamps; i++) {
      const t = i / numLamps;
      const pos = start.clone().lerp(end, t);
      
      const offset = 7;
      decorations.push({
        type: 'lamp',
        x: pos.x + perp.x * offset,
        z: pos.y + perp.y * offset,
        scale: 0.8
      });
      decorations.push({
        type: 'lamp',
        x: pos.x - perp.x * offset,
        z: pos.y - perp.y * offset,
        scale: 0.8
      });
    }
  }
  
  private getDistrictName(ext: string): string {
    const names: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'React',
      '.js': 'JavaScript',
      '.jsx': 'JSX',
      '.css': 'Styles',
      '.scss': 'SCSS',
      '.json': 'Config',
      '.md': 'Docs',
      '.html': 'HTML',
    };
    return names[ext] || ext.replace('.', '').toUpperCase();
  }
  
  private groupByExtension(files: HexFileData[]): Map<string, HexFileData[]> {
    const groups = new Map<string, HexFileData[]>();
    
    for (const file of files) {
      const ext = file.extension.toLowerCase();
      if (!groups.has(ext)) {
        groups.set(ext, []);
      }
      groups.get(ext)!.push(file);
    }
    
    return new Map([...groups.entries()].sort((a, b) => b[1].length - a[1].length));
  }
}

/**
 * Create hexagonal district mesh
 */
export function createHexMesh(district: HexDistrict): THREE.Group {
  const group = new THREE.Group();
  
  // Glowing hex edge tubes
  for (let i = 0; i < district.corners.length; i++) {
    const c1 = district.corners[i];
    const c2 = district.corners[(i + 1) % district.corners.length];
    
    const length = c1.distanceTo(c2);
    const tubeGeom = new THREE.CylinderGeometry(0.4, 0.4, length, 8);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: district.color,
      transparent: true,
      opacity: 0.7,
    });
    const tube = new THREE.Mesh(tubeGeom, tubeMat);
    
    const midX = (c1.x + c2.x) / 2;
    const midZ = (c1.y + c2.y) / 2;
    const angle = Math.atan2(c2.y - c1.y, c2.x - c1.x);
    
    tube.position.set(midX, 0.2, midZ);
    tube.rotation.z = Math.PI / 2;
    tube.rotation.y = -angle;
    group.add(tube);
  }
  
  // Corner markers
  for (const corner of district.corners) {
    const markerGeom = new THREE.SphereGeometry(0.6, 8, 8);
    const markerMat = new THREE.MeshBasicMaterial({
      color: district.color,
      transparent: true,
      opacity: 0.8,
    });
    const marker = new THREE.Mesh(markerGeom, markerMat);
    marker.position.set(corner.x, 0.3, corner.y);
    group.add(marker);
  }
  
  // District label
  const label = createHexLabel(district.name, district.color);
  label.position.set(district.centerX, 12, district.centerZ);
  group.add(label);
  
  return group;
}

function createHexLabel(text: string, color: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  
  const ctx = canvas.getContext('2d')!;
  
  // Hex-shaped background
  const colorHex = '#' + color.toString(16).padStart(6, '0');
  ctx.fillStyle = colorHex + 'dd';
  
  const w = canvas.width - 40;
  const h = canvas.height - 20;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * (w / 2);
    const y = cy + Math.sin(angle) * (h / 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  
  ctx.strokeStyle = '#ffffffaa';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(18, 4.5, 1);
  
  return sprite;
}

/**
 * Create street with dashed center line and sidewalks
 */
export function createHexStreet(street: HexStreet): THREE.Group {
  const group = new THREE.Group();
  
  const start = street.start;
  const end = street.end;
  const length = start.distanceTo(end);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const midX = (start.x + end.x) / 2;
  const midZ = (start.y + end.y) / 2;
  
  const roadWidth = street.width;
  const sidewalkWidth = 2.5;
  
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
  const dashLength = 4;
  const gapLength = 3;
  const numDashes = Math.floor(length / (dashLength + gapLength));
  
  for (let i = 0; i < numDashes; i++) {
    const dashGeom = new THREE.PlaneGeometry(dashLength, 0.4);
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
    const edgeGeom = new THREE.PlaneGeometry(length, 0.25);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
    });
    const edge = new THREE.Mesh(edgeGeom, edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.rotation.z = -angle;
    
    const perpX = Math.sin(angle) * (roadWidth / 2 - 0.2) * side;
    const perpZ = -Math.cos(angle) * (roadWidth / 2 - 0.2) * side;
    edge.position.set(midX + perpX, 0.03, midZ + perpZ);
    group.add(edge);
  }
  
  // Sidewalks on both sides
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
    const curbGeom = new THREE.PlaneGeometry(length, 0.2);
    const curbMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.5,
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
export function createHexDecorations(decorations: HexDecoration[]): THREE.Group {
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
  
  const trunkGeom = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = 0.75;
  tree.add(trunk);
  
  const colors = [0x2d5a27, 0x3d7a37, 0x4d9a47];
  const sizes = [2, 1.5, 1];
  const heights = [2, 3, 4];
  
  colors.forEach((color, i) => {
    const foliageGeom = new THREE.ConeGeometry(sizes[i], 1.5, 6);
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
  
  const poleGeom = new THREE.CylinderGeometry(0.08, 0.12, 4, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333344 });
  const pole = new THREE.Mesh(poleGeom, poleMat);
  pole.position.y = 2;
  lamp.add(pole);
  
  const armGeom = new THREE.CylinderGeometry(0.04, 0.04, 1, 6);
  const arm = new THREE.Mesh(armGeom, poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.5, 3.8, 0);
  lamp.add(arm);
  
  const bulbGeom = new THREE.SphereGeometry(0.25, 8, 8);
  const bulbMat = new THREE.MeshBasicMaterial({
    color: 0xffcc66,
    transparent: true,
    opacity: 0.9,
  });
  const bulb = new THREE.Mesh(bulbGeom, bulbMat);
  bulb.position.set(1, 3.6, 0);
  lamp.add(bulb);
  
  const coneGeom = new THREE.ConeGeometry(1.5, 3, 12, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffcc66,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(coneGeom, coneMat);
  cone.position.set(1, 1.5, 0);
  lamp.add(cone);
  
  lamp.scale.setScalar(scale);
  return lamp;
}
