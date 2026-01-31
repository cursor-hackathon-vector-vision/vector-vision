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

// Minimum angle between districts (in radians) - prevents crowding
const MIN_DISTRICT_ANGLE = Math.PI / 4; // 45 degrees minimum

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
  0xfcbad3, // Pink
];

/**
 * City Layout Engine with proper spacing and sub-streets
 */
export class CityLayoutEngine {
  private centerPlazaRadius: number;
  
  constructor(_cityRadius: number = 150) {
    this.centerPlazaRadius = 25;
  }
  
  public calculateLayout(files: CityFileData[]): CityLayout {
    const streets: CityStreet[] = [];
    const districts: CityDistrict[] = [];
    const decorations: CityDecoration[] = [];
    const buildings: CityBuildingPosition[] = [];
    
    // Group files by extension
    const filesByType = this.groupByExtension(files);
    const numDistricts = filesByType.size;
    
    // Calculate evenly spaced angles with minimum spacing
    const angleStep = Math.max(MIN_DISTRICT_ANGLE, (2 * Math.PI) / numDistricts);
    
    // Create districts for each file type
    let districtIndex = 0;
    for (const [ext, districtFiles] of filesByType) {
      // Evenly distribute angles around the circle
      const angle = districtIndex * angleStep;
      
      // Vary distance based on file count (bigger districts further out)
      const baseDistance = this.centerPlazaRadius + 50;
      const distanceVariation = Math.sqrt(districtFiles.length) * 5;
      const distanceFromCenter = baseDistance + distanceVariation;
      
      const districtRadius = 15 + Math.sqrt(districtFiles.length) * 6;
      const color = DISTRICT_COLORS[districtIndex % DISTRICT_COLORS.length];
      
      const district: CityDistrict = {
        name: this.getDistrictName(ext),
        centerX: Math.cos(angle) * distanceFromCenter,
        centerZ: Math.sin(angle) * distanceFromCenter,
        radius: districtRadius,
        color: color,
        files: districtFiles,
      };
      districts.push(district);
      
      // Create main street from center to district
      streets.push({
        start: new THREE.Vector2(0, 0),
        end: new THREE.Vector2(district.centerX, district.centerZ),
        width: 5,
        type: 'main',
      });
      
      // Position buildings with sub-street system
      this.positionBuildingsWithSubStreets(district, buildings, streets);
      
      // Add trees around district
      this.addDistrictTrees(district, decorations);
      
      districtIndex++;
    }
    
    // Add central plaza decorations
    this.addCentralPlazaDecorations(decorations);
    
    return { buildings, streets, districts, decorations };
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
      '.py': 'Python',
    };
    return names[ext] || ext.replace('.', '').toUpperCase();
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
  
  /**
   * Position buildings along sub-streets radiating from district center
   */
  private positionBuildingsWithSubStreets(
    district: CityDistrict, 
    buildings: CityBuildingPosition[],
    streets: CityStreet[]
  ): void {
    const files = district.files;
    const centerX = district.centerX;
    const centerZ = district.centerZ;
    
    if (files.length === 0) return;
    
    // Calculate number of sub-streets based on file count
    const numSubStreets = Math.max(3, Math.min(6, Math.ceil(files.length / 4)));
    const filesPerStreet = Math.ceil(files.length / numSubStreets);
    
    // Angle toward main plaza (to avoid sub-streets pointing back)
    const angleToCenter = Math.atan2(-centerZ, -centerX);
    
    for (let streetIdx = 0; streetIdx < numSubStreets; streetIdx++) {
      // Fan out sub-streets in a semi-circle away from center
      const streetAngleSpread = Math.PI * 0.8; // 144 degree spread
      const streetAngle = angleToCenter + Math.PI + 
        (streetIdx - (numSubStreets - 1) / 2) * (streetAngleSpread / Math.max(1, numSubStreets - 1));
      
      // Sub-street length based on files on this street
      const streetLength = 8 + filesPerStreet * 5;
      
      // Create sub-street
      const streetEndX = centerX + Math.cos(streetAngle) * streetLength;
      const streetEndZ = centerZ + Math.sin(streetAngle) * streetLength;
      
      streets.push({
        start: new THREE.Vector2(centerX, centerZ),
        end: new THREE.Vector2(streetEndX, streetEndZ),
        width: 2.5,
        type: 'secondary',
      });
      
      // Place buildings along this sub-street
      const startFileIdx = streetIdx * filesPerStreet;
      const endFileIdx = Math.min(startFileIdx + filesPerStreet, files.length);
      
      for (let i = startFileIdx; i < endFileIdx; i++) {
        const file = files[i];
        const positionOnStreet = (i - startFileIdx + 1) / (filesPerStreet + 1);
        
        // Alternate sides of the street
        const side = (i % 2 === 0) ? 1 : -1;
        const sideOffset = 4; // Distance from street center
        
        // Position along street
        const alongX = centerX + Math.cos(streetAngle) * streetLength * positionOnStreet;
        const alongZ = centerZ + Math.sin(streetAngle) * streetLength * positionOnStreet;
        
        // Perpendicular offset
        const perpAngle = streetAngle + Math.PI / 2;
        const x = alongX + Math.cos(perpAngle) * sideOffset * side;
        const z = alongZ + Math.sin(perpAngle) * sideOffset * side;
        
        // Face the street
        const rotation = streetAngle + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        
        buildings.push({ file, x, z, rotation });
      }
    }
  }
  
  private addDistrictTrees(district: CityDistrict, decorations: CityDecoration[]): void {
    // Fewer trees, just at district corners
    const treeCount = 6;
    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2;
      const r = district.radius + 8;
      decorations.push({
        type: 'tree',
        x: district.centerX + Math.cos(angle) * r,
        z: district.centerZ + Math.sin(angle) * r,
        scale: 0.7 + Math.random() * 0.3,
      });
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
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.1;
      const r = this.centerPlazaRadius + 5;
      decorations.push({
        type: 'tree',
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        scale: 1,
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
 * Create district markers - just glowing rings, no filled plates
 */
export function createDistrictPlates(districts: CityDistrict[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'districtMarkers';
  
  for (const district of districts) {
    // Just a glowing ring outline - no filled plate
    const ringGeom = new THREE.RingGeometry(district.radius - 0.3, district.radius, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: district.color,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(district.centerX, 0.02, district.centerZ);
    group.add(ring);
    
    // District label
    const label = createDistrictLabel(district.name, district.color);
    label.position.set(district.centerX, 10, district.centerZ);
    group.add(label);
  }
  
  // Central plaza - just a ring, no fill
  const plazaRingGeom = new THREE.RingGeometry(24, 25, 64);
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
