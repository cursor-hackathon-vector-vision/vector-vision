import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SCENE_CONFIG } from '../types';
import { EffectsManager, AmbientParticles, GlowRing, RisingParticles } from './effects';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;
  
  private container: HTMLElement;
  private animationFrameId: number | null = null;
  private clock: THREE.Clock;
  
  // Scene objects
  public groundPlane: THREE.Mesh | null = null;
  public gridHelper: THREE.GridHelper | null = null;
  
  // Effects
  private effectsManager: EffectsManager | null = null;
  private ambientParticles: AmbientParticles | null = null;
  private activeEffects: (GlowRing | RisingParticles)[] = [];
  public usePostProcessing: boolean = true;
  
  // Raycasting for interaction
  public raycaster: THREE.Raycaster;
  public mouse: THREE.Vector2;
  
  // Callbacks
  public onUpdate: ((delta: number) => void) | null = null;
  public onHover: ((object: THREE.Object3D | null) => void) | null = null;
  public onClick: ((object: THREE.Object3D | null) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Initialize scene - no background, no fog
    this.scene = new THREE.Scene();
    this.scene.background = null; // Transparent background
    
    // Initialize camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(
      SCENE_CONFIG.CAMERA_FOV,
      aspect,
      SCENE_CONFIG.CAMERA_NEAR,
      SCENE_CONFIG.CAMERA_FAR
    );
    this.camera.position.set(
      SCENE_CONFIG.CAMERA_INITIAL_POSITION.x,
      SCENE_CONFIG.CAMERA_INITIAL_POSITION.y,
      SCENE_CONFIG.CAMERA_INITIAL_POSITION.z
    );
    
    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);
    
    // Initialize controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 500;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
    this.controls.target.set(0, 0, 0);
    
    // Setup lights
    this.setupLights();
    
    // Setup ground
    this.setupGround();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Setup post-processing effects
    this.setupEffects();
    
    // Start render loop
    this.animate();
  }
  
  private setupEffects(): void {
    // Post-processing
    try {
      this.effectsManager = new EffectsManager(this.renderer, this.scene, this.camera);
    } catch (e) {
      console.warn('Post-processing not available:', e);
      this.usePostProcessing = false;
    }
    
    // Ambient particles
    this.ambientParticles = new AmbientParticles(300);
    this.scene.add(this.ambientParticles.points);
  }
  
  public spawnGlowRing(position: THREE.Vector3, color?: THREE.Color): void {
    const ring = new GlowRing(position, color);
    this.scene.add(ring.mesh);
    this.activeEffects.push(ring);
  }
  
  public spawnRisingParticles(position: THREE.Vector3, color?: THREE.Color): void {
    const particles = new RisingParticles(position, color);
    this.scene.add(particles.points);
    this.activeEffects.push(particles);
  }

  private setupLights(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(
      SCENE_CONFIG.AMBIENT_LIGHT_COLOR,
      SCENE_CONFIG.AMBIENT_LIGHT_INTENSITY
    );
    this.scene.add(ambient);
    
    // Main directional light (sun)
    const directional = new THREE.DirectionalLight(
      SCENE_CONFIG.DIRECTIONAL_LIGHT_COLOR,
      SCENE_CONFIG.DIRECTIONAL_LIGHT_INTENSITY
    );
    directional.position.set(30, 50, 30);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    directional.shadow.camera.near = 0.5;
    directional.shadow.camera.far = 200;
    directional.shadow.camera.left = -50;
    directional.shadow.camera.right = 50;
    directional.shadow.camera.top = 50;
    directional.shadow.camera.bottom = -50;
    this.scene.add(directional);
    
    // Accent light (purple/blue tint)
    const accent = new THREE.DirectionalLight(0x667eea, 0.3);
    accent.position.set(-20, 30, -20);
    this.scene.add(accent);
    
    // Rim light
    const rim = new THREE.DirectionalLight(0x764ba2, 0.2);
    rim.position.set(0, 10, -30);
    this.scene.add(rim);
  }

  private setupGround(): void {
    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: SCENE_CONFIG.GROUND_COLOR,
      roughness: 0.9,
      metalness: 0.1
    });
    this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);
    
    // Grid helper
    this.gridHelper = new THREE.GridHelper(200, 100, 0x222233, 0x151520);
    this.gridHelper.position.y = 0.01;
    this.scene.add(this.gridHelper);
  }

  private setupEventListeners(): void {
    // Resize handler
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Mouse events
    this.renderer.domElement.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.renderer.domElement.addEventListener('click', this.handleClick.bind(this));
  }

  private handleResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
    this.effectsManager?.setSize(width, height);
  }

  private handleMouseMove(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Raycast for hover
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    const building = intersects.find(i => i.object.userData.isBuilding);
    if (this.onHover) {
      this.onHover(building ? building.object : null);
    }
  }

  private handleClick(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Raycast for click
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    const building = intersects.find(i => i.object.userData.isBuilding);
    if (this.onClick) {
      this.onClick(building ? building.object : null);
    }
  }

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    
    const delta = this.clock.getDelta();
    
    // Update controls
    this.controls.update();
    
    // Update ambient particles
    this.ambientParticles?.update();
    
    // Update active effects
    this.activeEffects = this.activeEffects.filter(effect => {
      const alive = effect.update();
      if (!alive) {
        if ('mesh' in effect) {
          this.scene.remove(effect.mesh);
        } else if ('points' in effect) {
          this.scene.remove(effect.points);
        }
        effect.dispose();
      }
      return alive;
    });
    
    // Call custom update callback
    if (this.onUpdate) {
      this.onUpdate(delta);
    }
    
    // Render with or without post-processing
    if (this.usePostProcessing && this.effectsManager) {
      this.effectsManager.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public focusOnPoint(point: THREE.Vector3, duration: number = 1000): void {
    const startTarget = this.controls.target.clone();
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
      
      this.controls.target.lerpVectors(startTarget, point, eased);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  public resetCamera(): void {
    const targetPosition = new THREE.Vector3(
      SCENE_CONFIG.CAMERA_INITIAL_POSITION.x,
      SCENE_CONFIG.CAMERA_INITIAL_POSITION.y,
      SCENE_CONFIG.CAMERA_INITIAL_POSITION.z
    );
    
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const startTime = Date.now();
    const duration = 1000;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      
      this.camera.position.lerpVectors(startPosition, targetPosition, eased);
      this.controls.target.lerpVectors(startTarget, new THREE.Vector3(0, 0, 0), eased);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  public dispose(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    window.removeEventListener('resize', this.handleResize.bind(this));
    
    // Dispose effects
    this.effectsManager?.dispose();
    this.ambientParticles?.dispose();
    this.activeEffects.forEach(e => e.dispose());
    
    this.renderer.dispose();
    this.controls.dispose();
    
    // Dispose all geometries and materials
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
  
  public togglePostProcessing(): void {
    this.usePostProcessing = !this.usePostProcessing;
  }
}
