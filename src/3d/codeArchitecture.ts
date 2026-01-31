import * as THREE from 'three';
import type { ProjectSnapshot, FileNode, ChatMessage } from '../types';
import { 
  updateConnectionArcs
} from './advancedLayout';
import {
  GrowingCityEngine,
  createGrowingRoad,
  createGrowingDecorations,
  type GrowingLayout
} from './growingCity';
import {
  MessageTimelineEngine,
  type MessageTimelineLayout,
  type MessageData,
  type FileData as TimelineFileData
} from './messageTimeline';
import {
  createMessageMarker,
  createTokenTree,
  createPark,
  createFountain,
  createBench,
  animateMessage,
  animateFountain
} from './timelineRenderers';
import {
  createManyCats,
  createSeagulls,
  updateAnimalPath,
  type Animal
} from './animals';

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
  
  // NEW: Message Timeline System
  private messageTimelineMode: boolean = true; // Enable new system by default
  private messageTimelineEngine: MessageTimelineEngine;
  private timelineLayout: MessageTimelineLayout | null = null;
  private timelineGroup: THREE.Group;
  private messageMarkers: Map<string, THREE.Group> = new Map();
  private tokenTrees: Map<string, THREE.Group> = new Map();
  private animals: Animal[] = [];
  
  // Animation
  private time: number = 0;
  private chatParticles: THREE.Points[] = [];
  
  // Street cats!
  private cats: StreetCat[] = [];
  
  // Ground plane
  // Ground removed for cleaner look
  
  // Growing city layout system
  private growingCityEngine: GrowingCityEngine;
  private connectionArcs: THREE.Group[] = [];
  private growingLayout: GrowingLayout | null = null;
  private streetGroup: THREE.Group;
  private districtGroup: THREE.Group;
  private decorationGroup: THREE.Group;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    
    // Initialize growing city layout engine
    this.growingCityEngine = new GrowingCityEngine();
    
    // Initialize message timeline engine
    this.messageTimelineEngine = new MessageTimelineEngine();
    
    // Create groups
    this.groundGroup = new THREE.Group();
    this.groundGroup.name = 'ground';
    this.streetGroup = new THREE.Group();
    this.streetGroup.name = 'streets';
    this.districtGroup = new THREE.Group();
    this.districtGroup.name = 'districts';
    this.decorationGroup = new THREE.Group();
    this.decorationGroup.name = 'decorations';
    this.buildingGroup = new THREE.Group();
    this.buildingGroup.name = 'buildings';
    this.connectionGroup = new THREE.Group();
    this.connectionGroup.name = 'connections';
    this.effectsGroup = new THREE.Group();
    this.effectsGroup.name = 'effects';
    this.timelineGroup = new THREE.Group();
    this.timelineGroup.name = 'timeline';
    
    scene.add(this.groundGroup);
    scene.add(this.streetGroup);
    scene.add(this.districtGroup);
    scene.add(this.decorationGroup);
    scene.add(this.connectionGroup);
    scene.add(this.buildingGroup);
    scene.add(this.effectsGroup);
    scene.add(this.timelineGroup);
    
    // Setup environment
    this.setupEnvironment();
  }
  
  private setupEnvironment(): void {
    // NO background - transparent/none
    this.scene.background = null;
    
    // Bright ambient light for good visibility
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambient);
    
    // Directional light (sun-like)
    const directional = new THREE.DirectionalLight(0xffffff, 1.0);
    directional.position.set(50, 100, 50);
    directional.castShadow = true;
    this.scene.add(directional);
    
    // Second directional for fill
    const directional2 = new THREE.DirectionalLight(0x4fc3f7, 0.4);
    directional2.position.set(-50, 50, -50);
    this.scene.add(directional2);
    
    // Hemisphere light for soft fill
    const hemi = new THREE.HemisphereLight(0xaaccff, 0x444466, 0.5);
    this.scene.add(hemi);
    
    // Minimal ground setup (just street lights, no ground plane)
    this.createMinimalGround();
    
    // Add floating particles in background
    this.createAmbientParticles();
    
    // Add cute street cats!
    this.createStreetCats();
  }
  
  private createMinimalGround(): void {
    // NO ground plane - just a thin reference plane for shadows
    // Streets and districts provide visual grounding
    
    // Optional: Very subtle infinite grid reference
    // Position BELOW all roads to avoid z-fighting
    const gridHelper = new THREE.GridHelper(400, 80, 0x222244, 0x111122);
    gridHelper.position.y = -0.1; // Below road baseline
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.1;
    this.groundGroup.add(gridHelper);
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
  
  // @ts-ignore - Legacy street lights, may be re-enabled later
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // Create many cute orange cats walking on SIDEWALKS
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
    
    // Sidewalk positions (z-axis) - roadWidth=12, sidewalkWidth=2
    // Sidewalks are at z = +-(6+1) = +-7
    const sidewalks = [
      { z: 7, name: 'north' },   // North sidewalk
      { z: -7, name: 'south' },  // South sidewalk
    ];
    
    // Create 8 cats total - walking along x-axis on sidewalks
    for (let i = 0; i < 8; i++) {
      const color = catColors[i % catColors.length];
      const startX = -150 + (i * 40) + (Math.random() - 0.5) * 20;
      const sidewalk = sidewalks[i % 2];
      const startZ = sidewalk.z + (Math.random() - 0.5) * 1; // Slight variation on sidewalk
      
      const cat = this.createLowPolyCat(color);
      cat.group.position.set(startX, 0.05, startZ); // Slightly above ground
      
      // Store which sidewalk the cat is on
      cat.group.userData.sidewalkZ = sidewalk.z;
      cat.group.userData.walkAxis = 'x'; // Cats walk along x-axis now
      
      // Set initial rotation based on direction (walking along x-axis)
      cat.group.rotation.y = cat.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
      
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
      
      // Move cat along sidewalk (x-axis)
      const newX = cat.group.position.x + cat.direction * cat.speed * delta;
      
      // Reverse direction at street ends
      if (newX > 180 || newX < -180) {
        cat.direction *= -1;
        // Rotate to face walking direction (along x-axis)
        cat.group.rotation.y = cat.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      
      cat.group.position.x = newX;
      
      // Stay on the assigned sidewalk with slight wobble
      const sidewalkZ = cat.group.userData.sidewalkZ || 7;
      cat.group.position.z = sidewalkZ + Math.sin(cat.walkPhase * 0.3) * 0.3;
      
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
  
  // Cache for city layout - prevents rebuilding every frame
  private lastCityHash: string = '';
  private isCityBuilt: boolean = false;
  
  /**
   * Reset the scene for a new project
   * Call this when loading a new project!
   */
  public resetForNewProject(): void {
    console.log('[CodeArchitecture] Resetting for new project');
    this.isCityBuilt = false;
    this.isTimelineBuilt = false;
    this.lastCityHash = '';
    this.lastProjectHash = '';
  }
  
  /**
   * Update from snapshot with file contents (OPTIMIZED!)
   * Only rebuilds ONCE per project load
   */
  public async updateFromSnapshot(
    snapshot: ProjectSnapshot, 
    fileContents?: Record<string, { content: string; lines: string[]; functions: string[]; imports: string[] }>
  ): Promise<void> {
    // OPTIMIZATION: Only rebuild city ONCE when first called
    // Don't rebuild during timeline playback!
    if (!this.isCityBuilt) {
      console.log('[City] INITIAL BUILD');
      await this.rebuildCityLayout(snapshot, fileContents);
      this.lastCityHash = `${snapshot.files.length}`;
      this.isCityBuilt = true;
    }
    // Skip visibility updates during playback - buildings stay visible
  }
  
  /**
   * Full city rebuild (expensive - only when project structure changes)
   */
  private async rebuildCityLayout(
    snapshot: ProjectSnapshot,
    fileContents?: Record<string, { content: string; lines: string[]; functions: string[]; imports: string[] }>
  ): Promise<void> {
    const startTime = performance.now();
    
    const currentPaths = new Set(snapshot.files.map(f => f.path));
    
    // Remove buildings for deleted files
    for (const [path, building] of this.buildings) {
      if (!currentPaths.has(path)) {
        this.removeBuilding(building);
        this.buildings.delete(path);
      }
    }
    
    // Prepare file data
    const growingFileData = snapshot.files.map(f => ({
      path: f.path,
      name: f.name,
      directory: f.directory || '/',
      extension: f.extension,
      linesOfCode: f.linesOfCode,
      createdAt: f.createdAt instanceof Date ? f.createdAt.getTime() : undefined
    }));
    
    // Calculate layout ONCE
    this.growingLayout = this.growingCityEngine.calculateLayout(growingFileData);
    
    // Clear and recreate
    this.clearCityElements();
    
    // Create roads
    for (const road of this.growingLayout.roads) {
      const roadMesh = createGrowingRoad(road);
      this.streetGroup.add(roadMesh);
    }
    
    // Create decorations (SIMPLIFIED for performance)
    const decorationsGroup = createGrowingDecorations(
      this.growingLayout.decorations.slice(0, 50) // Limit decorations
    );
    this.decorationGroup.add(decorationsGroup);
    
    // Create position lookup
    const positionMap = new Map<string, { pos: THREE.Vector3; rotation: number }>();
    for (const pos of this.growingLayout.buildings) {
      positionMap.set(pos.file.path, { 
        pos: new THREE.Vector3(pos.x, 0.15, pos.z),
        rotation: pos.rotation
      });
    }
    
    // Create buildings (limit to first 100 for performance)
    const filesToRender = snapshot.files.slice(0, 100);
    for (const file of filesToRender) {
      const fileWithContent: FileWithContent = { ...file };
      
      if (fileContents && fileContents[file.path]) {
        fileWithContent.content = fileContents[file.path].content;
        fileWithContent.lines = fileContents[file.path].lines;
        fileWithContent.functions = fileContents[file.path].functions;
        fileWithContent.imports = fileContents[file.path].imports;
      }
      
      const posData = positionMap.get(file.path);
      const position = posData?.pos || new THREE.Vector3();
      const rotation = posData?.rotation || 0;
      
      if (this.buildings.has(file.path)) {
        this.updateBuilding(fileWithContent, position, rotation);
      } else {
        this.createBuilding(fileWithContent, position, rotation);
      }
    }
    
    // Skip connections during playback (expensive)
    // this.updateConnections(fileContents);
    
    console.log('[City] Full rebuild took', (performance.now() - startTime).toFixed(1), 'ms');
  }
  
  /**
   * Fast visibility update for buildings
   */
  private updateBuildingVisibility(snapshot: ProjectSnapshot): void {
    const currentPaths = new Set(snapshot.files.map(f => f.path));
    
    // Show/hide buildings based on current snapshot
    for (const [path, building] of this.buildings) {
      building.mesh.visible = currentPaths.has(path);
      if (building.glowMesh) building.glowMesh.visible = currentPaths.has(path);
    }
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
  
  private createBuilding(file: FileWithContent, position: THREE.Vector3, rotation: number = 0): void {
    const colors = FILE_COLORS[file.extension] || FILE_COLORS['default'];
    const isNew = file.status === 'added';
    const isModified = file.status === 'modified';
    
    // Create building group
    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = rotation;
    
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
  
  private updateBuilding(file: FileWithContent, position: THREE.Vector3, rotation: number = 0): void {
    const building = this.buildings.get(file.path);
    if (!building) return;
    
    building.fileNode = file;
    building.position.copy(position);
    building.group.position.copy(position);
    building.group.rotation.y = rotation;
    
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
  
  private _clearConnectionArcs(): void {
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
  
  private clearCityElements(): void {
    // Clear streets
    this.streetGroup.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.Line) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
    while (this.streetGroup.children.length > 0) {
      this.streetGroup.remove(this.streetGroup.children[0]);
    }
    
    // Clear districts
    this.districtGroup.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
        if (child instanceof THREE.Mesh) child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          if (child.material instanceof THREE.SpriteMaterial && child.material.map) {
            child.material.map.dispose();
          }
          child.material.dispose();
        }
      }
    });
    while (this.districtGroup.children.length > 0) {
      this.districtGroup.remove(this.districtGroup.children[0]);
    }
    
    // Clear decorations
    this.decorationGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
    while (this.decorationGroup.children.length > 0) {
      this.decorationGroup.remove(this.decorationGroup.children[0]);
    }
  }
  
  // @ts-ignore - Legacy tree methods, now handled by cityLayout
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private createPineTreeMesh(): THREE.Group {
    const group = new THREE.Group();
    
    // Trunk
    const trunkGeom = new THREE.CylinderGeometry(0.15, 0.25, 1.5, 6);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x4a3728,
      roughness: 0.9,
      flatShading: true,
    });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 0.75;
    group.add(trunk);
    
    // Foliage (User messages = green pine)
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.8,
      flatShading: true,
      emissive: new THREE.Color(0x1a3a1a),
      emissiveIntensity: 0.2,
    });
    
    const layers = [
      { radius: 1.2, height: 2, y: 2 },
      { radius: 0.9, height: 1.8, y: 3.2 },
      { radius: 0.6, height: 1.5, y: 4.2 },
    ];
    
    for (const layer of layers) {
      const coneGeom = new THREE.ConeGeometry(layer.radius, layer.height, 6);
      const cone = new THREE.Mesh(coneGeom, foliageMat);
      cone.position.y = layer.y;
      group.add(cone);
    }
    
    return group;
  }
  
  // @ts-ignore - Legacy tree method
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private createRoundTreeMesh(): THREE.Group {
    const group = new THREE.Group();
    
    // Trunk
    const trunkGeom = new THREE.CylinderGeometry(0.2, 0.3, 2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033,
      roughness: 0.9,
      flatShading: true,
    });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 1;
    group.add(trunk);
    
    // Foliage (Assistant messages = blue-ish)
    const foliageGeom = new THREE.IcosahedronGeometry(1.5, 0);
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x4a7a9a, // Blue-green for assistant
      roughness: 0.8,
      flatShading: true,
      emissive: new THREE.Color(0x2a4a6a),
      emissiveIntensity: 0.2,
    });
    const foliage = new THREE.Mesh(foliageGeom, foliageMat);
    foliage.position.y = 3;
    foliage.scale.set(1, 1.2, 1);
    group.add(foliage);
    
    return group;
  }
  
  // @ts-ignore - Legacy tree method
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private createCyberTreeMesh(): THREE.Group {
    const group = new THREE.Group();
    
    // Metallic trunk
    const trunkGeom = new THREE.CylinderGeometry(0.1, 0.2, 2.5, 8);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a3a,
      roughness: 0.3,
      metalness: 0.8,
    });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 1.25;
    group.add(trunk);
    
    // Glowing crystal (Tool calls = orange/yellow)
    const crystalGeom = new THREE.OctahedronGeometry(1, 0);
    const crystalMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.7,
    });
    const crystal = new THREE.Mesh(crystalGeom, crystalMat);
    crystal.position.y = 3.5;
    crystal.scale.set(0.8, 1.5, 0.8);
    group.add(crystal);
    
    // Inner glow
    const innerGeom = new THREE.OctahedronGeometry(0.5, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    const inner = new THREE.Mesh(innerGeom, innerMat);
    inner.position.y = 3.5;
    group.add(inner);
    
    // Small point light
    const light = new THREE.PointLight(0xffaa00, 0.5, 8);
    light.position.y = 3.5;
    group.add(light);
    
    return group;
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
  
  private _updateConnections(fileContents?: Record<string, { content: string; lines: string[]; functions: string[]; imports: string[] }>): void {
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
  
  private _visualizeChats(chats: ChatMessage[]): void {
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
  
  // Frame counter for throttling expensive operations
  private frameCount: number = 0;
  
  /**
   * Animation update (OPTIMIZED for 60fps!)
   */
  public update(delta: number): void {
    this.time += delta;
    this.frameCount++;
    
    // OPTIMIZATION: Only run expensive animations every 3rd frame
    const isAnimationFrame = this.frameCount % 3 === 0;
    
    // Skip most animations during fast playback
    if (!isAnimationFrame) return;
    
    // NEW: Animate message timeline elements (throttled)
    if (this.messageTimelineMode && this.timelineLayout) {
      // Skip timeline animation during playback - too expensive
      // this.animateTimeline(this.time);
      
      // Only update a few animals per frame
      if (this.frameCount % 6 === 0) {
        this.updateAnimals(delta * 3);
      }
    }
    
    // OPTIMIZED: Only animate visible buildings, max 20 per frame
    let animatedCount = 0;
    for (const building of this.buildings.values()) {
      if (!building.mesh.visible || animatedCount >= 20) continue;
      animatedCount++;
      
      // Smooth rise animation for new buildings
      if (building.currentY < building.targetY - 0.01) {
        building.currentY += (building.targetY - building.currentY) * 0.1;
        building.group.position.y = building.currentY;
      }
      
      // Simple pulse for active buildings (no material changes - expensive!)
      if (building.isNew || building.fileNode.status === 'modified') {
        const pulse = Math.sin(this.time * 2 + building.pulsePhase) * 0.05 + 1;
        building.mesh.scale.setScalar(pulse);
      }
      
      // Skip label animation - static is fine
      // Skip data stream animation - too expensive
    }
    
    // SKIP connection particle animation - way too expensive
    // Commented out for performance
    
    // PERFORMANCE: Skip all particle animations during playback
    // They are too expensive for smooth playback
    
    // Update our cute street cats (throttled)
    if (this.frameCount % 6 === 0) {
      this.updateCats(delta * 3);
    }
    
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
  
  // Cache for performance - only rebuild when project changes
  private lastProjectHash: string = '';
  private isTimelineBuilt: boolean = false;
  
  /**
   * UPDATE WITH MESSAGE TIMELINE SYSTEM (OPTIMIZED!)
   * Only rebuilds when the project changes, not on every snapshot!
   */
  public updateWithMessageTimeline(snapshot: ProjectSnapshot): void {
    // Create a hash to detect if we need to rebuild
    // Use ONLY chat count since files may vary per snapshot
    const projectHash = `${snapshot.chats.length}`;
    
    // OPTIMIZATION: Only rebuild the full scene when project changes (new chat count)
    // This prevents rebuild when just navigating through timeline
    if (!this.isTimelineBuilt) {
      console.log('[MessageTimeline] INITIAL BUILD');
      this.rebuildTimelineScene(snapshot);
      this.lastProjectHash = projectHash;
      this.isTimelineBuilt = true;
    } else if (Math.abs(parseInt(projectHash) - parseInt(this.lastProjectHash)) > 10) {
      // Only rebuild if chat count changed significantly (new project loaded)
      console.log('[MessageTimeline] REBUILD - major change detected');
      this.rebuildTimelineScene(snapshot);
      this.lastProjectHash = projectHash;
    }
    
    // FAST UPDATE: Just update visibility based on current snapshot
    this.updateTimelineVisibility(snapshot);
  }
  
  /**
   * Full rebuild of the timeline scene (expensive - only when project changes)
   */
  private rebuildTimelineScene(snapshot: ProjectSnapshot): void {
    const startTime = performance.now();
    
    // Convert data to timeline format
    const messages: MessageData[] = snapshot.chats.map(chat => ({
      id: chat.id,
      timestamp: chat.timestamp.getTime(),
      role: chat.role,
      content: chat.content,
      tokenCost: this.estimateTokenCost(chat),
      relatedFiles: chat.relatedFiles,
    }));
    
    const files: TimelineFileData[] = snapshot.files.map(file => ({
      path: file.path,
      name: file.name,
      directory: file.path.split('/').slice(0, -1).join('/'),
      extension: file.extension,
      linesOfCode: file.linesOfCode || 0,
      createdAt: snapshot.timestamp.getTime(),
    }));
    
    // Calculate layout ONCE
    this.timelineLayout = this.messageTimelineEngine.calculateLayout(messages, files);
    
    // Clear old elements
    this.timelineGroup.clear();
    this.messageMarkers.clear();
    this.tokenTrees.clear();
    this.animals.forEach(animal => this.decorationGroup.remove(animal.group));
    this.animals = [];
    
    // Render all timeline elements (but hidden initially)
    this.renderTimelineElementsOptimized(this.timelineLayout);
    
    // Render districts ONCE
    this.renderDistricts(this.timelineLayout);
    
    // Spawn animals ONCE
    this.spawnAnimals(this.timelineLayout);
    
    // Update buildings ONCE
    this.updateFromSnapshot(snapshot);
    
    console.log('[MessageTimeline] Full rebuild took', (performance.now() - startTime).toFixed(1), 'ms');
  }
  
  /**
   * Fast visibility update (cheap - runs every snapshot change)
   */
  private updateTimelineVisibility(snapshot: ProjectSnapshot): void {
    const currentChatIds = new Set(snapshot.chats.map(c => c.id));
    
    // Show/hide message markers based on current snapshot
    this.messageMarkers.forEach((marker, id) => {
      const shouldShow = currentChatIds.has(id);
      marker.visible = shouldShow;
      
      // Animate the latest message
      if (shouldShow && snapshot.chats.length > 0) {
        const isLatest = id === snapshot.chats[snapshot.chats.length - 1].id;
        if (isLatest) {
          // Pulse effect for latest message
          marker.scale.setScalar(1.2);
        } else {
          marker.scale.setScalar(1.0);
        }
      }
    });
    
    // Show token trees up to current point
    let treeIndex = 0;
    this.tokenTrees.forEach((tree, id) => {
      // Show trees for messages we've seen
      const messageId = id.replace('tree-', '');
      tree.visible = currentChatIds.has(messageId);
      treeIndex++;
    });
  }
  
  /**
   * Optimized rendering - uses simpler geometries and fewer objects
   */
  private renderTimelineElementsOptimized(layout: MessageTimelineLayout): void {
    // Limit the number of rendered elements for performance
    const maxElements = 200;
    let count = 0;
    
    for (const element of layout.timeline) {
      if (count >= maxElements) break;
      
      if (element.type === 'message') {
        const messageData = element.data as MessageData;
        // Use simplified marker for performance
        const marker = this.createSimpleMessageMarker(messageData);
        marker.position.copy(element.position);
        marker.visible = false; // Hidden initially
        
        this.timelineGroup.add(marker);
        this.messageMarkers.set(messageData.id, marker);
        count++;
      } else if (element.type === 'tree') {
        const treeData = element.data as import('./messageTimeline').TreeData;
        // Use simplified tree for performance
        const tree = this.createSimpleTokenTree(treeData);
        tree.position.copy(element.position);
        tree.visible = false; // Hidden initially
        
        this.timelineGroup.add(tree);
        this.tokenTrees.set(`tree-${treeData.messageId}`, tree);
        count++;
      }
    }
  }
  
  /**
   * Simple message marker (much cheaper than full version)
   */
  private createSimpleMessageMarker(message: MessageData): THREE.Group {
    const group = new THREE.Group();
    
    const colors = { user: 0x667eea, assistant: 0x48bb78, system: 0xf39c12 };
    const color = colors[message.role] || colors.user;
    
    // Simple sphere - no fancy materials
    const geom = new THREE.SphereGeometry(0.6, 8, 8); // Lower poly
    const mat = new THREE.MeshBasicMaterial({ color }); // No lighting calc
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = 1;
    group.add(mesh);
    
    group.userData.messageData = message;
    group.userData.isMessage = true;
    
    return group;
  }
  
  /**
   * Simple token tree (much cheaper than full version)
   */
  private createSimpleTokenTree(treeData: import('./messageTimeline').TreeData): THREE.Group {
    const group = new THREE.Group();
    
    const scale = Math.max(0.5, Math.min(2, treeData.size));
    
    // Simple trunk
    const trunkGeom = new THREE.CylinderGeometry(0.1 * scale, 0.15 * scale, scale, 6);
    const trunkMat = new THREE.MeshBasicMaterial({ color: 0x8b4513 });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = scale / 2;
    group.add(trunk);
    
    // Simple foliage
    const foliageGeom = new THREE.ConeGeometry(0.5 * scale, scale, 6);
    const foliageMat = new THREE.MeshBasicMaterial({ color: 0x228b22 });
    const foliage = new THREE.Mesh(foliageGeom, foliageMat);
    foliage.position.y = scale * 1.2;
    group.add(foliage);
    
    return group;
  }
  
  /**
   * Render timeline elements (messages and token trees)
   */
  private _renderTimelineElements(layout: MessageTimelineLayout): void {
    for (const element of layout.timeline) {
      if (element.type === 'message') {
        const messageData = element.data as MessageData;
        const marker = createMessageMarker(messageData);
        marker.position.copy(element.position);
        marker.userData.delay = element.delay;
        
        this.timelineGroup.add(marker);
        this.messageMarkers.set(messageData.id, marker);
      } else if (element.type === 'tree') {
        const treeData = element.data as import('./messageTimeline').TreeData;
        const tree = createTokenTree(treeData);
        tree.position.copy(element.position);
        tree.userData.delay = element.delay;
        
        this.timelineGroup.add(tree);
        this.tokenTrees.set(treeData.messageId, tree);
      }
    }
  }
  
  /**
   * Render districts with their streets and decorations (OPTIMIZED!)
   */
  private renderDistricts(layout: MessageTimelineLayout): void {
    // PERFORMANCE: Limit districts to prevent lag
    const maxDistricts = 5;
    const maxStreetsPerDistrict = 3;
    const maxDecorationsPerDistrict = 10;
    
    let districtCount = 0;
    for (const district of layout.districts) {
      if (districtCount >= maxDistricts) break;
      districtCount++;
      
      // Render limited district streets
      let streetCount = 0;
      for (const street of district.streets) {
        if (streetCount >= maxStreetsPerDistrict) break;
        streetCount++;
        
        const road = this.createDistrictRoad(street);
        this.streetGroup.add(road);
      }
      
      // Render limited decorations
      let decoCount = 0;
      for (const deco of district.decorations) {
        if (decoCount >= maxDecorationsPerDistrict) break;
        decoCount++;
        
        let mesh: THREE.Group;
        
        switch (deco.type) {
          case 'park':
            mesh = createPark(deco.scale);
            break;
          case 'fountain':
            mesh = createFountain(deco.scale);
            break;
          case 'bench':
            mesh = createBench(deco.scale);
            break;
          case 'tree':
            mesh = this.createSimpleTree(deco.scale);
            break;
          case 'lamp':
            mesh = this.createSimpleLamp(deco.scale);
            break;
          default:
            continue;
        }
        
        mesh.position.copy(deco.position);
        mesh.userData.delay = deco.delay;
        this.decorationGroup.add(mesh);
      }
    }
  }
  
  /**
   * Create a simple district road
   */
  private createDistrictRoad(street: any): THREE.Group {
    const group = new THREE.Group();
    
    for (let i = 0; i < street.points.length - 1; i++) {
      const p1 = street.points[i];
      const p2 = street.points[i + 1];
      
      const length = p1.distanceTo(p2);
      const angle = Math.atan2(p2.z - p1.z, p2.x - p1.x);
      const midX = (p1.x + p2.x) / 2;
      const midZ = (p1.z + p2.z) / 2;
      
      // Road surface
      const roadGeom = new THREE.PlaneGeometry(length, street.width);
      const roadMat = new THREE.MeshStandardMaterial({
        color: street.type === 'main' ? 0x404050 : 0x353540,
        roughness: 0.8,
      });
      
      const road = new THREE.Mesh(roadGeom, roadMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = -angle + Math.PI / 2;
      road.position.set(midX, 0.01, midZ);
      group.add(road);
      
      // Center line
      if (street.type === 'main') {
        const lineGeom = new THREE.PlaneGeometry(length, 0.2);
        const lineMat = new THREE.MeshBasicMaterial({
          color: 0xffdd00,
          transparent: true,
          opacity: 0.6,
        });
        
        const line = new THREE.Mesh(lineGeom, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.rotation.z = -angle + Math.PI / 2;
        line.position.set(midX, 0.02, midZ);
        group.add(line);
      }
    }
    
    return group;
  }
  
  /**
   * Spawn animals (cats and seagulls)
   */
  private spawnAnimals(layout: MessageTimelineLayout): void {
    this.animals = [];
    
    for (const spawn of layout.animals) {
      if (spawn.type === 'cat') {
        const cats = createManyCats(spawn.path, spawn.count);
        this.animals.push(...cats);
        
        for (const cat of cats) {
          this.decorationGroup.add(cat.group);
        }
      } else if (spawn.type === 'seagull') {
        const seagulls = createSeagulls(
          spawn.path[0] || new THREE.Vector3(0, 30, 0),
          50,
          spawn.count
        );
        this.animals.push(...seagulls);
        
        for (const seagull of seagulls) {
          this.decorationGroup.add(seagull.group);
        }
      }
    }
  }
  
  /**
   * Update animal animations
   */
  private updateAnimals(delta: number): void {
    for (const animal of this.animals) {
      updateAnimalPath(animal, delta);
    }
  }
  
  /**
   * Animate timeline elements
   */
  private _animateTimeline(time: number): void {
    // Animate messages
    for (const marker of this.messageMarkers.values()) {
      animateMessage(marker, time);
    }
    
    // Animate fountains
    this.decorationGroup.children.forEach(child => {
      if (child.userData.isFountain) {
        animateFountain(child as THREE.Group, 0.016);
      }
    });
  }
  
  /**
   * Estimate token cost from message
   */
  private estimateTokenCost(chat: ChatMessage): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(chat.content.length / 4);
  }
  
  /**
   * Create simple tree (for district decoration)
   */
  private createSimpleTree(scale: number): THREE.Group {
    const tree = new THREE.Group();
    
    const trunkGeom = new THREE.CylinderGeometry(0.2 * scale, 0.3 * scale, 1.5 * scale, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 0.75 * scale;
    tree.add(trunk);
    
    const crownGeom = new THREE.ConeGeometry(scale, 2 * scale, 6);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x3d7a37 });
    const crown = new THREE.Mesh(crownGeom, crownMat);
    crown.position.y = 2.5 * scale;
    tree.add(crown);
    
    return tree;
  }
  
  /**
   * Create simple lamp (for district decoration)
   */
  private createSimpleLamp(scale: number): THREE.Group {
    const lamp = new THREE.Group();
    
    const poleGeom = new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, 3 * scale, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333344 });
    const pole = new THREE.Mesh(poleGeom, poleMat);
    pole.position.y = 1.5 * scale;
    lamp.add(pole);
    
    const bulbGeom = new THREE.SphereGeometry(0.3 * scale, 8, 8);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
    const bulb = new THREE.Mesh(bulbGeom, bulbMat);
    bulb.position.y = 3 * scale;
    lamp.add(bulb);
    
    const light = new THREE.PointLight(0xffcc66, 2, 10 * scale);
    light.position.y = 3 * scale;
    lamp.add(light);
    
    return lamp;
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
