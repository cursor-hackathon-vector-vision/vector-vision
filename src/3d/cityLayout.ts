import * as THREE from 'three';

/**
 * BEAUTIFUL CITY LAYOUT
 * 
 * Creates an organic, visually appealing code city:
 * - Central plaza with main buildings
 * - Radiating streets from center
 * - Districts organized by file type
 * - Trees, lights, and decorative elements
 */

export interface CityFileData {
  path: string;
  name: string;
  directory: string;
  extension: string;
  linesOfCode: number;
}

export interface CityLayout {
  buildings: CityBuildingPosition[];
  streets: CityStreet[];
  districts: CityDistrict[];
  decorations: CityDecoration[];
}

export interface CityBuildingPosition {
  file: CityFileData;
  x: number;
  z: number;
  rotation: number;
}

export interface CityStreet {
  start: THREE.Vector2;
  end: THREE.Vector2;
  width: number;
  type: 'main' | 'secondary' | 'alley';
}

export interface CityDistrict {
  name: string;
  centerX: number;
  centerZ: number;
  radius: number;
  color: number;
  files: CityFileData[];
}

export interface CityDecoration {
  type: 'tree' | 'lamp' | 'bench' | 'fountain';
  x: number;
  z: number;
  scale: number;
}

// File type to district mapping
const FILE_TYPE_DISTRICTS: Record<string, { name: string; color: number; angle: number }> = {
  '.ts': { name: 'TypeScript Core', color: 0x3178c6, angle: 0 },
  '.tsx': { name: 'React Components', color: 0x61dafb, angle: Math.PI / 3 },
  '.js': { name: 'JavaScript', color: 0xf7df1e, angle: 2 * Math.PI / 3 },
  '.css': { name: 'Styles', color: 0x264de4, angle: Math.PI },
  '.json': { name: 'Config', color: 0x5a5a5a, angle: 4 * Math.PI / 3 },
  '.md': { name: 'Documentation', color: 0x083fa1, angle: 5 * Math.PI / 3 },
  'default': { name: 'Other', color: 0x888888, angle: Math.PI / 2 },
};

/**
 * City Layout Engine
 */
export class CityLayoutEngine {
  private centerPlazaRadius: number;
  
  constructor(_cityRadius: number = 150) {
    this.centerPlazaRadius = 30;
  }
  
  public calculateLayout(files: CityFileData[]): CityLayout {
    const streets: CityStreet[] = [];
    const districts: CityDistrict[] = [];
    const decorations: CityDecoration[] = [];
    const buildings: CityBuildingPosition[] = [];
    
    // Group files by extension
    const filesByType = this.groupByExtension(files);
    
    // Create districts for each file type
    let districtIndex = 0;
    for (const [ext, districtFiles] of filesByType) {
      const config = FILE_TYPE_DISTRICTS[ext] || FILE_TYPE_DISTRICTS['default'];
      const angle = config.angle + (districtIndex * 0.1); // Slight offset
      const distanceFromCenter = this.centerPlazaRadius + 40 + (districtIndex % 3) * 20;
      
      const district: CityDistrict = {
        name: config.name,
        centerX: Math.cos(angle) * distanceFromCenter,
        centerZ: Math.sin(angle) * distanceFromCenter,
        radius: 15 + Math.sqrt(districtFiles.length) * 8,
        color: config.color,
        files: districtFiles,
      };
      districts.push(district);
      
      // Create street from center to district
      streets.push({
        start: new THREE.Vector2(0, 0),
        end: new THREE.Vector2(district.centerX, district.centerZ),
        width: 6,
        type: 'main',
      });
      
      // Position buildings in district (spiral pattern)
      this.positionBuildingsInDistrict(district, buildings);
      
      // Add decorations around district
      this.addDistrictDecorations(district, decorations);
      
      districtIndex++;
    }
    
    // Add central plaza decorations
    this.addCentralPlazaDecorations(decorations);
    
    // Add connecting streets between adjacent districts
    this.addConnectingStreets(districts, streets);
    
    return { buildings, streets, districts, decorations };
  }
  
  private groupByExtension(files: CityFileData[]): Map<string, CityFileData[]> {
    const groups = new Map<string, CityFileData[]>();
    
    for (const file of files) {
      const ext = file.extension.toLowerCase();
      if (!groups.has(ext)) {
        groups.set(ext, []);
      }
      groups.get(ext)!.push(file);
    }
    
    // Sort by count (largest groups first)
    return new Map([...groups.entries()].sort((a, b) => b[1].length - a[1].length));
  }
  
  private positionBuildingsInDistrict(district: CityDistrict, buildings: CityBuildingPosition[]): void {
    const files = district.files;
    const centerX = district.centerX;
    const centerZ = district.centerZ;
    
    // Spiral layout
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
    
    files.forEach((file, i) => {
      // Spiral positioning
      const r = 5 + Math.sqrt(i) * 6;
      const theta = i * goldenAngle;
      
      const x = centerX + r * Math.cos(theta);
      const z = centerZ + r * Math.sin(theta);
      
      // Face toward district center
      const rotation = Math.atan2(centerZ - z, centerX - x);
      
      buildings.push({ file, x, z, rotation });
    });
  }
  
  private addDistrictDecorations(district: CityDistrict, decorations: CityDecoration[]): void {
    // Trees around district perimeter
    const treeCount = Math.floor(district.radius / 3);
    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2;
      const r = district.radius + 5 + Math.random() * 5;
      decorations.push({
        type: 'tree',
        x: district.centerX + Math.cos(angle) * r,
        z: district.centerZ + Math.sin(angle) * r,
        scale: 0.8 + Math.random() * 0.4,
      });
    }
    
    // Lamps along main street to district
    const steps = 5;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = district.centerX * t;
      const z = district.centerZ * t;
      
      // Lamps on both sides of street
      const perpX = -district.centerZ / Math.sqrt(district.centerX ** 2 + district.centerZ ** 2) * 4;
      const perpZ = district.centerX / Math.sqrt(district.centerX ** 2 + district.centerZ ** 2) * 4;
      
      decorations.push({ type: 'lamp', x: x + perpX, z: z + perpZ, scale: 1 });
      decorations.push({ type: 'lamp', x: x - perpX, z: z - perpZ, scale: 1 });
    }
  }
  
  private addCentralPlazaDecorations(decorations: CityDecoration[]): void {
    // Central fountain
    decorations.push({ type: 'fountain', x: 0, z: 0, scale: 2 });
    
    // Benches around plaza
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = this.centerPlazaRadius - 5;
      decorations.push({
        type: 'bench',
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        scale: 1,
      });
    }
    
    // Trees around plaza
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + 0.1;
      const r = this.centerPlazaRadius + 3;
      decorations.push({
        type: 'tree',
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        scale: 1.2,
      });
    }
  }
  
  private addConnectingStreets(districts: CityDistrict[], streets: CityStreet[]): void {
    // Connect adjacent districts with secondary streets
    for (let i = 0; i < districts.length; i++) {
      const nextI = (i + 1) % districts.length;
      const d1 = districts[i];
      const d2 = districts[nextI];
      
      streets.push({
        start: new THREE.Vector2(d1.centerX, d1.centerZ),
        end: new THREE.Vector2(d2.centerX, d2.centerZ),
        width: 3,
        type: 'secondary',
      });
    }
  }
}

/**
 * Create city streets mesh
 */
export function createCityStreets(streets: CityStreet[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'cityStreets';
  
  for (const street of streets) {
    const length = street.start.distanceTo(street.end);
    const angle = Math.atan2(street.end.y - street.start.y, street.end.x - street.start.x);
    const midX = (street.start.x + street.end.x) / 2;
    const midZ = (street.start.y + street.end.y) / 2;
    
    // Street surface
    const streetGeom = new THREE.PlaneGeometry(length, street.width);
    const streetColor = street.type === 'main' ? 0x1a1a2e : 0x151520;
    const streetMat = new THREE.MeshStandardMaterial({
      color: streetColor,
      roughness: 0.9,
    });
    const streetMesh = new THREE.Mesh(streetGeom, streetMat);
    streetMesh.rotation.x = -Math.PI / 2;
    streetMesh.rotation.z = -angle;
    streetMesh.position.set(midX, 0.02, midZ);
    group.add(streetMesh);
    
    // Glowing center line for main streets
    if (street.type === 'main') {
      const lineGeom = new THREE.PlaneGeometry(length, 0.3);
      const lineMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.8,
      });
      const line = new THREE.Mesh(lineGeom, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.rotation.z = -angle;
      line.position.set(midX, 0.03, midZ);
      group.add(line);
      
      // Edge glows
      for (const side of [-1, 1]) {
        const edgeGeom = new THREE.PlaneGeometry(length, 0.15);
        const edgeMat = new THREE.MeshBasicMaterial({
          color: 0x4fc3f7,
          transparent: true,
          opacity: 0.5,
        });
        const edge = new THREE.Mesh(edgeGeom, edgeMat);
        edge.rotation.x = -Math.PI / 2;
        edge.rotation.z = -angle;
        
        // Offset perpendicular to street direction
        const offsetX = Math.sin(angle) * (street.width / 2 - 0.1) * side;
        const offsetZ = -Math.cos(angle) * (street.width / 2 - 0.1) * side;
        edge.position.set(midX + offsetX, 0.03, midZ + offsetZ);
        group.add(edge);
      }
    }
  }
  
  return group;
}

/**
 * Create district ground plates
 */
export function createDistrictPlates(districts: CityDistrict[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'districtPlates';
  
  for (const district of districts) {
    // Circular ground plate
    const plateGeom = new THREE.CircleGeometry(district.radius, 32);
    const plateMat = new THREE.MeshStandardMaterial({
      color: district.color,
      transparent: true,
      opacity: 0.15,
      roughness: 0.8,
    });
    const plate = new THREE.Mesh(plateGeom, plateMat);
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(district.centerX, 0.01, district.centerZ);
    group.add(plate);
    
    // Glowing border ring
    const ringGeom = new THREE.RingGeometry(district.radius - 0.5, district.radius, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: district.color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(district.centerX, 0.02, district.centerZ);
    group.add(ring);
    
    // District label
    const label = createDistrictLabel(district.name, district.color);
    label.position.set(district.centerX, 8, district.centerZ);
    group.add(label);
  }
  
  // Central plaza
  const plazaGeom = new THREE.CircleGeometry(30, 64);
  const plazaMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a4e,
    roughness: 0.7,
  });
  const plaza = new THREE.Mesh(plazaGeom, plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.015;
  group.add(plaza);
  
  // Plaza ring
  const plazaRingGeom = new THREE.RingGeometry(29, 30, 64);
  const plazaRingMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.5,
  });
  const plazaRing = new THREE.Mesh(plazaRingGeom, plazaRingMat);
  plazaRing.rotation.x = -Math.PI / 2;
  plazaRing.position.y = 0.02;
  group.add(plazaRing);
  
  return group;
}

function createDistrictLabel(text: string, color: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  
  const ctx = canvas.getContext('2d')!;
  
  // Background
  const colorHex = '#' + color.toString(16).padStart(6, '0');
  ctx.fillStyle = colorHex + 'cc';
  ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 15);
  ctx.fill();
  
  // Border
  ctx.strokeStyle = '#ffffff44';
  ctx.lineWidth = 3;
  ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 15);
  ctx.stroke();
  
  // Text
  ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(20, 5, 1);
  
  return sprite;
}

/**
 * Create decorative elements
 */
export function createDecorations(decorations: CityDecoration[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'decorations';
  
  for (const deco of decorations) {
    let mesh: THREE.Group;
    
    switch (deco.type) {
      case 'tree':
        mesh = createLowPolyTree(deco.scale);
        break;
      case 'lamp':
        mesh = createStreetLamp(deco.scale);
        break;
      case 'bench':
        mesh = createBench(deco.scale);
        break;
      case 'fountain':
        mesh = createFountain(deco.scale);
        break;
    }
    
    mesh.position.set(deco.x, 0, deco.z);
    group.add(mesh);
  }
  
  return group;
}

function createLowPolyTree(scale: number): THREE.Group {
  const tree = new THREE.Group();
  
  // Trunk
  const trunkGeom = new THREE.CylinderGeometry(0.3, 0.4, 2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = 1;
  tree.add(trunk);
  
  // Foliage layers
  const colors = [0x2d5a27, 0x3d7a37, 0x4d8a47];
  const sizes = [2.5, 2, 1.5];
  const heights = [2.5, 3.5, 4.5];
  
  colors.forEach((color, i) => {
    const foliageGeom = new THREE.ConeGeometry(sizes[i], 2, 8);
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

function createStreetLamp(scale: number): THREE.Group {
  const lamp = new THREE.Group();
  
  // Pole
  const poleGeom = new THREE.CylinderGeometry(0.1, 0.15, 5, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333344 });
  const pole = new THREE.Mesh(poleGeom, poleMat);
  pole.position.y = 2.5;
  lamp.add(pole);
  
  // Arm
  const armGeom = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6);
  const arm = new THREE.Mesh(armGeom, poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.75, 4.8, 0);
  lamp.add(arm);
  
  // Light housing
  const housingGeom = new THREE.ConeGeometry(0.4, 0.6, 6);
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x222233 });
  const housing = new THREE.Mesh(housingGeom, housingMat);
  housing.position.set(1.5, 4.5, 0);
  housing.rotation.z = Math.PI;
  lamp.add(housing);
  
  // Light glow
  const lightGeom = new THREE.SphereGeometry(0.3, 8, 8);
  const lightMat = new THREE.MeshBasicMaterial({
    color: 0xffcc66,
    transparent: true,
    opacity: 0.9,
  });
  const light = new THREE.Mesh(lightGeom, lightMat);
  light.position.set(1.5, 4.2, 0);
  lamp.add(light);
  
  // Light cone (volumetric)
  const coneGeom = new THREE.ConeGeometry(2, 4, 16, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffcc66,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(coneGeom, coneMat);
  cone.position.set(1.5, 2, 0);
  lamp.add(cone);
  
  lamp.scale.setScalar(scale);
  return lamp;
}

function createBench(scale: number): THREE.Group {
  const bench = new THREE.Group();
  
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x333344 });
  
  // Seat
  const seatGeom = new THREE.BoxGeometry(2, 0.1, 0.6);
  const seat = new THREE.Mesh(seatGeom, woodMat);
  seat.position.y = 0.6;
  bench.add(seat);
  
  // Back
  const backGeom = new THREE.BoxGeometry(2, 0.6, 0.1);
  const back = new THREE.Mesh(backGeom, woodMat);
  back.position.set(0, 1, -0.25);
  bench.add(back);
  
  // Legs
  for (const x of [-0.8, 0.8]) {
    const legGeom = new THREE.BoxGeometry(0.1, 0.6, 0.5);
    const leg = new THREE.Mesh(legGeom, metalMat);
    leg.position.set(x, 0.3, 0);
    bench.add(leg);
  }
  
  bench.scale.setScalar(scale);
  return bench;
}

function createFountain(scale: number): THREE.Group {
  const fountain = new THREE.Group();
  
  // Base pool
  const poolGeom = new THREE.CylinderGeometry(4, 4.5, 0.8, 16);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a6a7a });
  const pool = new THREE.Mesh(poolGeom, stoneMat);
  pool.position.y = 0.4;
  fountain.add(pool);
  
  // Water
  const waterGeom = new THREE.CylinderGeometry(3.5, 3.5, 0.3, 16);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3399ff,
    transparent: true,
    opacity: 0.6,
  });
  const water = new THREE.Mesh(waterGeom, waterMat);
  water.position.y = 0.65;
  fountain.add(water);
  
  // Central pillar
  const pillarGeom = new THREE.CylinderGeometry(0.5, 0.7, 3, 8);
  const pillar = new THREE.Mesh(pillarGeom, stoneMat);
  pillar.position.y = 2;
  fountain.add(pillar);
  
  // Top bowl
  const bowlGeom = new THREE.CylinderGeometry(1.5, 1, 0.5, 12);
  const bowl = new THREE.Mesh(bowlGeom, stoneMat);
  bowl.position.y = 3.5;
  fountain.add(bowl);
  
  // Water spray (particles would be better, but using a simple mesh)
  const sprayGeom = new THREE.ConeGeometry(0.3, 2, 8);
  const sprayMat = new THREE.MeshBasicMaterial({
    color: 0x66ccff,
    transparent: true,
    opacity: 0.4,
  });
  const spray = new THREE.Mesh(sprayGeom, sprayMat);
  spray.position.y = 4.5;
  fountain.add(spray);
  
  fountain.scale.setScalar(scale);
  return fountain;
}
