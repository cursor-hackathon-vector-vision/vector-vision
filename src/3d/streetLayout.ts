import * as THREE from 'three';

/**
 * STREET LAYOUT ENGINE v2
 * 
 * Hauptstraße: Süd → Nord (entlang -Z Achse)
 * Seitenstraßen: West/Ost (entlang X Achse)
 * Sub-Ordner: Parallel zur Hauptstraße (entlang -Z)
 * Buildings: Immer auf NORDSEITE der Straßen
 */

// ============================================================
// TYPES
// ============================================================

export interface StreetLayoutConfig {
  mainStreetLength: number;      // Länge der Hauptstraße
  mainStreetWidth: number;       // Breite (inkl. Lanes + Gehwege)
  sideStreetWidth: number;       // Breite der Seitenstraßen
  buildingSpacing: number;       // Abstand zwischen Gebäuden
  laneWidth: number;             // Breite einer Fahrspur
  sidewalkWidth: number;         // Breite Gehweg
}

export interface FolderNode {
  path: string;
  name: string;
  depth: number;              // Tiefe in der Hierarchie (0 = root)
  files: string[];            // Datei-Pfade in diesem Ordner
  children: FolderNode[];     // Sub-Ordner
}

export interface StreetSegment {
  id: string;
  type: 'main' | 'side' | 'sub';
  start: THREE.Vector3;
  end: THREE.Vector3;
  width: number;
  folderPath?: string;
  parentStreet?: string;
}

export interface BuildingSlot {
  id: string;
  filePath: string;
  position: THREE.Vector3;
  rotation: number;
  streetId: string;
}

export interface DistrictSign {
  text: string;
  position: THREE.Vector3;
  rotation: number;
  color: number;
}

export interface StreetLayout {
  streets: StreetSegment[];
  buildingSlots: BuildingSlot[];
  districtSigns: DistrictSign[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

// ============================================================
// DEFAULT CONFIG
// ============================================================

const DEFAULT_CONFIG: StreetLayoutConfig = {
  mainStreetLength: 200,
  mainStreetWidth: 16,       // cats(2) + user(4) + median(2) + ai(4) + cats(2) + margins
  sideStreetWidth: 8,
  buildingSpacing: 5,
  laneWidth: 4,
  sidewalkWidth: 2,
};

// Directory colors
const DIR_COLORS = [
  0x4fc3f7, // Cyan
  0x81c784, // Green  
  0xffb74d, // Orange
  0xba68c8, // Purple
  0x64b5f6, // Blue
  0xf06292, // Pink
  0xfff176, // Yellow
  0x4db6ac, // Teal
];

// ============================================================
// LAYOUT CALCULATION
// ============================================================

/**
 * Berechnet das komplette Street Layout basierend auf der Ordnerstruktur
 */
export function calculateStreetLayout(
  folders: FolderNode[],
  config: Partial<StreetLayoutConfig> = {}
): StreetLayout {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  const streets: StreetSegment[] = [];
  const buildingSlots: BuildingSlot[] = [];
  const districtSigns: DistrictSign[] = [];
  
  // Hauptstraße: von Süd (+Z) nach Nord (-Z)
  const mainStreet: StreetSegment = {
    id: 'main',
    type: 'main',
    start: new THREE.Vector3(0, 0, cfg.mainStreetLength / 2),
    end: new THREE.Vector3(0, 0, -cfg.mainStreetLength / 2),
    width: cfg.mainStreetWidth,
  };
  streets.push(mainStreet);
  
  // Sortiere Ordner nach Tiefe 0 (top-level)
  const topLevelFolders = folders.filter(f => f.depth === 0);
  
  console.log('[StreetLayout] Top-level folders:', topLevelFolders.length);
  
  // Fallback: If no folders found, collect all file paths from input
  if (topLevelFolders.length === 0) {
    console.log('[StreetLayout] No folders - creating simple layout along main street');
    // This shouldn't happen normally but let's handle it
  }
  
  // Verteile Seitenstraßen entlang der Hauptstraße
  const streetSpacing = cfg.mainStreetLength / (Math.max(topLevelFolders.length, 1) + 1);
  
  topLevelFolders.forEach((folder, index) => {
    // Alterniere West (-X) / Ost (+X)
    const side = index % 2 === 0 ? -1 : 1;
    
    // Z-Position entlang der Hauptstraße (von Süd nach Nord)
    const zPos = cfg.mainStreetLength / 2 - (index + 1) * streetSpacing;
    
    // Erstelle Seitenstraße
    const sideStreetLength = 30 + folder.files.length * cfg.buildingSpacing;
    const sideStreet: StreetSegment = {
      id: `side-${folder.path}`,
      type: 'side',
      start: new THREE.Vector3(0, 0, zPos),
      end: new THREE.Vector3(side * sideStreetLength, 0, zPos),
      width: cfg.sideStreetWidth,
      folderPath: folder.path,
      parentStreet: 'main',
    };
    streets.push(sideStreet);
    
    // District Sign
    districtSigns.push({
      text: folder.name,
      position: new THREE.Vector3(side * 5, 0, zPos),
      rotation: side > 0 ? -Math.PI / 2 : Math.PI / 2,
      color: DIR_COLORS[index % DIR_COLORS.length],
    });
    
    // Platziere Buildings entlang der Seitenstraße (NORDSEITE = -Z Offset)
    folder.files.forEach((filePath, fileIndex) => {
      const xPos = side * (10 + fileIndex * cfg.buildingSpacing);
      const zOffset = -cfg.sideStreetWidth / 2 - 3; // Nordseite der Straße
      
      buildingSlots.push({
        id: `slot-${filePath}`,
        filePath,
        position: new THREE.Vector3(xPos, 0, zPos + zOffset),
        rotation: 0,
        streetId: sideStreet.id,
      });
    });
    
    // Rekursiv: Sub-Ordner als parallele Straßen
    processSubFolders(
      folder.children,
      sideStreet,
      side,
      streets,
      buildingSlots,
      districtSigns,
      cfg,
      1, // depth
      index // colorIndex
    );
  });
  
  // Berechne Bounds
  const allPositions = [
    ...streets.flatMap(s => [s.start, s.end]),
    ...buildingSlots.map(b => b.position),
  ];
  
  const bounds = {
    minX: Math.min(...allPositions.map(p => p.x)) - 20,
    maxX: Math.max(...allPositions.map(p => p.x)) + 20,
    minZ: Math.min(...allPositions.map(p => p.z)) - 20,
    maxZ: Math.max(...allPositions.map(p => p.z)) + 20,
  };
  
  console.log(`[StreetLayout] Generated ${streets.length} streets, ${buildingSlots.length} building slots`);
  
  return { streets, buildingSlots, districtSigns, bounds };
}

/**
 * Verarbeitet Sub-Ordner rekursiv
 * Sub-Straßen gehen PARALLEL zur Hauptstraße (nach Norden)
 */
function processSubFolders(
  subFolders: FolderNode[],
  parentStreet: StreetSegment,
  parentSide: number,
  streets: StreetSegment[],
  buildingSlots: BuildingSlot[],
  districtSigns: DistrictSign[],
  cfg: StreetLayoutConfig,
  depth: number,
  colorIndex: number
): void {
  if (subFolders.length === 0 || depth > 3) return; // Max 3 Ebenen
  
  const parentEnd = parentStreet.end;
  
  subFolders.forEach((subFolder, index) => {
    // Sub-Straße geht parallel zur Hauptstraße (nach Norden = -Z)
    const xOffset = parentSide * (index + 1) * 15;
    const subStreetLength = 20 + subFolder.files.length * cfg.buildingSpacing;
    
    const subStreet: StreetSegment = {
      id: `sub-${subFolder.path}`,
      type: 'sub',
      start: new THREE.Vector3(parentEnd.x + xOffset, 0, parentEnd.z),
      end: new THREE.Vector3(parentEnd.x + xOffset, 0, parentEnd.z - subStreetLength),
      width: cfg.sideStreetWidth * 0.8,
      folderPath: subFolder.path,
      parentStreet: parentStreet.id,
    };
    streets.push(subStreet);
    
    // District Sign für Sub-Ordner
    districtSigns.push({
      text: subFolder.name,
      position: new THREE.Vector3(parentEnd.x + xOffset, 0, parentEnd.z - 3),
      rotation: 0,
      color: DIR_COLORS[(colorIndex + index + 1) % DIR_COLORS.length],
    });
    
    // Buildings entlang Sub-Straße (NORDSEITE = -X oder +X je nach Seite)
    const buildingSide = parentSide > 0 ? 1 : -1;
    
    subFolder.files.forEach((filePath, fileIndex) => {
      const zPos = parentEnd.z - 5 - fileIndex * cfg.buildingSpacing;
      const xOffset2 = buildingSide * (cfg.sideStreetWidth / 2 + 3);
      
      buildingSlots.push({
        id: `slot-${filePath}`,
        filePath,
        position: new THREE.Vector3(parentEnd.x + xOffset + xOffset2, 0, zPos),
        rotation: buildingSide > 0 ? -Math.PI / 2 : Math.PI / 2,
        streetId: subStreet.id,
      });
    });
    
    // Rekursiv für weitere Sub-Ordner
    processSubFolders(
      subFolder.children,
      subStreet,
      parentSide,
      streets,
      buildingSlots,
      districtSigns,
      cfg,
      depth + 1,
      colorIndex + index
    );
  });
}

// ============================================================
// FOLDER TREE BUILDER
// ============================================================

/**
 * Erstellt einen Ordner-Baum aus einer flachen Dateiliste
 */
export function buildFolderTree(files: { path: string; directory: string }[]): FolderNode[] {
  const folderMap = new Map<string, FolderNode>();
  const rootFiles: string[] = []; // Files without a proper directory
  
  console.log('[FolderTree] Processing', files.length, 'files');
  
  // Sammle alle Ordner
  for (const file of files) {
    let dir = file.directory || '/';
    
    // Normalize directory - extract from path if directory is just '/'
    if (dir === '/' && file.path.includes('/')) {
      const pathParts = file.path.split('/');
      pathParts.pop(); // Remove filename
      dir = pathParts.join('/') || '/';
    }
    
    const parts = dir.split('/').filter(p => p && p !== '.');
    
    if (parts.length === 0) {
      // Root file
      rootFiles.push(file.path);
      continue;
    }
    
    let currentPath = '';
    
    for (let i = 0; i < parts.length; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      
      if (!folderMap.has(currentPath)) {
        folderMap.set(currentPath, {
          path: currentPath,
          name: parts[i],
          depth: i,
          files: [],
          children: [],
        });
      }
    }
    
    // Füge Datei zum direkten Ordner hinzu
    const directFolder = folderMap.get(currentPath);
    if (directFolder) {
      directFolder.files.push(file.path);
    }
  }
  
  console.log('[FolderTree] Found', folderMap.size, 'folders,', rootFiles.length, 'root files');
  
  // Baue Baum-Struktur
  const rootFolders: FolderNode[] = [];
  
  for (const [path, node] of folderMap) {
    const parts = path.split('/').filter(p => p);
    
    if (parts.length === 1) {
      // Top-level folder
      rootFolders.push(node);
    } else {
      // Sub-folder - finde Parent
      const parentPath = parts.slice(0, -1).join('/');
      const parent = folderMap.get(parentPath);
      if (parent) {
        parent.children.push(node);
      }
    }
  }
  
  // Add root files as a special folder if there are any
  if (rootFiles.length > 0) {
    rootFolders.push({
      path: '/',
      name: 'root',
      depth: 0,
      files: rootFiles,
      children: [],
    });
  }
  
  // Sortiere nach Anzahl der Dateien (größte zuerst)
  rootFolders.sort((a, b) => getTotalFiles(b) - getTotalFiles(a));
  
  console.log('[FolderTree] Result:', rootFolders.map(f => `${f.name}(${f.files.length})`).join(', '));
  
  return rootFolders;
}

function getTotalFiles(node: FolderNode): number {
  return node.files.length + node.children.reduce((sum, child) => sum + getTotalFiles(child), 0);
}

// ============================================================
// RENDERING
// ============================================================

/**
 * Rendert die Hauptstraße mit Lanes und Gehwegen
 */
export function renderMainStreet(
  street: StreetSegment,
  group: THREE.Group
): void {
  const length = street.start.distanceTo(street.end);
  const centerZ = (street.start.z + street.end.z) / 2;
  
  // Hauptstraßen-Oberfläche (dunkel)
  const roadGeom = new THREE.PlaneGeometry(street.width, length);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.8,
    metalness: 0.2,
  });
  const road = new THREE.Mesh(roadGeom, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.01, centerZ);
  group.add(road);
  
  // LANE LAYOUT: | cats(2) | user(4) | median(2) | ai(4) | cats(2) |
  // Total: 14, centered at x=0
  
  // Gehwege (Sidewalks) - wo die Katzen laufen
  for (const side of [-1, 1]) {
    const sidewalkGeom = new THREE.PlaneGeometry(2, length);
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a4e,
      roughness: 0.7,
    });
    const sidewalk = new THREE.Mesh(sidewalkGeom, sidewalkMat);
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(side * 7, 0.02, centerZ);
    sidewalk.userData = { isSidewalk: true, side };
    group.add(sidewalk);
    
    // Gehweg-Kante (glow)
    const edgeGeom = new THREE.PlaneGeometry(0.15, length);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0x4fc3f7,
      transparent: true,
      opacity: 0.6,
    });
    const edge = new THREE.Mesh(edgeGeom, edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(side * 6, 0.03, centerZ);
    group.add(edge);
  }
  
  // Glühender Median in der Mitte
  const medianGeom = new THREE.PlaneGeometry(0.4, length);
  const medianMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.9,
  });
  const median = new THREE.Mesh(medianGeom, medianMat);
  median.rotation.x = -Math.PI / 2;
  median.position.set(0, 0.03, centerZ);
  group.add(median);
  
  // Gestrichelte Lane-Markierungen
  const dashCount = Math.floor(length / 8);
  for (const laneX of [-3, 3]) { // User lane at -3, AI lane at +3
    for (let i = 0; i < dashCount; i++) {
      const dashGeom = new THREE.PlaneGeometry(0.12, 3);
      const dashMat = new THREE.MeshBasicMaterial({
        color: 0x4fc3f7,
        transparent: true,
        opacity: 0.5,
      });
      const dash = new THREE.Mesh(dashGeom, dashMat);
      dash.rotation.x = -Math.PI / 2;
      const zPos = street.start.z - i * 8 - 4;
      dash.position.set(laneX, 0.025, zPos);
      group.add(dash);
    }
  }
  
  // Start/End Marker
  for (const z of [street.start.z, street.end.z]) {
    const markerGeom = new THREE.BoxGeometry(street.width + 4, 0.3, 2);
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.5,
    });
    const marker = new THREE.Mesh(markerGeom, markerMat);
    marker.position.set(0, 0.15, z);
    group.add(marker);
  }
  
  // Store layout info
  group.userData = {
    sidewalkZ: [7, -7],
    userLaneX: -3,
    aiLaneX: 3,
    length,
  };
}

/**
 * Rendert eine Seitenstraße
 */
export function renderSideStreet(
  street: StreetSegment,
  group: THREE.Group
): void {
  const start = street.start;
  const end = street.end;
  const direction = end.clone().sub(start);
  const length = direction.length();
  const center = start.clone().add(end).multiplyScalar(0.5);
  
  // Straßenoberfläche
  const roadGeom = new THREE.PlaneGeometry(length, street.width);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.85,
    metalness: 0.15,
  });
  const road = new THREE.Mesh(roadGeom, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.copy(center);
  road.position.y = 0.01;
  
  // Rotation für Ost-West Ausrichtung
  road.rotation.z = Math.atan2(direction.x, direction.z) - Math.PI / 2;
  group.add(road);
  
  // Mittelstreifen
  const stripeGeom = new THREE.PlaneGeometry(length, 0.2);
  const stripeMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.7,
  });
  const stripe = new THREE.Mesh(stripeGeom, stripeMat);
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.copy(center);
  stripe.position.y = 0.02;
  stripe.rotation.z = road.rotation.z;
  group.add(stripe);
  
  // Randlinien
  for (const offset of [-street.width / 2 + 0.2, street.width / 2 - 0.2]) {
    const edgeGeom = new THREE.PlaneGeometry(length, 0.1);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0x4fc3f7,
      transparent: true,
      opacity: 0.5,
    });
    const edge = new THREE.Mesh(edgeGeom, edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.copy(center);
    edge.position.y = 0.02;
    edge.rotation.z = road.rotation.z;
    
    // Offset perpendicular
    const perp = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    edge.position.add(perp.multiplyScalar(offset));
    group.add(edge);
  }
}

/**
 * Rendert ein District Sign auf dem Boden
 */
export function renderDistrictSign(
  sign: DistrictSign,
  group: THREE.Group
): void {
  // Canvas für Text
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  
  // Hintergrund mit Farbe
  const colorHex = '#' + sign.color.toString(16).padStart(6, '0');
  ctx.fillStyle = colorHex;
  ctx.globalAlpha = 0.8;
  ctx.fillRect(0, 0, 512, 128);
  
  // Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 508, 124);
  
  // Text
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sign.text.toUpperCase(), 256, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  
  // Als Plane auf dem Boden
  const signGeom = new THREE.PlaneGeometry(12, 3);
  const signMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.95,
  });
  const signMesh = new THREE.Mesh(signGeom, signMat);
  signMesh.rotation.x = -Math.PI / 2;
  signMesh.rotation.z = sign.rotation;
  signMesh.position.copy(sign.position);
  signMesh.position.y = 0.05;
  
  group.add(signMesh);
  
  // Glühende Umrandung
  const glowGeom = new THREE.PlaneGeometry(13, 4);
  const glowMat = new THREE.MeshBasicMaterial({
    color: sign.color,
    transparent: true,
    opacity: 0.3,
  });
  const glow = new THREE.Mesh(glowGeom, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.rotation.z = sign.rotation;
  glow.position.copy(sign.position);
  glow.position.y = 0.04;
  
  group.add(glow);
}

/**
 * Rendert das komplette Street Layout
 */
export function renderStreetLayout(
  layout: StreetLayout,
  streetGroup: THREE.Group,
  signGroup: THREE.Group
): void {
  // Clear existing
  while (streetGroup.children.length > 0) {
    streetGroup.remove(streetGroup.children[0]);
  }
  while (signGroup.children.length > 0) {
    signGroup.remove(signGroup.children[0]);
  }
  
  // Render streets
  for (const street of layout.streets) {
    if (street.type === 'main') {
      renderMainStreet(street, streetGroup);
    } else {
      renderSideStreet(street, streetGroup);
    }
  }
  
  // Render district signs
  for (const sign of layout.districtSigns) {
    renderDistrictSign(sign, signGroup);
  }
  
  console.log(`[StreetLayout] Rendered ${layout.streets.length} streets, ${layout.districtSigns.length} signs`);
}
