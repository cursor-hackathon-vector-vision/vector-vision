import * as THREE from 'three';
import type { ProjectSnapshot, FileNode, ChatMessage } from '../types';
import { 
  AdvancedLayoutEngine, 
  createDistrictMesh, 
  createStreetMesh,
  createConnectionArc,
  updateConnectionArcs
} from './advancedLayout';

/**
 * LIVING CODE ARCHITECTURE
 * 
 * A fusion of Code City + Neural Network:
 * - Buildings made from actual code content
 * - Each line of code = one "floor" 
 * - Functions = illuminated segments
 * - Imports = glowing connection lines
 * - Light, modern aesthetic with soft colors
 */

// Extended file info with content
interface FileWithContent extends FileNode {
  content?: string;
  lines?: string[];
  functions?: string[];
  imports?: string[];
}

interface CodeBuilding {
  id: string;
  fileNode: FileWithContent;
  group: THREE.Group;
  mesh: THREE.Mesh;
  floors: THREE.Mesh[];
  textCanvas: HTMLCanvasElement;
  textTexture: THREE.CanvasTexture;
  position: THREE.Vector3;
  targetY: number;
  currentY: number;
  height: number;  // Store building height
  glowMesh?: THREE.Mesh;
  label: THREE.Sprite;
  isNew: boolean;
  pulsePhase: number;
}

interface Connection {
  from: string;
  to: string;
  line: THREE.Line;
  particles: THREE.Points;
  particlePositions: Float32Array;
}

interface StreetCat {
  group: THREE.Group;
  position: THREE.Vector3;
  targetPosition: THREE.Vector3;
  speed: number;
  direction: number;
  walkPhase: number;
  meowBubble: THREE.Sprite | null;
  meowTimer: number;
  tailPhase: number;
  color: number;
}

// Bright, vibrant color palette for better visibility
const FILE_COLORS: Record<string, { base: string; glow: string; accent: string }> = {
  '.ts':   { base: '#00d4ff', glow: '#66e5ff', accent: '#00b8e6' },  // Bright cyan
  '.tsx':  { base: '#00ffcc', glow: '#66ffd9', accent: '#00e6b8' },  // Bright teal
  '.js':   { base: '#ffeb3b', glow: '#fff176', accent: '#fdd835' },  // Bright yellow
  '.jsx':  { base: '#ffb300', glow: '#ffc633', accent: '#ffa000' },  // Bright amber
  '.css':  { base: '#e040fb', glow: '#ea80fc', accent: '#d500f9' },  // Bright purple
  '.scss': { base: '#ff4081', glow: '#ff80ab', accent: '#f50057' },  // Bright pink
  '.html': { base: '#ff6e40', glow: '#ff9e80', accent: '#ff5722' },  // Bright orange
  '.json': { base: '#69f0ae', glow: '#b9f6ca', accent: '#00e676' },  // Bright green
  '.md':   { base: '#82b1ff', glow: '#b3d4ff', accent: '#448aff' },  // Bright blue
  '.py':   { base: '#448aff', glow: '#82b1ff', accent: '#2979ff' },  // Python blue
  '.rs':   { base: '#ff7043', glow: '#ffab91', accent: '#ff5722' },  // Rust orange
  '.go':   { base: '#26c6da', glow: '#80deea', accent: '#00bcd4' },  // Go cyan
  'default': { base: '#b0bec5', glow: '#eceff1', accent: '#78909c' }, // Grey
};

export class CodeArchitecture {
  private scene: THREE.Scene;
  private buildings: Map<string, CodeBuilding> = new Map();
  private connections: Connection[] = [];
  
  // Groups
  private buildingGroup: THREE.Group;
  private connectionGroup: THREE.Group;
  private groundGroup: THREE.Group;
  private effectsGroup: THREE.Group;
  
  // Animation
  private time: number = 0;
  private chatParticles: THREE.Points[] = [];
  
  // Street cats!
  private cats: StreetCat[] = [];
  
  // Ground plane
  private ground: THREE.Mesh | null = null;
  
  // Advanced layout system
  private layoutEngine: AdvancedLayoutEngine;
  private districts: THREE.Group[] = [];
  private connectionArcs: THREE.Group[] = [];
  private layoutStreets: THREE.Mesh[] = [];
  private districtGroup: THREE.Group;
  private streetGroup: THREE.Group;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    
    // Initialize advanced layout engine - size matches ground plane
    this.layoutEngine = new AdvancedLayoutEngine(400, 400, 4);
    
    // Create groups
    this.groundGroup = new THREE.Group();
    this.groundGroup.name = 'ground';
    this.districtGroup = new THREE.Group();
    this.districtGroup.name = 'districts';
    this.streetGroup = new THREE.Group();
    this.streetGroup.name = 'streets';
    this.buildingGroup = new THREE.Group();
    this.buildingGroup.name = 'buildings';
    this.connectionGroup = new THREE.Group();
    this.connectionGroup.name = 'connections';
    this.effectsGroup = new THREE.Group();
    this.effectsGroup.name = 'effects';
    
    scene.add(this.groundGroup);
    scene.add(this.districtGroup);
    scene.add(this.streetGroup);
    scene.add(this.connectionGroup);
    scene.add(this.buildingGroup);
    scene.add(this.effectsGroup);
    
    // Setup environment
    this.setupEnvironment();
  }
  
  private setupEnvironment(): void {
    // Soft gradient background (set via scene background)
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Create soft gradient - slightly brighter
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#1e2a4a');    // Blue top
    gradient.addColorStop(0.5, '#152238');  // Mid
    gradient.addColorStop(1, '#0a1628');    // Dark bottom
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 512);
    
    const bgTexture = new THREE.CanvasTexture(canvas);
    bgTexture.needsUpdate = true;
    this.scene.background = bgTexture;
    
    // More ambient light for better visibility
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    
    // Directional light (sun-like)
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(50, 100, 50);
    directional.castShadow = true;
    this.scene.add(directional);
    
    // Second directional for fill
    const directional2 = new THREE.DirectionalLight(0x4fc3f7, 0.3);
    directional2.position.set(-50, 50, -50);
    this.scene.add(directional2);
    
    // Hemisphere light for soft fill
    const hemi = new THREE.HemisphereLight(0x88aaff, 0x444466, 0.4);
    this.scene.add(hemi);
    
    // Create the futuristic ground with streets
    this.createFuturisticGround();
    
    // Add floating particles in background
    this.createAmbientParticles();
    
    // Add cute street cats!
    this.createStreetCats();
  }
  
  private createFuturisticGround(): void {
    // Main ground plane - dark with slight glow - larger to cover all districts
    const groundSize = 500;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 100, 100);
    
    // Create ground texture with grid pattern
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 1024;
    groundCanvas.height = 1024;
    const gctx = groundCanvas.getContext('2d')!;
    
    // Dark base
    gctx.fillStyle = '#0a1020';
    gctx.fillRect(0, 0, 1024, 1024);
    
    // Subtle grid
    gctx.strokeStyle = '#1a2a4a';
    gctx.lineWidth = 1;
    const gridSpacing = 32;
    for (let i = 0; i <= 1024; i += gridSpacing) {
      gctx.beginPath();
      gctx.moveTo(i, 0);
      gctx.lineTo(i, 1024);
      gctx.stroke();
      gctx.beginPath();
      gctx.moveTo(0, i);
      gctx.lineTo(1024, i);
      gctx.stroke();
    }
    
    const groundTexture = new THREE.CanvasTexture(groundCanvas);
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(8, 8);
    
    const groundMaterial = new THREE.MeshStandardMaterial({
      map: groundTexture,
      roughness: 0.9,
      metalness: 0.1,
    });
    
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.1;
    this.ground.receiveShadow = true;
    this.groundGroup.add(this.ground);
    
    // NOTE: Streets are now created by AdvancedLayoutEngine in updateFromSnapshot()
    // Old street system disabled to prevent duplicates
    
    // Add street lights along where the main street will be
    this.createStreetLights();
  }
  
  // @ts-ignore - Deprecated: Streets now created by AdvancedLayoutEngine
  private _legacyCreateMainStreet(): void {
    // Main highway running through the center (Git Main Branch)
    const streetWidth = 8;
    const streetLength = 250;
    
    // Street surface
    const streetGeometry = new THREE.PlaneGeometry(streetWidth, streetLength);
    
    // Create street texture with lane markings
    const streetCanvas = document.createElement('canvas');
    streetCanvas.width = 256;
    streetCanvas.height = 1024;
    const sctx = streetCanvas.getContext('2d')!;
    
    // Dark asphalt
    sctx.fillStyle = '#151525';
    sctx.fillRect(0, 0, 256, 1024);
    
    // Glowing edge lines
    const edgeGradient = sctx.createLinearGradient(0, 0, 30, 0);
    edgeGradient.addColorStop(0, '#00ffff');
    edgeGradient.addColorStop(0.5, '#00aaaa');
    edgeGradient.addColorStop(1, 'transparent');
    
    sctx.fillStyle = edgeGradient;
    sctx.fillRect(0, 0, 15, 1024);
    
    const edgeGradient2 = sctx.createLinearGradient(256, 0, 226, 0);
    edgeGradient2.addColorStop(0, '#00ffff');
    edgeGradient2.addColorStop(0.5, '#00aaaa');
    edgeGradient2.addColorStop(1, 'transparent');
    sctx.fillStyle = edgeGradient2;
    sctx.fillRect(241, 0, 15, 1024);
    
    // Center dashed line
    sctx.strokeStyle = '#4fc3f7';
    sctx.lineWidth = 4;
    sctx.setLineDash([40, 30]);
    sctx.beginPath();
    sctx.moveTo(128, 0);
    sctx.lineTo(128, 1024);
    sctx.stroke();
    
    const streetTexture = new THREE.CanvasTexture(streetCanvas);
    streetTexture.wrapS = THREE.RepeatWrapping;
    streetTexture.wrapT = THREE.RepeatWrapping;
    streetTexture.repeat.set(1, 10);
    
    const streetMaterial = new THREE.MeshStandardMaterial({
      map: streetTexture,
      roughness: 0.7,
      metalness: 0.2,
      emissive: new THREE.Color(0x002233),
      emissiveIntensity: 0.3,
    });
    
    const street = new THREE.Mesh(streetGeometry, streetMaterial);
    street.rotation.x = -Math.PI / 2;
    street.position.y = 0.01;
    this.groundGroup.add(street);
    
    // Add glowing edge lines (3D)
    this.createGlowingLine(
      new THREE.Vector3(-streetWidth/2, 0.05, -streetLength/2),
      new THREE.Vector3(-streetWidth/2, 0.05, streetLength/2),
      0x00ffff,
      0.15
    );
    this.createGlowingLine(
      new THREE.Vector3(streetWidth/2, 0.05, -streetLength/2),
      new THREE.Vector3(streetWidth/2, 0.05, streetLength/2),
      0x00ffff,
      0.15
    );
    
    // Main street label
    const label = this.createStreetLabel('main', 0x00ffff);
    label.position.set(0, 0.5, -streetLength/2 + 10);
    this.groundGroup.add(label);
  }
  
  // @ts-ignore - Deprecated: Streets now created by AdvancedLayoutEngine
  private _legacyCreateBranchRoads(): void {
    // Create branch roads that EMERGE FROM UNDER the main street
    const branches = [
      { name: 'src', side: 1, color: 0x4fc3f7, startZ: -60 },
      { name: 'components', side: -1, color: 0x81d4fa, startZ: -30 },
      { name: 'utils', side: 1, color: 0xce93d8, startZ: 0 },
      { name: 'data', side: -1, color: 0xa5d6a7, startZ: 30 },
      { name: 'styles', side: 1, color: 0xf48fb1, startZ: 60 },
      { name: 'types', side: -1, color: 0xffab91, startZ: 90 },
    ];
    
    branches.forEach(branch => {
      this.createBranchRoad(branch.name, branch.side, branch.color, branch.startZ, 55);
    });
  }
  
  private createBranchRoad(
    name: string, 
    side: number,  // 1 = right, -1 = left
    color: number, 
    startZ: number,
    length: number
  ): void {
    // Create curved path - starts at EDGE of main street (x = side * 5)
    const curvePoints: THREE.Vector3[] = [];
    const segments = 24;
    
    // Main street is 10 units wide, so edge is at x = ±5
    const mainStreetEdge = side * 5;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      
      // Start at edge of main street, curve outward
      // First few points are at ground level at the edge, then curve outward
      const curveX = mainStreetEdge + side * Math.pow(t, 0.8) * length * 0.6;
      
      // Road stays at ground level (no underground section needed since we start at edge)
      const curveY = 0.02;
      
      // Progress along Z axis with slight curve
      const curveZ = startZ + t * length * 0.4;
      
      curvePoints.push(new THREE.Vector3(curveX, curveY, curveZ));
    }
    
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    
    // Create road surface using TubeGeometry for smooth curved road
    const roadGeometry = new THREE.TubeGeometry(curve, segments * 2, 2.5, 4, false);
    
    // Flatten the tube to make it more road-like
    const positions = roadGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      // Flatten vertically
      positions.setY(i, Math.max(-0.3, Math.min(0.15, y * 0.3)));
    }
    positions.needsUpdate = true;
    roadGeometry.computeVertexNormals();
    
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x151525,
      roughness: 0.85,
      metalness: 0.1,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.08,
    });
    
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    this.groundGroup.add(road);
    
    // Add glowing center line along the curve
    const lineGeometry = new THREE.TubeGeometry(curve, segments * 2, 0.06, 8, false);
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
    });
    const centerLine = new THREE.Mesh(lineGeometry, lineMaterial);
    centerLine.position.y = 0.08;
    this.groundGroup.add(centerLine);
    
    // Add glowing edge lines
    for (const edgeSide of [-1, 1]) {
      const edgePoints = curvePoints.map((p, i) => {
        const offset = 2.2 * edgeSide;
        // Calculate perpendicular offset
        const nextIdx = Math.min(i + 1, curvePoints.length - 1);
        const dir = curvePoints[nextIdx].clone().sub(p).normalize();
        const perp = new THREE.Vector3(-dir.z, 0, dir.x);
        return new THREE.Vector3(
          p.x + perp.x * offset,
          Math.max(0.03, p.y + 0.02),
          p.z + perp.z * offset
        );
      });
      const edgeCurve = new THREE.CatmullRomCurve3(edgePoints);
      const edgeGeometry = new THREE.TubeGeometry(edgeCurve, segments * 2, 0.04, 6, false);
      const edgeMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.5,
      });
      const edgeLine = new THREE.Mesh(edgeGeometry, edgeMaterial);
      this.groundGroup.add(edgeLine);
    }
    
    // Connection point at edge of main street (glowing arc)
    const arcGeometry = new THREE.TorusGeometry(2.5, 0.12, 8, 12, Math.PI * 0.6);
    const arcMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
    });
    const arc = new THREE.Mesh(arcGeometry, arcMaterial);
    arc.rotation.x = -Math.PI / 2;
    arc.rotation.z = side > 0 ? -Math.PI * 0.2 : Math.PI * 1.2;
    arc.position.set(side * 5, 0.05, startZ);
    this.groundGroup.add(arc);
    
    // Pulsing ring at the branch point
    const ringGeometry = new THREE.RingGeometry(1.5, 2.5, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(side * 5.5, 0.03, startZ);
    ring.userData = { pulse: true, baseScale: 1 };
    this.groundGroup.add(ring);
    
    // Branch label at end of road
    const endPoint = curvePoints[curvePoints.length - 1];
    const label = this.createStreetLabel(name, color);
    label.position.set(endPoint.x + side * 4, 1.5, endPoint.z + 2);
    this.groundGroup.add(label);
  }
  
  private createGlowingLine(start: THREE.Vector3, end: THREE.Vector3, color: number, width: number): void {
    const points = [start, end];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    });
    
    const line = new THREE.Line(geometry, material);
    this.groundGroup.add(line);
    
    // Add glow tube
    const direction = end.clone().sub(start);
    const length = direction.length();
    
    const tubeGeometry = new THREE.CylinderGeometry(width, width, length, 8);
    const tubeMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.3,
    });
    
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tube.position.copy(start.clone().add(end).multiplyScalar(0.5));
    tube.rotation.x = Math.PI / 2;
    this.groundGroup.add(tube);
  }
  
  private createStreetLabel(text: string, color: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    
    const ctx = canvas.getContext('2d')!;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(0, 8, canvas.width, 48, 8);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.lineWidth = 2;
    ctx.roundRect(0, 8, canvas.width, 48, 8);
    ctx.stroke();
    
    // Text
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), canvas.width / 2, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(8, 2, 1);
    
    return sprite;
  }
  
  private createStreetLights(): void {
    // Add street lights along the main road
    const lightPositions = [
      { x: -6, z: -100 },
      { x: 6, z: -100 },
      { x: -6, z: -50 },
      { x: 6, z: -50 },
      { x: -6, z: 0 },
      { x: 6, z: 0 },
      { x: -6, z: 50 },
      { x: 6, z: 50 },
      { x: -6, z: 100 },
      { x: 6, z: 100 },
    ];
    
    lightPositions.forEach(pos => {
      this.createStreetLight(pos.x, pos.z);
    });
  }
  
  private createStreetLight(x: number, z: number): void {
    const group = new THREE.Group();
    
    // Determine which side of the street (arm should point toward center)
    const armDirection = x > 0 ? -1 : 1;
    const armOffset = 0.8 * armDirection;
    
    // Base
    const baseGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.2, 8);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x222233,
      roughness: 0.3,
      metalness: 0.9,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.1;
    group.add(base);
    
    // Pole
    const poleGeometry = new THREE.CylinderGeometry(0.08, 0.12, 5, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({
      color: 0x333344,
      roughness: 0.4,
      metalness: 0.8,
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 2.7;
    group.add(pole);
    
    // Simple angled arm from pole to lamp
    const armLength = Math.abs(armOffset) + 0.3;
    const armGeometry = new THREE.CylinderGeometry(0.04, 0.04, armLength, 8);
    const arm = new THREE.Mesh(armGeometry, poleMaterial);
    // Position arm - angled from top of pole outward to lamp position
    arm.position.set(armOffset * 0.5, 5.1, 0);
    // Tilt the arm outward
    arm.rotation.z = armDirection > 0 ? -Math.PI / 6 : Math.PI / 6;
    group.add(arm);
    
    // Small decorative bracket at top of pole
    const bracketGeometry = new THREE.BoxGeometry(0.15, 0.08, 0.15);
    const bracket = new THREE.Mesh(bracketGeometry, poleMaterial);
    bracket.position.set(armDirection * 0.1, 5.2, 0);
    group.add(bracket);
    
    // Lamp housing (open downward like a shade)
    const housingGeometry = new THREE.ConeGeometry(0.35, 0.25, 8, 1, true);
    const housingMaterial = new THREE.MeshStandardMaterial({
      color: 0x333344,
      roughness: 0.3,
      metalness: 0.8,
      side: THREE.DoubleSide,
    });
    const housing = new THREE.Mesh(housingGeometry, housingMaterial);
    housing.position.set(armOffset, 5.05, 0);
    // Rotate to open downward
    housing.rotation.x = Math.PI;
    group.add(housing);
    
    // Light bulb (flickering)
    const bulbGeometry = new THREE.SphereGeometry(0.12, 8, 8);
    const bulbMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdd66,
      transparent: true,
      opacity: 1,
    });
    const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
    bulb.position.set(armOffset, 4.9, 0);
    bulb.userData.isLightBulb = true;
    bulb.userData.baseIntensity = 1;
    group.add(bulb);
    
    // Light cone (visible beam) - pointing DOWN from lamp
    // ConeGeometry has tip at +Y, we need tip at TOP (at lamp) and base at BOTTOM
    const coneGeometry = new THREE.ConeGeometry(2.2, 4.8, 16, 1, true);
    const coneMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    // Position so tip is at bulb (4.9) and base is near ground
    cone.position.set(armOffset, 2.5, 0);
    cone.userData.isLightCone = true;
    // NO rotation - tip stays up at the bulb!
    group.add(cone);
    
    // Ground light spot
    const spotGeometry = new THREE.CircleGeometry(1.8, 32);
    const spotMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0.12,
    });
    const spot = new THREE.Mesh(spotGeometry, spotMaterial);
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(armOffset, 0.02, 0);
    spot.userData.isLightSpot = true;
    group.add(spot);
    
    // Point light (actual illumination)
    const light = new THREE.PointLight(0xffdd66, 1, 15);
    light.position.set(armOffset, 4.9, 0);
    light.userData.isStreetLight = true;
    light.userData.baseIntensity = 1;
    group.add(light);
    
    // Spot light for directional beam
    const spotLight = new THREE.SpotLight(0xffdd44, 0.8, 12, Math.PI / 4, 0.5);
    spotLight.position.set(armOffset, 4.9, 0);
    spotLight.target.position.set(armOffset, 0, 0);
    spotLight.userData.isStreetSpotLight = true;
    spotLight.userData.baseIntensity = 0.8;
    group.add(spotLight);
    group.add(spotLight.target);
    
    // Mark the group as a street light for flickering
    group.userData.isStreetLightGroup = true;
    group.userData.flickerOffset = Math.random() * Math.PI * 2;
    
    group.position.set(x, 0, z);
    this.groundGroup.add(group);
  }
  
  private createStreetCats(): void {
    // Create many cute orange cats on the side lanes
    const catColors = [
      0xff8c42, // Orange
      0xffb366, // Light orange
      0xe67300, // Dark orange
      0xffaa33, // Golden orange
      0xff9955, // Peach orange
      0xffa500, // Pure orange
      0xff7f50, // Coral
      0xcc5500, // Burnt orange
    ];
    
    // Main street side lanes (left and right edges)
    const sideLanes = [
      { x: -4, name: 'left' },   // Left side of main street
      { x: 4, name: 'right' },   // Right side of main street
    ];
    
    // Create 8 cats total - 4 on each side
    for (let i = 0; i < 8; i++) {
      const color = catColors[i % catColors.length];
      const startZ = -80 + (i * 25) + (Math.random() - 0.5) * 15;
      const lane = sideLanes[i % 2];
      const startX = lane.x + (Math.random() - 0.5) * 1.5; // Slight variation
      
      const cat = this.createLowPolyCat(color);
      cat.group.position.set(startX, 0, startZ);
      
      // Store which lane the cat is on
      cat.group.userData.laneX = lane.x;
      
      // Set initial rotation based on direction
      cat.group.rotation.y = cat.direction > 0 ? 0 : Math.PI;
      
      this.cats.push(cat);
      this.scene.add(cat.group);
    }
  }
  
  private createLowPolyCat(color: number): StreetCat {
    const group = new THREE.Group();
    const catMaterial = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.8,
      metalness: 0.1,
      flatShading: true,
    });
    
    const darkMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.9,
      flatShading: true,
    });
    
    const pinkMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaaaa,
      roughness: 0.8,
      flatShading: true,
    });
    
    // Body (elongated box)
    const bodyGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.7);
    const body = new THREE.Mesh(bodyGeometry, catMaterial);
    body.position.y = 0.25;
    group.add(body);
    
    // Head (box)
    const headGeometry = new THREE.BoxGeometry(0.35, 0.3, 0.35);
    const head = new THREE.Mesh(headGeometry, catMaterial);
    head.position.set(0, 0.35, 0.4);
    group.add(head);
    
    // Ears (triangular prisms using cones)
    const earGeometry = new THREE.ConeGeometry(0.08, 0.15, 4);
    
    const earLeft = new THREE.Mesh(earGeometry, catMaterial);
    earLeft.position.set(-0.1, 0.55, 0.4);
    earLeft.rotation.z = -0.2;
    group.add(earLeft);
    
    const earRight = new THREE.Mesh(earGeometry, catMaterial);
    earRight.position.set(0.1, 0.55, 0.4);
    earRight.rotation.z = 0.2;
    group.add(earRight);
    
    // Inner ears (pink)
    const innerEarGeometry = new THREE.ConeGeometry(0.04, 0.08, 4);
    const innerEarLeft = new THREE.Mesh(innerEarGeometry, pinkMaterial);
    innerEarLeft.position.set(-0.1, 0.52, 0.42);
    innerEarLeft.rotation.z = -0.2;
    group.add(innerEarLeft);
    
    const innerEarRight = new THREE.Mesh(innerEarGeometry, pinkMaterial);
    innerEarRight.position.set(0.1, 0.52, 0.42);
    innerEarRight.rotation.z = 0.2;
    group.add(innerEarRight);
    
    // Eyes (small spheres)
    const eyeGeometry = new THREE.SphereGeometry(0.04, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x33ff33 }); // Green eyes
    
    const eyeLeft = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eyeLeft.position.set(-0.08, 0.38, 0.55);
    group.add(eyeLeft);
    
    const eyeRight = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eyeRight.position.set(0.08, 0.38, 0.55);
    group.add(eyeRight);
    
    // Pupils
    const pupilGeometry = new THREE.SphereGeometry(0.02, 6, 6);
    const pupilLeft = new THREE.Mesh(pupilGeometry, darkMaterial);
    pupilLeft.position.set(-0.08, 0.38, 0.58);
    group.add(pupilLeft);
    
    const pupilRight = new THREE.Mesh(pupilGeometry, darkMaterial);
    pupilRight.position.set(0.08, 0.38, 0.58);
    group.add(pupilRight);
    
    // Nose (small pink triangle)
    const noseGeometry = new THREE.ConeGeometry(0.03, 0.04, 3);
    const nose = new THREE.Mesh(noseGeometry, pinkMaterial);
    nose.position.set(0, 0.32, 0.57);
    nose.rotation.x = Math.PI / 2;
    group.add(nose);
    
    // Whiskers (thin lines)
    const whiskerMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 });
    
    const createWhisker = (startX: number, endX: number, y: number) => {
      const points = [
        new THREE.Vector3(startX, y, 0.55),
        new THREE.Vector3(endX, y + 0.02, 0.5)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.Line(geometry, whiskerMaterial);
    };
    
    group.add(createWhisker(-0.05, -0.2, 0.3));
    group.add(createWhisker(-0.05, -0.2, 0.32));
    group.add(createWhisker(0.05, 0.2, 0.3));
    group.add(createWhisker(0.05, 0.2, 0.32));
    
    // Legs (4 small boxes)
    const legGeometry = new THREE.BoxGeometry(0.1, 0.15, 0.1);
    
    const legFL = new THREE.Mesh(legGeometry, catMaterial);
    legFL.position.set(-0.12, 0.075, 0.25);
    legFL.userData = { isLeg: true, phase: 0 };
    group.add(legFL);
    
    const legFR = new THREE.Mesh(legGeometry, catMaterial);
    legFR.position.set(0.12, 0.075, 0.25);
    legFR.userData = { isLeg: true, phase: Math.PI };
    group.add(legFR);
    
    const legBL = new THREE.Mesh(legGeometry, catMaterial);
    legBL.position.set(-0.12, 0.075, -0.25);
    legBL.userData = { isLeg: true, phase: Math.PI };
    group.add(legBL);
    
    const legBR = new THREE.Mesh(legGeometry, catMaterial);
    legBR.position.set(0.12, 0.075, -0.25);
    legBR.userData = { isLeg: true, phase: 0 };
    group.add(legBR);
    
    // Tail (series of small boxes)
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.3, -0.35);
    
    for (let i = 0; i < 5; i++) {
      const tailSegment = new THREE.BoxGeometry(0.06, 0.06, 0.12);
      const segment = new THREE.Mesh(tailSegment, catMaterial);
      segment.position.set(0, i * 0.08, -i * 0.1);
      segment.rotation.x = -0.3;
      tailGroup.add(segment);
    }
    tailGroup.userData = { isTail: true };
    group.add(tailGroup);
    
    // Scale down the cat
    group.scale.setScalar(0.8);
    
    return {
      group,
      position: new THREE.Vector3(0, 0, 0),
      targetPosition: new THREE.Vector3(0, 0, 0),
      speed: 0.5 + Math.random() * 0.5,
      direction: Math.random() > 0.5 ? 1 : -1,
      walkPhase: Math.random() * Math.PI * 2,
      meowBubble: null,
      meowTimer: Math.random() * 10 + 5, // Random time until first meow
      tailPhase: Math.random() * Math.PI * 2,
      color,
    };
  }
  
  private createMeowBubble(): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    
    const ctx = canvas.getContext('2d')!;
    
    // Speech bubble background
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.ellipse(64, 28, 50, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Bubble tail
    ctx.beginPath();
    ctx.moveTo(50, 45);
    ctx.lineTo(64, 60);
    ctx.lineTo(70, 45);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = '#ff8c42';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(64, 28, 50, 22, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    // Text
    ctx.font = 'bold 18px Comic Sans MS, cursive';
    ctx.fillStyle = '#ff6600';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Random meow variants
    const meows = ['Meow!', 'Mew~', 'Nyaa!', 'Purr~', 'Mrow?', '=^.^='];
    const meow = meows[Math.floor(Math.random() * meows.length)];
    ctx.fillText(meow, 64, 28);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.5, 0.75, 1);
    
    return sprite;
  }
  
  private updateCats(delta: number): void {
    for (const cat of this.cats) {
      // Update walk phase
      cat.walkPhase += delta * cat.speed * 8;
      cat.tailPhase += delta * 3;
      
      // Move cat along the street
      const newZ = cat.group.position.z + cat.direction * cat.speed * delta;
      
      // Reverse direction at street ends
      if (newZ > 100 || newZ < -100) {
        cat.direction *= -1;
        cat.group.rotation.y = cat.direction > 0 ? 0 : Math.PI;
      }
      
      cat.group.position.z = newZ;
      
      // Stay on the assigned lane with slight wobble
      const laneX = cat.group.userData.laneX || 0;
      cat.group.position.x = laneX + Math.sin(cat.walkPhase * 0.3) * 0.4;
      
      // Animate legs
      cat.group.children.forEach(child => {
        if (child.userData.isLeg) {
          const legPhase = cat.walkPhase + child.userData.phase;
          child.position.y = 0.075 + Math.abs(Math.sin(legPhase)) * 0.05;
          child.rotation.x = Math.sin(legPhase) * 0.3;
        }
        
        // Animate tail
        if (child.userData.isTail) {
          child.rotation.x = Math.sin(cat.tailPhase) * 0.3;
          child.rotation.z = Math.sin(cat.tailPhase * 1.5) * 0.2;
        }
      });
      
      // Bobbing motion while walking
      cat.group.position.y = Math.abs(Math.sin(cat.walkPhase * 2)) * 0.03;
      
      // Meow timer
      cat.meowTimer -= delta;
      
      if (cat.meowTimer <= 0 && !cat.meowBubble) {
        // Create meow bubble
        cat.meowBubble = this.createMeowBubble();
        cat.meowBubble.position.set(0, 1, 0.3);
        cat.group.add(cat.meowBubble);
        
        // Reset timer for next meow (longer interval)
        cat.meowTimer = 8 + Math.random() * 15;
        
        // Remove bubble after a few seconds
        setTimeout(() => {
          if (cat.meowBubble) {
            cat.group.remove(cat.meowBubble);
            cat.meowBubble.material.dispose();
            cat.meowBubble = null;
          }
        }, 2000 + Math.random() * 1000);
      }
      
      // Animate meow bubble (float up slightly)
      if (cat.meowBubble) {
        cat.meowBubble.position.y = 1 + Math.sin(this.time * 4) * 0.05;
        cat.meowBubble.material.opacity = Math.min(1, cat.meowBubble.material.opacity + delta * 2);
      }
    }
  }
  
  private createAmbientParticles(): void {
    const particleCount = 500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = Math.random() * 50 + 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      
      // Soft colors
      const hue = Math.random() * 0.2 + 0.5; // Blue to cyan range
      const color = new THREE.Color().setHSL(hue, 0.5, 0.7);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    
    const particles = new THREE.Points(geometry, material);
    this.effectsGroup.add(particles);
  }
  
  /**
   * Update from snapshot with file contents
   */
  public async updateFromSnapshot(
    snapshot: ProjectSnapshot, 
    fileContents?: Record<string, { content: string; lines: string[]; functions: string[]; imports: string[] }>
  ): Promise<void> {
    const currentPaths = new Set(snapshot.files.map(f => f.path));
    
    // Remove buildings for deleted files
    for (const [path, building] of this.buildings) {
      if (!currentPaths.has(path)) {
        this.removeBuilding(building);
        this.buildings.delete(path);
      }
    }
    
    // Use advanced layout engine
    const fileData = snapshot.files.map(f => ({
      path: f.path,
      name: f.name,
      directory: f.directory || '/',
      extension: f.extension,
      linesOfCode: f.linesOfCode,
      imports: fileContents?.[f.path]?.imports || [],
    }));
    
    const advancedLayout = this.layoutEngine.calculateLayout(fileData);
    
    // Clear and recreate districts
    this.clearDistricts();
    for (const district of advancedLayout.districts) {
      const districtMesh = createDistrictMesh(district);
      this.districtGroup.add(districtMesh);
      this.districts.push(districtMesh);
    }
    
    // Clear and recreate streets
    this.clearLayoutStreets();
    for (const street of advancedLayout.streets) {
      const streetMesh = createStreetMesh(street);
      this.streetGroup.add(streetMesh);
      this.layoutStreets.push(streetMesh);
    }
    
    // Create position lookup
    const positionMap = new Map<string, THREE.Vector3>();
    for (const pos of advancedLayout.buildings) {
      positionMap.set(pos.path, new THREE.Vector3(pos.x, 0, pos.z));
    }
    
    // Create or update buildings
    for (const file of snapshot.files) {
      const fileWithContent: FileWithContent = { ...file };
      
      if (fileContents && fileContents[file.path]) {
        fileWithContent.content = fileContents[file.path].content;
        fileWithContent.lines = fileContents[file.path].lines;
        fileWithContent.functions = fileContents[file.path].functions;
        fileWithContent.imports = fileContents[file.path].imports;
      }
      
      const position = positionMap.get(file.path) || new THREE.Vector3();
      
      if (this.buildings.has(file.path)) {
        this.updateBuilding(fileWithContent, position);
      } else {
        this.createBuilding(fileWithContent, position);
      }
    }
    
    // Create connection arcs
    this.clearConnectionArcs();
    for (const arc of advancedLayout.connections) {
      const arcGroup = createConnectionArc(arc);
      this.connectionGroup.add(arcGroup);
      this.connectionArcs.push(arcGroup);
    }
    
    // Update connections based on imports (legacy)
    this.updateConnections(fileContents);
    
    // Create chat visualizations
    this.visualizeChats(snapshot.chats);
  }
  
  /**
   * @deprecated - Now using AdvancedLayoutEngine. Kept for reference.
   */
  // @ts-ignore - Unused but kept for fallback/reference
  private _legacyCalculateLayout(files: FileNode[]): Map<string, THREE.Vector3> {
    const layout = new Map<string, THREE.Vector3>();
    
    // HYBRID LAYOUT: Combines terraced hierarchy (B) with ring organization (A)
    
    // 1. Calculate directory depth levels
    const directories = new Map<string, { files: FileNode[]; depth: number; parentDir: string }>();
    
    for (const file of files) {
      const dir = file.directory || '/';
      if (!directories.has(dir)) {
        // Calculate depth (number of slashes)
        const depth = (dir.match(/\//g) || []).length;
        const parentDir = dir.split('/').slice(0, -1).join('/') || '/';
        directories.set(dir, { files: [], depth, parentDir });
      }
      directories.get(dir)!.files.push(file);
    }
    
    // 2. Group directories by depth level
    const levelGroups = new Map<number, string[]>();
    let maxDepth = 0;
    
    directories.forEach((info, dir) => {
      if (!levelGroups.has(info.depth)) {
        levelGroups.set(info.depth, []);
      }
      levelGroups.get(info.depth)!.push(dir);
      maxDepth = Math.max(maxDepth, info.depth);
    });
    
    // 3. Calculate positions - rings per depth level
    const levelRadius: Record<number, number> = {};
    let currentRadius = 8; // Start radius for root level
    
    for (let depth = 0; depth <= maxDepth; depth++) {
      levelRadius[depth] = currentRadius;
      const dirsAtLevel = levelGroups.get(depth)?.length || 1;
      currentRadius += 12 + dirsAtLevel * 3; // Increase radius for next level
    }
    
    // 4. Position each directory as a "district" in its ring
    const dirPositions = new Map<string, { x: number; z: number; angle: number }>();
    
    levelGroups.forEach((dirs, depth) => {
      const radius = levelRadius[depth];
      const angleStep = (Math.PI * 2) / Math.max(dirs.length, 1);
      
      dirs.forEach((dir, index) => {
        // Offset angle based on parent position for visual connection
        const info = directories.get(dir)!;
        let baseAngle = 0;
        
        if (info.parentDir && dirPositions.has(info.parentDir)) {
          baseAngle = dirPositions.get(info.parentDir)!.angle;
        }
        
        const angle = baseAngle + (index - dirs.length / 2) * angleStep * 0.5 + index * angleStep;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        dirPositions.set(dir, { x, z, angle });
      });
    });
    
    // 5. Position files within their directory district
    directories.forEach((info, dir) => {
      const dirPos = dirPositions.get(dir);
      if (!dirPos) return;
      
      const fileCount = info.files.length;
      
      // Sort files by size/importance
      const sortedFiles = [...info.files].sort((a, b) => 
        (b.linesOfCode || 0) - (a.linesOfCode || 0)
      );
      
      if (fileCount === 1) {
        // Single file - place at district center
        layout.set(sortedFiles[0].path, new THREE.Vector3(dirPos.x, 0, dirPos.z));
      } else if (fileCount <= 6) {
        // Small directory - hexagonal arrangement
        sortedFiles.forEach((file, i) => {
          if (i === 0) {
            // Largest file in center
            layout.set(file.path, new THREE.Vector3(dirPos.x, 0, dirPos.z));
          } else {
            const fileAngle = ((i - 1) / (fileCount - 1)) * Math.PI * 2;
            const fileRadius = 3 + Math.sqrt(file.linesOfCode || 50) * 0.1;
            const x = dirPos.x + Math.cos(fileAngle) * fileRadius;
            const z = dirPos.z + Math.sin(fileAngle) * fileRadius;
            layout.set(file.path, new THREE.Vector3(x, 0, z));
          }
        });
      } else {
        // Larger directory - spiral arrangement
        sortedFiles.forEach((file, i) => {
          const spiralAngle = i * 0.5;
          const spiralRadius = 2 + i * 0.8;
          const x = dirPos.x + Math.cos(spiralAngle) * spiralRadius;
          const z = dirPos.z + Math.sin(spiralAngle) * spiralRadius;
          layout.set(file.path, new THREE.Vector3(x, 0, z));
        });
      }
    });
    
    return layout;
  }
  
  /**
   * Calculate building dimensions with smart scaling for large files
   */
  private calculateBuildingDimensions(file: FileWithContent): { 
    width: number; 
    depth: number; 
    height: number;
    plotSize: number;
  } {
    const loc = file.lines?.length || file.linesOfCode || 10;
    const funcCount = file.functions?.length || 0;
    
    // Smart scaling: Use logarithmic scale for very large files
    // to prevent extremely tall buildings
    
    // Height based on LOC with logarithmic dampening for large files
    let height: number;
    if (loc <= 100) {
      height = loc * 0.08; // Linear for small files
    } else if (loc <= 500) {
      height = 8 + (loc - 100) * 0.04; // Slower growth
    } else if (loc <= 2000) {
      height = 24 + (loc - 500) * 0.02; // Even slower
    } else {
      height = 54 + Math.log10(loc - 2000) * 10; // Logarithmic for huge files
    }
    height = Math.max(1, Math.min(80, height)); // Clamp between 1 and 80
    
    // Width: Large files become wider instead of just taller
    // "Skyscraper" vs "Office Block" effect
    let width: number;
    if (loc <= 200) {
      width = 1.5 + funcCount * 0.2;
    } else if (loc <= 1000) {
      width = 2 + funcCount * 0.15 + (loc - 200) * 0.003;
    } else {
      // Very large files: significantly wider (office block style)
      width = 4 + Math.sqrt(loc - 1000) * 0.1;
    }
    width = Math.max(1.2, Math.min(8, width));
    
    // Depth: Based on complexity and imports
    const importCount = file.imports?.length || 0;
    let depth = 1.5 + importCount * 0.15 + funcCount * 0.1;
    
    // Large files get more square footprint
    if (loc > 500) {
      depth = Math.max(depth, width * 0.7);
    }
    depth = Math.max(1.2, Math.min(6, depth));
    
    // Plot size: Area reserved for building + buffer
    const plotSize = Math.max(width, depth) * 1.5 + 1;
    
    return { width, depth, height, plotSize };
  }
  
  private createBuilding(file: FileWithContent, position: THREE.Vector3): void {
    const colors = FILE_COLORS[file.extension] || FILE_COLORS['default'];
    const isNew = file.status === 'added';
    const isModified = file.status === 'modified';
    
    // Create building group
    const group = new THREE.Group();
    group.position.copy(position);
    
    // Calculate smart dimensions
    const dims = this.calculateBuildingDimensions(file);
    const buildingHeight = dims.height;
    const baseWidth = dims.width;
    const baseDepth = dims.depth;
    const plotSize = dims.plotSize;
    
    // Create ground plot/foundation
    this.createBuildingPlot(group, plotSize, colors, isNew, isModified);
    
    // Shape based on file type
    let geometry: THREE.BufferGeometry;
    const buildingShape = this.getBuildingShape(file.extension);
    
    switch (buildingShape) {
      case 'cylinder': // Config files, JSON
        geometry = new THREE.CylinderGeometry(baseWidth / 2, baseWidth / 2, buildingHeight, 16);
        break;
      case 'hexagon': // TypeScript/JavaScript
        geometry = new THREE.CylinderGeometry(baseWidth / 2, baseWidth / 2, buildingHeight, 6);
        break;
      case 'octagon': // Python
        geometry = new THREE.CylinderGeometry(baseWidth / 2, baseWidth / 2, buildingHeight, 8);
        break;
      case 'pyramid': // Entry points (index, main)
        geometry = new THREE.ConeGeometry(baseWidth / 2, buildingHeight, 4);
        break;
      case 'dome': // Markdown/docs
        const domeGroup = this.createDomeGeometry(baseWidth, buildingHeight);
        geometry = domeGroup;
        break;
      default: // Box for most files
        geometry = new THREE.BoxGeometry(baseWidth, buildingHeight, baseDepth);
    }
    
    // Create material with code texture or content preview
    const textCanvas = this.createEnhancedTexture(file, baseWidth * 128, buildingHeight * 64);
    const textTexture = new THREE.CanvasTexture(textCanvas);
    textTexture.minFilter = THREE.LinearFilter;
    textTexture.wrapS = THREE.ClampToEdgeWrapping;
    textTexture.wrapT = THREE.ClampToEdgeWrapping;
    
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.base),
      emissive: new THREE.Color(colors.glow),
      // Higher emissive for all buildings - ensures visibility at distance
      emissiveIntensity: isNew ? 0.9 : isModified ? 0.7 : 0.4,
      roughness: 0.1,
      metalness: 0.5,
      map: textTexture,
      transparent: true,
      opacity: 0.94,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = buildingHeight / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { isBuilding: true, filePath: file.path, fileName: file.name };
    
    group.add(mesh);
    
    // Glow effect (shape-matched)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colors.glow),
      transparent: true,
      opacity: isNew ? 0.45 : isModified ? 0.35 : 0.12,
      side: THREE.BackSide,
    });
    
    let glowGeometry: THREE.BufferGeometry;
    if (buildingShape === 'cylinder' || buildingShape === 'hexagon' || buildingShape === 'octagon') {
      const sides = buildingShape === 'cylinder' ? 16 : (buildingShape === 'hexagon' ? 6 : 8);
      glowGeometry = new THREE.CylinderGeometry(baseWidth / 2 + 0.3, baseWidth / 2 + 0.3, buildingHeight + 0.4, sides);
    } else if (buildingShape === 'pyramid') {
      glowGeometry = new THREE.ConeGeometry(baseWidth / 2 + 0.3, buildingHeight + 0.4, 4);
    } else {
      glowGeometry = new THREE.BoxGeometry(baseWidth + 0.5, buildingHeight + 0.4, baseDepth + 0.5);
    }
    
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.position.y = buildingHeight / 2;
    group.add(glowMesh);
    
    // Function markers as glowing rings/bands
    const floors: THREE.Mesh[] = [];
    if (file.functions && file.functions.length > 0) {
      const funcSpacing = buildingHeight / (file.functions.length + 1);
      
      file.functions.forEach((func, i) => {
        const floorY = funcSpacing * (i + 1);
        
        // Ring for cylindrical, band for box
        let floorGeometry: THREE.BufferGeometry;
        if (buildingShape === 'cylinder' || buildingShape === 'hexagon' || buildingShape === 'octagon') {
          floorGeometry = new THREE.TorusGeometry(baseWidth / 2 + 0.1, 0.08, 8, 16);
        } else {
          floorGeometry = new THREE.BoxGeometry(baseWidth + 0.2, 0.12, baseDepth + 0.2);
        }
        
        const floorMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(colors.accent),
          transparent: true,
          opacity: 0.85,
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.y = floorY;
        if (buildingShape === 'cylinder' || buildingShape === 'hexagon' || buildingShape === 'octagon') {
          floor.rotation.x = Math.PI / 2;
        }
        floor.userData = { functionName: func };
        group.add(floor);
        floors.push(floor);
      });
    }
    
    // Base platform with file type indicator
    const baseGeometry = new THREE.CylinderGeometry(baseWidth / 2 + 0.5, baseWidth / 2 + 0.8, 0.2, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.base),
      emissive: new THREE.Color(colors.glow),
      emissiveIntensity: 0.3,
      roughness: 0.3,
      metalness: 0.6,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.1;
    group.add(base);
    
    // Animated data streams for new/modified files
    if (isNew || isModified) {
      this.addDataStreamEffect(group, buildingHeight, colors, isNew);
    }
    
    // Add detailed label with file info
    const label = this.createDetailedLabel(file, colors);
    label.position.y = buildingHeight + 1.2;
    group.add(label);
    
    // Add to scene
    this.buildingGroup.add(group);
    
    // Store building data
    const building: CodeBuilding = {
      id: file.path,
      fileNode: file,
      group,
      mesh,
      floors,
      textCanvas,
      textTexture,
      position,
      targetY: 0,
      currentY: isNew ? -buildingHeight : 0,
      height: buildingHeight,
      glowMesh,
      label,
      isNew,
      pulsePhase: Math.random() * Math.PI * 2,
    };
    
    this.buildings.set(file.path, building);
    
    // Spawn animation for new buildings
    if (isNew) {
      this.spawnBuildingEffect(position, colors.glow);
    }
  }
  
  /**
   * Create a glowing ground plot/foundation for a building
   */
  private createBuildingPlot(
    group: THREE.Group, 
    plotSize: number, 
    colors: { base: string; glow: string; accent: string },
    isNew: boolean,
    isModified: boolean
  ): void {
    // Main plot platform
    const plotGeometry = new THREE.BoxGeometry(plotSize, 0.15, plotSize);
    const plotMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      emissive: new THREE.Color(colors.base),
      emissiveIntensity: isNew ? 0.4 : isModified ? 0.3 : 0.15,
      roughness: 0.7,
      metalness: 0.3,
    });
    const plot = new THREE.Mesh(plotGeometry, plotMaterial);
    plot.position.y = -0.075;
    group.add(plot);
    
    // Glowing border around plot
    const borderGeometry = new THREE.BoxGeometry(plotSize + 0.1, 0.08, plotSize + 0.1);
    const borderMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colors.glow),
      transparent: true,
      opacity: isNew ? 0.7 : isModified ? 0.5 : 0.25,
    });
    const border = new THREE.Mesh(borderGeometry, borderMaterial);
    border.position.y = -0.12;
    group.add(border);
    
    // Corner markers for larger plots
    if (plotSize > 3) {
      const cornerSize = 0.2;
      const cornerGeometry = new THREE.BoxGeometry(cornerSize, 0.3, cornerSize);
      const cornerMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colors.accent),
        transparent: true,
        opacity: 0.8,
      });
      
      const halfPlot = plotSize / 2 - cornerSize / 2;
      const cornerPositions = [
        [-halfPlot, 0.15, -halfPlot],
        [-halfPlot, 0.15, halfPlot],
        [halfPlot, 0.15, -halfPlot],
        [halfPlot, 0.15, halfPlot],
      ];
      
      for (const pos of cornerPositions) {
        const corner = new THREE.Mesh(cornerGeometry, cornerMaterial);
        corner.position.set(pos[0], pos[1], pos[2]);
        group.add(corner);
      }
    }
  }
  
  private getBuildingShape(extension: string): string {
    const shapeMap: Record<string, string> = {
      '.json': 'cylinder',
      '.yaml': 'cylinder',
      '.yml': 'cylinder',
      '.toml': 'cylinder',
      '.xml': 'cylinder',
      '.ts': 'hexagon',
      '.tsx': 'hexagon',
      '.js': 'hexagon',
      '.jsx': 'hexagon',
      '.py': 'octagon',
      '.md': 'dome',
      '.txt': 'dome',
      '.rst': 'dome',
    };
    return shapeMap[extension] || 'box';
  }
  
  private createDomeGeometry(width: number, height: number): THREE.BufferGeometry {
    // Use box as fallback - dome is complex to implement properly
    return new THREE.BoxGeometry(width, height, width);
  }
  
  private createEnhancedTexture(file: FileWithContent, width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(256, Math.min(512, width));
    canvas.height = Math.max(256, Math.min(1024, height));
    
    const ctx = canvas.getContext('2d')!;
    const colors = FILE_COLORS[file.extension] || FILE_COLORS['default'];
    
    // Dark gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(20, 25, 40, 0.95)');
    gradient.addColorStop(0.5, 'rgba(15, 20, 35, 0.98)');
    gradient.addColorStop(1, 'rgba(10, 15, 30, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add subtle grid pattern
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.1)';
    ctx.lineWidth = 1;
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Show actual code content
    if (file.lines && file.lines.length > 0) {
      ctx.font = '10px monospace';
      const lineHeight = 12;
      const maxLines = Math.floor(canvas.height / lineHeight) - 2;
      const startLine = 0;
      
      for (let i = 0; i < Math.min(file.lines.length, maxLines); i++) {
        const line = file.lines[startLine + i] || '';
        const y = 15 + i * lineHeight;
        
        // Syntax highlighting
        ctx.fillStyle = this.getSyntaxColor(line, file.extension);
        
        // Truncate long lines
        const displayLine = line.substring(0, 40);
        ctx.fillText(displayLine, 8, y);
      }
      
      // Show line count indicator
      if (file.lines.length > maxLines) {
        ctx.fillStyle = 'rgba(150, 150, 150, 0.7)';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`... +${file.lines.length - maxLines} more lines`, 8, canvas.height - 8);
      }
    }
    
    // Add function indicators on the side
    if (file.functions && file.functions.length > 0) {
      const funcSpacing = canvas.height / (file.functions.length + 1);
      ctx.fillStyle = colors.accent;
      
      file.functions.forEach((func, i) => {
        const y = funcSpacing * (i + 1);
        // Glowing dot
        ctx.beginPath();
        ctx.arc(canvas.width - 12, y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Function name (truncated)
        ctx.font = '8px monospace';
        ctx.fillStyle = colors.glow;
        const funcName = func.length > 15 ? func.substring(0, 12) + '...' : func;
        ctx.fillText(funcName, canvas.width - 80, y + 3);
      });
    }
    
    // Glowing border
    ctx.strokeStyle = colors.base;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    
    return canvas;
  }
  
  private getSyntaxColor(line: string, _extension: string): string {
    const trimmed = line.trim();
    
    // Comments
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return 'rgba(100, 160, 100, 0.8)';
    }
    
    // Keywords
    const keywords = ['import', 'export', 'from', 'const', 'let', 'var', 'function', 'class', 'interface', 'type', 'return', 'if', 'else', 'for', 'while', 'async', 'await', 'def', 'self'];
    for (const kw of keywords) {
      if (trimmed.startsWith(kw + ' ') || trimmed.startsWith(kw + '(')) {
        return 'rgba(200, 130, 255, 0.9)';
      }
    }
    
    // Strings
    if (trimmed.includes('"') || trimmed.includes("'") || trimmed.includes('`')) {
      return 'rgba(255, 200, 100, 0.85)';
    }
    
    // Functions/methods
    if (trimmed.includes('(') && !trimmed.startsWith('if') && !trimmed.startsWith('for')) {
      return 'rgba(100, 200, 255, 0.85)';
    }
    
    // Default
    return 'rgba(200, 210, 220, 0.75)';
  }
  
  private addDataStreamEffect(group: THREE.Group, height: number, colors: { base: string; glow: string; accent: string }, isNew: boolean): void {
    // Create vertical particle stream effect
    const particleCount = 30;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = Math.random() * height;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: new THREE.Color(isNew ? colors.glow : colors.accent),
      size: 0.15,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    
    const particles = new THREE.Points(geometry, material);
    particles.userData = { 
      isDataStream: true, 
      speed: isNew ? 2 : 1.5, 
      height: height,
      positions: positions 
    };
    group.add(particles);
  }
  
  private createDetailedLabel(file: FileWithContent, colors: { base: string; glow: string; accent: string }): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    
    const ctx = canvas.getContext('2d')!;
    
    // Background
    ctx.fillStyle = 'rgba(10, 15, 25, 0.9)';
    ctx.roundRect(0, 0, canvas.width, canvas.height, 8);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = colors.base;
    ctx.lineWidth = 2;
    ctx.roundRect(2, 2, canvas.width - 4, canvas.height - 4, 6);
    ctx.stroke();
    
    // File name
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = colors.glow;
    ctx.textAlign = 'center';
    const displayName = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
    ctx.fillText(displayName, canvas.width / 2, 25);
    
    // Stats line
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(180, 190, 200, 0.9)';
    const loc = file.linesOfCode || file.lines?.length || 0;
    const funcs = file.functions?.length || 0;
    ctx.fillText(`${loc} LOC • ${funcs} functions`, canvas.width / 2, 50);
    
    // Extension badge
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = colors.accent;
    ctx.fillText(file.extension.toUpperCase(), canvas.width / 2, 72);
    
    // Status indicator
    if (file.status === 'added') {
      ctx.fillStyle = '#4caf50';
      ctx.fillText('● NEW', canvas.width / 2, 88);
    } else if (file.status === 'modified') {
      ctx.fillStyle = '#ff9800';
      ctx.fillText('● MODIFIED', canvas.width / 2, 88);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4, 1.5, 1);
    
    return sprite;
  }
  
  private updateBuilding(file: FileWithContent, position: THREE.Vector3): void {
    const building = this.buildings.get(file.path);
    if (!building) return;
    
    building.fileNode = file;
    building.position.copy(position);
    building.group.position.copy(position);
    
    // Update material if status changed
    const material = building.mesh.material as THREE.MeshStandardMaterial;
    const colors = FILE_COLORS[file.extension] || FILE_COLORS['default'];
    
    if (file.status === 'modified') {
      material.emissiveIntensity = 0.3;
      material.emissive = new THREE.Color(colors.glow);
    } else if (file.status === 'added') {
      material.emissiveIntensity = 0.4;
    } else {
      material.emissiveIntensity = 0.05;
    }
  }
  
  private clearDistricts(): void {
    for (const district of this.districts) {
      this.districtGroup.remove(district);
      district.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    }
    this.districts = [];
  }
  
  private clearConnectionArcs(): void {
    for (const arc of this.connectionArcs) {
      this.connectionGroup.remove(arc);
      arc.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    }
    this.connectionArcs = [];
  }
  
  private clearLayoutStreets(): void {
    for (const street of this.layoutStreets) {
      this.streetGroup.remove(street);
      street.geometry.dispose();
      if (street.material instanceof THREE.Material) {
        street.material.dispose();
      }
    }
    this.layoutStreets = [];
  }
  
  private removeBuilding(building: CodeBuilding): void {
    this.buildingGroup.remove(building.group);
    
    // Dispose resources
    building.mesh.geometry.dispose();
    (building.mesh.material as THREE.Material).dispose();
    building.textTexture.dispose();
    
    for (const floor of building.floors) {
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
    }
  }
  
  private updateConnections(fileContents?: Record<string, { content: string; lines: string[]; functions: string[]; imports: string[] }>): void {
    // Clear old connections
    for (const conn of this.connections) {
      this.connectionGroup.remove(conn.line);
      this.connectionGroup.remove(conn.particles);
      conn.line.geometry.dispose();
      conn.particles.geometry.dispose();
    }
    this.connections = [];
    
    if (!fileContents) return;
    
    // Create connections based on imports
    for (const [filePath, content] of Object.entries(fileContents)) {
      const fromBuilding = this.buildings.get(filePath);
      if (!fromBuilding || !content.imports) continue;
      
      for (const importPath of content.imports) {
        // Find target building
        let targetPath = importPath;
        if (!targetPath.endsWith('.ts') && !targetPath.endsWith('.js')) {
          targetPath += '.ts'; // Try adding extension
        }
        
        // Resolve relative path
        const fromDir = filePath.split('/').slice(0, -1).join('/');
        const resolvedPath = this.resolvePath(fromDir, targetPath);
        
        const toBuilding = this.buildings.get(resolvedPath) || 
                          this.buildings.get(resolvedPath.replace('.ts', '.tsx')) ||
                          this.buildings.get(resolvedPath.replace('.ts', '/index.ts'));
        
        if (toBuilding && toBuilding.id !== fromBuilding.id) {
          this.createConnection(fromBuilding, toBuilding);
        }
      }
    }
  }
  
  private resolvePath(fromDir: string, relativePath: string): string {
    const parts = fromDir.split('/').filter(p => p);
    const relParts = relativePath.split('/');
    
    for (const part of relParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }
    
    return '/' + parts.join('/');
  }
  
  private createConnection(from: CodeBuilding, to: CodeBuilding): void {
    const fromPos = from.position.clone();
    fromPos.y = from.height / 2;
    
    const toPos = to.position.clone();
    toPos.y = to.height / 2;
    
    // Create curved line
    const midPoint = fromPos.clone().add(toPos).multiplyScalar(0.5);
    midPoint.y += 5;
    
    const curve = new THREE.QuadraticBezierCurve3(fromPos, midPoint, toPos);
    const points = curve.getPoints(30);
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x4fc3f7,
      transparent: true,
      opacity: 0.4,
    });
    
    const line = new THREE.Line(geometry, material);
    
    // Create particles that travel along the line
    const particleCount = 5;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x80deea,
      size: 0.3,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    
    this.connections.push({
      from: from.id,
      to: to.id,
      line,
      particles,
      particlePositions: positions,
    });
    
    this.connectionGroup.add(line);
    this.connectionGroup.add(particles);
  }
  
  private visualizeChats(chats: ChatMessage[]): void {
    // Clear old chat particles
    for (const particles of this.chatParticles) {
      this.effectsGroup.remove(particles);
      particles.geometry.dispose();
      (particles.material as THREE.Material).dispose();
    }
    this.chatParticles = [];
    
    // Create floating chat indicators
    for (const chat of chats.slice(0, 10)) {
      const particleCount = 20;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      
      // Position near related files or random
      let basePos = new THREE.Vector3(
        (Math.random() - 0.5) * 60,
        10 + Math.random() * 10,
        (Math.random() - 0.5) * 60
      );
      
      if (chat.relatedFiles.length > 0) {
        const building = this.buildings.get(chat.relatedFiles[0]);
        if (building) {
          basePos = building.position.clone();
          basePos.y += 10;
        }
      }
      
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = basePos.x + (Math.random() - 0.5) * 3;
        positions[i * 3 + 1] = basePos.y + (Math.random() - 0.5) * 3;
        positions[i * 3 + 2] = basePos.z + (Math.random() - 0.5) * 3;
      }
      
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      
      const color = chat.role === 'user' ? 0x667eea : 0x48bb78;
      const material = new THREE.PointsMaterial({
        color,
        size: 0.4,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
      });
      
      const particles = new THREE.Points(geometry, material);
      particles.userData = { chat, basePos, phase: Math.random() * Math.PI * 2 };
      
      this.effectsGroup.add(particles);
      this.chatParticles.push(particles);
    }
  }
  
  private spawnBuildingEffect(position: THREE.Vector3, color: string): void {
    const particleCount = 50;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = position.z;
      
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        Math.random() * 0.8 + 0.2,
        (Math.random() - 0.5) * 0.5
      ));
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: new THREE.Color(color),
      size: 0.4,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });
    
    const particles = new THREE.Points(geometry, material);
    this.effectsGroup.add(particles);
    
    // Animate
    let life = 0;
    const animate = () => {
      life += 16;
      if (life > 2000) {
        this.effectsGroup.remove(particles);
        geometry.dispose();
        material.dispose();
        return;
      }
      
      const posArray = geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        posArray[i * 3] += velocities[i].x;
        posArray[i * 3 + 1] += velocities[i].y;
        posArray[i * 3 + 2] += velocities[i].z;
        velocities[i].y -= 0.02;
      }
      geometry.attributes.position.needsUpdate = true;
      material.opacity = 1 - life / 2000;
      
      requestAnimationFrame(animate);
    };
    animate();
  }
  
  /**
   * Animation update
   */
  public update(delta: number): void {
    this.time += delta;
    
    // Animate buildings
    for (const building of this.buildings.values()) {
      // Smooth rise animation for new buildings
      if (building.currentY < building.targetY - 0.01) {
        building.currentY += (building.targetY - building.currentY) * 0.05;
        building.group.position.y = building.currentY;
      }
      
      // Pulse effect for active buildings
      if (building.isNew || building.fileNode.status === 'modified') {
        const pulse = Math.sin(this.time * 2 + building.pulsePhase) * 0.08 + 1;
        building.mesh.scale.setScalar(pulse);
        
        const material = building.mesh.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 0.25 + Math.sin(this.time * 3 + building.pulsePhase) * 0.15;
      }
      
      // Floating label
      building.label.position.y = building.height + 1.2 + Math.sin(this.time + building.pulsePhase) * 0.15;
      
      // Animate data streams (vertical particles)
      building.group.children.forEach(child => {
        if (child instanceof THREE.Points && child.userData.isDataStream) {
          const positions = child.geometry.attributes.position.array as Float32Array;
          const speed = child.userData.speed || 1;
          const height = child.userData.height || 10;
          
          for (let i = 0; i < positions.length / 3; i++) {
            positions[i * 3 + 1] += delta * speed; // Move up
            if (positions[i * 3 + 1] > height) {
              positions[i * 3 + 1] = 0; // Reset to bottom
              positions[i * 3] = (Math.random() - 0.5) * 0.5;
              positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
            }
          }
          child.geometry.attributes.position.needsUpdate = true;
        }
      });
    }
    
    // Animate connections (traveling particles)
    for (const conn of this.connections) {
      const from = this.buildings.get(conn.from);
      const to = this.buildings.get(conn.to);
      if (!from || !to) continue;
      
      const positions = conn.particlePositions;
      const particleCount = positions.length / 3;
      
      for (let i = 0; i < particleCount; i++) {
        const t = ((this.time * 0.5 + i / particleCount) % 1);
        
        const fromPos = from.position;
        const toPos = to.position;
        const midY = Math.max(fromPos.y, toPos.y) + 5;
        
        // Quadratic bezier interpolation
        const x = (1 - t) * (1 - t) * fromPos.x + 2 * (1 - t) * t * ((fromPos.x + toPos.x) / 2) + t * t * toPos.x;
        const y = (1 - t) * (1 - t) * (fromPos.y + 2) + 2 * (1 - t) * t * midY + t * t * (toPos.y + 2);
        const z = (1 - t) * (1 - t) * fromPos.z + 2 * (1 - t) * t * ((fromPos.z + toPos.z) / 2) + t * t * toPos.z;
        
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
      }
      
      conn.particles.geometry.attributes.position.needsUpdate = true;
    }
    
    // Animate chat particles (orbit)
    for (const particles of this.chatParticles) {
      const { basePos, phase } = particles.userData;
      const positions = particles.geometry.attributes.position.array as Float32Array;
      const particleCount = positions.length / 3;
      
      for (let i = 0; i < particleCount; i++) {
        const angle = this.time + phase + (i / particleCount) * Math.PI * 2;
        const radius = 1.5 + Math.sin(this.time * 2 + i) * 0.5;
        
        positions[i * 3] = basePos.x + Math.cos(angle) * radius;
        positions[i * 3 + 1] = basePos.y + Math.sin(this.time * 0.5 + i * 0.3) * 2;
        positions[i * 3 + 2] = basePos.z + Math.sin(angle) * radius;
      }
      
      particles.geometry.attributes.position.needsUpdate = true;
    }
    
    // Animate ambient particles (slow drift)
    const ambientParticles = this.effectsGroup.children.find(c => c instanceof THREE.Points && !c.userData.chat) as THREE.Points;
    if (ambientParticles) {
      const positions = ambientParticles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3 + 1] += Math.sin(this.time * 0.2 + i) * 0.01;
        
        // Wrap around
        if (positions[i * 3 + 1] > 55) positions[i * 3 + 1] = 5;
        if (positions[i * 3 + 1] < 5) positions[i * 3 + 1] = 55;
      }
      ambientParticles.geometry.attributes.position.needsUpdate = true;
    }
    
    // Animate pulsing rings on branch connections
    this.groundGroup.children.forEach(child => {
      if (child.userData.pulse) {
        const scale = 1 + Math.sin(this.time * 2) * 0.3;
        child.scale.setScalar(scale);
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshBasicMaterial;
          mat.opacity = 0.5 - Math.sin(this.time * 2) * 0.3;
        }
      }
    });
    
    // Update our cute street cats!
    this.updateCats(delta);
    
    // Update street light flickering
    this.updateStreetLightFlicker();
    
    // Update connection arc animations
    updateConnectionArcs(this.connectionArcs, this.time);
  }
  
  private updateStreetLightFlicker(): void {
    this.groundGroup.children.forEach(child => {
      if (child.userData.isStreetLightGroup) {
        const flickerOffset = child.userData.flickerOffset || 0;
        
        // Create subtle, organic flicker using multiple sine waves
        const flicker1 = Math.sin(this.time * 15 + flickerOffset) * 0.05;
        const flicker2 = Math.sin(this.time * 23 + flickerOffset * 2) * 0.03;
        const flicker3 = Math.sin(this.time * 7 + flickerOffset * 0.5) * 0.02;
        
        // Random occasional flicker
        const randomFlicker = Math.random() > 0.995 ? -0.2 : 0;
        
        const flickerAmount = 1 + flicker1 + flicker2 + flicker3 + randomFlicker;
        
        // Apply flicker to all light elements in this street light
        child.traverse((obj: THREE.Object3D) => {
          // Bulb brightness
          if (obj.userData.isLightBulb) {
            const mesh = obj as THREE.Mesh;
            const mat = mesh.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.8 + flickerAmount * 0.2;
          }
          
          // Light cone opacity
          if (obj.userData.isLightCone) {
            const mesh = obj as THREE.Mesh;
            const mat = mesh.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.04 + flickerAmount * 0.03;
          }
          
          // Ground spot opacity
          if (obj.userData.isLightSpot) {
            const mesh = obj as THREE.Mesh;
            const mat = mesh.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.08 + flickerAmount * 0.06;
          }
          
          // Point light intensity
          if (obj.userData.isStreetLight) {
            const light = obj as THREE.PointLight;
            light.intensity = (obj.userData.baseIntensity || 1) * flickerAmount;
          }
          
          // Spot light intensity
          if (obj.userData.isStreetSpotLight) {
            const light = obj as THREE.SpotLight;
            light.intensity = (obj.userData.baseIntensity || 0.8) * flickerAmount;
          }
        });
      }
    });
  }
  
  /**
   * Get building for raycasting
   */
  public getBuildingAt(raycaster: THREE.Raycaster): CodeBuilding | null {
    const intersects = raycaster.intersectObjects(this.buildingGroup.children, true);
    
    for (const intersect of intersects) {
      let obj = intersect.object;
      while (obj.parent && !obj.userData.isBuilding) {
        obj = obj.parent as THREE.Object3D;
      }
      
      if (obj.userData.filePath) {
        return this.buildings.get(obj.userData.filePath) || null;
      }
    }
    
    return null;
  }
  
  /**
   * Get all buildings
   */
  public getAllBuildings(): CodeBuilding[] {
    return Array.from(this.buildings.values());
  }
  
  /**
   * Highlight building
   */
  public highlightBuilding(path: string): void {
    const building = this.buildings.get(path);
    if (!building) return;
    
    const material = building.mesh.material as THREE.MeshStandardMaterial;
    const originalIntensity = material.emissiveIntensity;
    
    material.emissiveIntensity = 1;
    
    setTimeout(() => {
      material.emissiveIntensity = originalIntensity;
    }, 500);
  }
  
  /**
   * Dispose
   */
  public dispose(): void {
    for (const building of this.buildings.values()) {
      this.removeBuilding(building);
    }
    
    for (const conn of this.connections) {
      conn.line.geometry.dispose();
      conn.particles.geometry.dispose();
    }
    
    this.buildings.clear();
    this.connections = [];
    
    this.scene.remove(this.buildingGroup);
    this.scene.remove(this.connectionGroup);
    this.scene.remove(this.groundGroup);
    this.scene.remove(this.effectsGroup);
  }
}
