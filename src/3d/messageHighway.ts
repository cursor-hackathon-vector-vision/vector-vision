import * as THREE from 'three';
import type { ChatMessage } from '../types';

/**
 * MESSAGE HIGHWAY SYSTEM - MULTI-TRAIL VERSION
 * 
 * A highway running alongside the city where events travel as vehicles:
 * - AI messages = Buses (green lane)
 * - User messages = Cars (blue lane)
 * - Git commits = Trucks (orange lane)
 * - Commands = Motorcycles (yellow - future)
 * 
 * Messages drive along the road and can highlight connected buildings.
 */

// Git commit interface (simplified for highway)
export interface GitCommitEvent {
  id: string;
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  timestamp: Date;
  filesChanged: number;
}

// Highway configuration
const HIGHWAY_CONFIG = {
  // Dimensions
  totalWidth: 20,         // Total highway width
  laneWidth: 4,           // Each lane width
  sidewalkWidth: 2,       // Sidewalk for cats
  medianWidth: 1,         // Center divider
  
  // Position
  offsetZ: -40,           // Z offset from city center
  length: 200,            // Highway length
  
  // Vehicle sizes
  busLength: 3,
  busWidth: 1.2,
  busHeight: 1.5,
  
  carLength: 2,
  carWidth: 0.9,
  carHeight: 0.8,
  
  // Animation
  baseSpeed: 15,          // Units per second
  spawnInterval: 800,     // ms between vehicle spawns
};

// Lane configuration - MULTI-TRAIL
const LANES = {
  AI_OUTBOUND: { z: -2.5, direction: 1, color: 0x48bb78 },
  AI_INBOUND: { z: -7.5, direction: -1, color: 0x38a169 },
  USER_OUTBOUND: { z: 2.5, direction: 1, color: 0x667eea },
  USER_INBOUND: { z: 7.5, direction: -1, color: 0x5a67d8 },
  // NEW: Git commit lane (outer lanes)
  GIT_OUTBOUND: { z: -10, direction: 1, color: 0xed8936 },  // Orange
  GIT_INBOUND: { z: 10, direction: -1, color: 0xdd6b20 },   // Dark orange
};

export interface MessageVehicle {
  id: string;
  message?: ChatMessage;
  gitCommit?: GitCommitEvent;
  type: 'bus' | 'car' | 'truck';
  mesh: THREE.Group;
  lane: keyof typeof LANES;
  position: number;       // Position along highway (0 = start)
  speed: number;
  active: boolean;
  highlightBeam?: THREE.Line;
  labelSprite?: THREE.Sprite;
}

export class MessageHighway {
  private scene: THREE.Scene;
  private highwayGroup: THREE.Group;
  private vehicleGroup: THREE.Group;
  private vehicles: Map<string, MessageVehicle> = new Map();
  private messageQueue: ChatMessage[] = [];
  private lastSpawnTime: number = 0;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    
    // Create groups
    this.highwayGroup = new THREE.Group();
    this.highwayGroup.name = 'highway';
    this.highwayGroup.position.z = HIGHWAY_CONFIG.offsetZ;
    
    this.vehicleGroup = new THREE.Group();
    this.vehicleGroup.name = 'vehicles';
    
    this.highwayGroup.add(this.vehicleGroup);
    scene.add(this.highwayGroup);
    
    // Build the highway
    this.buildHighway();
  }
  
  /**
   * Build the highway road structure
   */
  private buildHighway(): void {
    const length = HIGHWAY_CONFIG.length;
    const totalWidth = HIGHWAY_CONFIG.totalWidth;
    
    // Main road surface
    const roadGeom = new THREE.PlaneGeometry(length, totalWidth);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x2d3748,
      roughness: 0.9,
    });
    const road = new THREE.Mesh(roadGeom, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, 0);
    this.highwayGroup.add(road);
    
    // Center median
    const medianGeom = new THREE.BoxGeometry(length, 0.15, HIGHWAY_CONFIG.medianWidth);
    const medianMat = new THREE.MeshStandardMaterial({ color: 0x4a5568 });
    const median = new THREE.Mesh(medianGeom, medianMat);
    median.position.set(0, 0.075, 0);
    this.highwayGroup.add(median);
    
    // Lane markings
    this.createLaneMarkings(length);
    
    // Sidewalks (for cats!)
    this.createSidewalks(length);
    
    // Street lights along highway
    this.createHighwayLights(length);
    
    // Lane labels (AI / USER)
    this.createLaneLabels();
  }
  
  /**
   * Create dashed lane markings
   */
  private createLaneMarkings(length: number): void {
    const dashLength = 3;
    const gapLength = 2;
    const totalDashes = Math.floor(length / (dashLength + gapLength));
    
    const markingGeom = new THREE.PlaneGeometry(dashLength, 0.15);
    const markingMat = new THREE.MeshBasicMaterial({ color: 0xf7fafc });
    
    // Lane dividers
    const laneZs = [-5, 5]; // Between AI lanes, between User lanes
    
    for (const laneZ of laneZs) {
      for (let i = 0; i < totalDashes; i++) {
        const mark = new THREE.Mesh(markingGeom, markingMat);
        mark.rotation.x = -Math.PI / 2;
        mark.position.set(
          -length/2 + i * (dashLength + gapLength) + dashLength/2,
          0.02,
          laneZ
        );
        this.highwayGroup.add(mark);
      }
    }
    
    // Solid edge lines
    const edgeGeom = new THREE.PlaneGeometry(length, 0.2);
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xedf2f7 });
    
    for (const z of [-10, 10]) {
      const edge = new THREE.Mesh(edgeGeom, edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(0, 0.02, z);
      this.highwayGroup.add(edge);
    }
    
    // Center double yellow line
    const yellowGeom = new THREE.PlaneGeometry(length, 0.12);
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xf6e05e });
    
    for (const offset of [-0.2, 0.2]) {
      const line = new THREE.Mesh(yellowGeom, yellowMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.02, offset);
      this.highwayGroup.add(line);
    }
  }
  
  /**
   * Create sidewalks for the cats
   */
  private createSidewalks(length: number): void {
    const sidewalkGeom = new THREE.BoxGeometry(length, 0.1, HIGHWAY_CONFIG.sidewalkWidth);
    const sidewalkMat = new THREE.MeshStandardMaterial({ 
      color: 0x9ca3af,
      roughness: 0.7,
    });
    
    for (const z of [-11.5, 11.5]) {
      const sidewalk = new THREE.Mesh(sidewalkGeom, sidewalkMat);
      sidewalk.position.set(0, 0.05, z);
      this.highwayGroup.add(sidewalk);
    }
  }
  
  /**
   * Create highway lights
   */
  private createHighwayLights(length: number): void {
    const lightSpacing = 20;
    const numLights = Math.floor(length / lightSpacing);
    
    for (let i = 0; i < numLights; i++) {
      const x = -length/2 + i * lightSpacing + lightSpacing/2;
      
      // Lights on both sides
      for (const z of [-12, 12]) {
        const light = this.createHighwayLight();
        light.position.set(x, 0, z);
        light.rotation.y = z < 0 ? Math.PI : 0;
        this.highwayGroup.add(light);
      }
    }
  }
  
  /**
   * Create a single highway light
   */
  private createHighwayLight(): THREE.Group {
    const light = new THREE.Group();
    
    // Pole
    const poleGeom = new THREE.CylinderGeometry(0.08, 0.1, 5, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a5568 });
    const pole = new THREE.Mesh(poleGeom, poleMat);
    pole.position.y = 2.5;
    light.add(pole);
    
    // Arm
    const armGeom = new THREE.BoxGeometry(2, 0.1, 0.1);
    const arm = new THREE.Mesh(armGeom, poleMat);
    arm.position.set(1, 5, 0);
    light.add(arm);
    
    // Light fixture
    const fixtureGeom = new THREE.BoxGeometry(0.8, 0.15, 0.3);
    const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x2d3748 });
    const fixture = new THREE.Mesh(fixtureGeom, fixtureMat);
    fixture.position.set(1.5, 4.9, 0);
    light.add(fixture);
    
    // Light bulb (emissive)
    const bulbGeom = new THREE.PlaneGeometry(0.6, 0.2);
    const bulbMat = new THREE.MeshBasicMaterial({ 
      color: 0xfff9c4,
      transparent: true,
      opacity: 0.9,
    });
    const bulb = new THREE.Mesh(bulbGeom, bulbMat);
    bulb.rotation.x = -Math.PI / 2;
    bulb.position.set(1.5, 4.82, 0);
    light.add(bulb);
    
    // Actual light
    const pointLight = new THREE.PointLight(0xfff9c4, 0.5, 15);
    pointLight.position.set(1.5, 4.8, 0);
    light.add(pointLight);
    
    return light;
  }
  
  /**
   * Create lane labels
   */
  private createLaneLabels(): void {
    // AI lane sign
    const aiSign = this.createLaneSign('🤖 AI', 0x48bb78);
    aiSign.position.set(-HIGHWAY_CONFIG.length/2 + 5, 3, -5);
    this.highwayGroup.add(aiSign);
    
    // User lane sign  
    const userSign = this.createLaneSign('👤 USER', 0x667eea);
    userSign.position.set(-HIGHWAY_CONFIG.length/2 + 5, 3, 5);
    this.highwayGroup.add(userSign);
  }
  
  /**
   * Create a lane sign sprite
   */
  private createLaneSign(text: string, color: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    // Background
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.roundRect(0, 0, 256, 64, 8);
    ctx.fill();
    
    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4, 1, 1);
    
    return sprite;
  }
  
  /**
   * Add a message to the queue
   */
  public queueMessage(message: ChatMessage): void {
    this.messageQueue.push(message);
  }
  
  /**
   * Spawn a vehicle for a message
   */
  public spawnVehicle(message: ChatMessage): MessageVehicle {
    const isAI = message.role === 'assistant';
    const lane = isAI ? 'AI_OUTBOUND' : 'USER_OUTBOUND';
    const laneConfig = LANES[lane];
    
    // Create vehicle mesh
    const vehicleMesh = isAI 
      ? this.createBus(laneConfig.color, message.content.slice(0, 30))
      : this.createCar(laneConfig.color, message.content.slice(0, 20));
    
    // Position at start of highway
    const startX = -HIGHWAY_CONFIG.length / 2 - 5;
    vehicleMesh.position.set(startX, 0, laneConfig.z);
    
    this.vehicleGroup.add(vehicleMesh);
    
    const vehicle: MessageVehicle = {
      id: message.id,
      message,
      type: isAI ? 'bus' : 'car',
      mesh: vehicleMesh,
      lane,
      position: startX,
      speed: HIGHWAY_CONFIG.baseSpeed + Math.random() * 5,
      active: true,
    };
    
    this.vehicles.set(message.id, vehicle);
    return vehicle;
  }
  
  /**
   * Create a bus (for AI messages)
   */
  private createBus(color: number, label: string): THREE.Group {
    const bus = new THREE.Group();
    
    // Body
    const bodyGeom = new THREE.BoxGeometry(
      HIGHWAY_CONFIG.busLength,
      HIGHWAY_CONFIG.busHeight,
      HIGHWAY_CONFIG.busWidth
    );
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.3,
      roughness: 0.7,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = HIGHWAY_CONFIG.busHeight / 2 + 0.2;
    bus.add(body);
    
    // Windows
    const windowGeom = new THREE.BoxGeometry(2.5, 0.5, HIGHWAY_CONFIG.busWidth + 0.01);
    const windowMat = new THREE.MeshBasicMaterial({
      color: 0xb3e5fc,
      transparent: true,
      opacity: 0.7,
    });
    const window = new THREE.Mesh(windowGeom, windowMat);
    window.position.y = HIGHWAY_CONFIG.busHeight / 2 + 0.4;
    bus.add(window);
    
    // Wheels
    this.addWheels(bus, HIGHWAY_CONFIG.busLength * 0.35, 0.2);
    
    // Label sprite
    const labelSprite = this.createVehicleLabel(label, color);
    labelSprite.position.y = HIGHWAY_CONFIG.busHeight + 0.8;
    bus.add(labelSprite);
    
    return bus;
  }
  
  /**
   * Create a car (for user messages)
   */
  private createCar(color: number, label: string): THREE.Group {
    const car = new THREE.Group();
    
    // Body
    const bodyGeom = new THREE.BoxGeometry(
      HIGHWAY_CONFIG.carLength,
      HIGHWAY_CONFIG.carHeight * 0.6,
      HIGHWAY_CONFIG.carWidth
    );
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.4,
      roughness: 0.6,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.3;
    car.add(body);
    
    // Roof/cabin
    const roofGeom = new THREE.BoxGeometry(
      HIGHWAY_CONFIG.carLength * 0.6,
      HIGHWAY_CONFIG.carHeight * 0.5,
      HIGHWAY_CONFIG.carWidth * 0.9
    );
    const roof = new THREE.Mesh(roofGeom, bodyMat);
    roof.position.set(-0.1, 0.55, 0);
    car.add(roof);
    
    // Windows
    const windowGeom = new THREE.BoxGeometry(
      HIGHWAY_CONFIG.carLength * 0.55,
      HIGHWAY_CONFIG.carHeight * 0.35,
      HIGHWAY_CONFIG.carWidth + 0.01
    );
    const windowMat = new THREE.MeshBasicMaterial({
      color: 0xe3f2fd,
      transparent: true,
      opacity: 0.7,
    });
    const window = new THREE.Mesh(windowGeom, windowMat);
    window.position.set(-0.1, 0.55, 0);
    car.add(window);
    
    // Wheels
    this.addWheels(car, HIGHWAY_CONFIG.carLength * 0.35, 0.15);
    
    // Label sprite
    const labelSprite = this.createVehicleLabel(label, color);
    labelSprite.position.y = HIGHWAY_CONFIG.carHeight + 0.5;
    car.add(labelSprite);
    
    return car;
  }
  
  /**
   * Add wheels to a vehicle
   */
  private addWheels(vehicle: THREE.Group, offsetX: number, radius: number): void {
    const wheelGeom = new THREE.CylinderGeometry(radius, radius, 0.1, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    
    const positions = [
      { x: offsetX, z: 0.45 },
      { x: offsetX, z: -0.45 },
      { x: -offsetX, z: 0.45 },
      { x: -offsetX, z: -0.45 },
    ];
    
    for (const pos of positions) {
      const wheel = new THREE.Mesh(wheelGeom, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(pos.x, radius, pos.z);
      vehicle.add(wheel);
    }
  }
  
  /**
   * Create a label sprite for a vehicle
   */
  private createVehicleLabel(text: string, _bgColor: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(0, 0, 256, 64, 8);
    ctx.fill();
    
    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text + '...', 128, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(3, 0.75, 1);
    
    return sprite;
  }
  
  /**
   * Update animation
   */
  public update(delta: number): void {
    const now = Date.now();
    
    // Spawn queued messages
    if (this.messageQueue.length > 0 && now - this.lastSpawnTime > HIGHWAY_CONFIG.spawnInterval) {
      const message = this.messageQueue.shift()!;
      this.spawnVehicle(message);
      this.lastSpawnTime = now;
    }
    
    // Update vehicles
    for (const [id, vehicle] of this.vehicles) {
      if (!vehicle.active) continue;
      
      // Move vehicle
      const laneConfig = LANES[vehicle.lane];
      vehicle.position += vehicle.speed * delta * laneConfig.direction;
      vehicle.mesh.position.x = vehicle.position;
      
      // Remove if off screen
      if (Math.abs(vehicle.position) > HIGHWAY_CONFIG.length / 2 + 10) {
        vehicle.active = false;
        this.vehicleGroup.remove(vehicle.mesh);
        this.vehicles.delete(id);
      }
    }
  }
  
  /**
   * Clear all vehicles
   */
  public clear(): void {
    for (const vehicle of this.vehicles.values()) {
      this.vehicleGroup.remove(vehicle.mesh);
    }
    this.vehicles.clear();
    this.messageQueue = [];
  }
  
  /**
   * Get the highway group for external positioning
   */
  public getGroup(): THREE.Group {
    return this.highwayGroup;
  }
}
