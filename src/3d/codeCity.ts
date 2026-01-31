import * as THREE from 'three';
import type { FileNode, Building, District, ProjectSnapshot } from '../types';
import { SCENE_CONFIG, getFileColor } from '../types';

export class CodeCity {
  private scene: THREE.Scene;
  private buildings: Map<string, Building> = new Map();
  private districts: Map<string, District> = new Map();
  private particles: THREE.Points | null = null;
  private particlePositions: Float32Array | null = null;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupParticleSystem();
  }

  private setupParticleSystem(): void {
    const particleCount = 1000;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 50 + 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
      
      colors[i * 3] = 0.4 + Math.random() * 0.2;
      colors[i * 3 + 1] = 0.5 + Math.random() * 0.2;
      colors[i * 3 + 2] = 0.9 + Math.random() * 0.1;
    }
    
    this.particlePositions = positions;
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    
    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  public updateFromSnapshot(snapshot: ProjectSnapshot): void {
    const files = snapshot.files;
    
    // Group files by directory
    const filesByDir = new Map<string, FileNode[]>();
    files.forEach(file => {
      const dir = file.directory || '/';
      if (!filesByDir.has(dir)) {
        filesByDir.set(dir, []);
      }
      filesByDir.get(dir)!.push(file);
    });
    
    // Calculate district positions using treemap-like layout
    const districtLayout = this.calculateDistrictLayout(filesByDir);
    
    // Update or create districts and buildings
    const processedPaths = new Set<string>();
    
    districtLayout.forEach((layout, dir) => {
      let district = this.districts.get(dir);
      
      if (!district) {
        district = this.createDistrict(dir, layout.position);
        this.districts.set(dir, district);
      }
      
      const dirFiles = filesByDir.get(dir) || [];
      this.layoutBuildingsInDistrict(district, dirFiles, processedPaths);
    });
    
    // Remove buildings for deleted files
    this.buildings.forEach((building, path) => {
      if (!processedPaths.has(path)) {
        this.removeBuilding(building);
        this.buildings.delete(path);
      }
    });
  }

  private calculateDistrictLayout(filesByDir: Map<string, FileNode[]>): Map<string, { position: THREE.Vector3; size: number }> {
    const layout = new Map<string, { position: THREE.Vector3; size: number }>();
    const dirs = Array.from(filesByDir.keys()).sort();
    
    // Simple grid layout for districts
    const gridSize = Math.ceil(Math.sqrt(dirs.length));
    const spacing = 15;
    
    dirs.forEach((dir, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      
      const x = (col - gridSize / 2) * spacing;
      const z = (row - gridSize / 2) * spacing;
      
      const fileCount = filesByDir.get(dir)?.length || 1;
      const size = Math.max(5, Math.sqrt(fileCount) * 3);
      
      layout.set(dir, {
        position: new THREE.Vector3(x, 0, z),
        size
      });
    });
    
    return layout;
  }

  private createDistrict(directory: string, position: THREE.Vector3): District {
    const district: District = {
      id: directory,
      directory,
      buildings: [],
      position,
      bounds: new THREE.Box3()
    };
    
    // Create ground plate for district
    const groundGeometry = new THREE.PlaneGeometry(12, 12);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a28,
      roughness: 0.8,
      metalness: 0.2,
      transparent: true,
      opacity: 0.8
    });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.copy(position);
    ground.position.y = 0.02;
    ground.receiveShadow = true;
    
    district.ground = ground;
    this.scene.add(ground);
    
    // Create label for district
    const label = this.createTextSprite(this.getShortDirName(directory));
    label.position.copy(position);
    label.position.y = 0.5;
    label.position.z += 6;
    district.label = label;
    this.scene.add(label);
    
    return district;
  }

  private layoutBuildingsInDistrict(district: District, files: FileNode[], processedPaths: Set<string>): void {
    const gridSize = Math.ceil(Math.sqrt(files.length));
    const spacing = SCENE_CONFIG.BUILDING_BASE_SIZE + SCENE_CONFIG.BUILDING_GAP;
    
    files.forEach((file, index) => {
      processedPaths.add(file.path);
      
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      
      const localX = (col - gridSize / 2 + 0.5) * spacing;
      const localZ = (row - gridSize / 2 + 0.5) * spacing;
      
      const position = new THREE.Vector3(
        district.position.x + localX,
        0,
        district.position.z + localZ
      );
      
      let building = this.buildings.get(file.path);
      
      if (!building) {
        building = this.createBuilding(file, position);
        this.buildings.set(file.path, building);
        district.buildings.push(building);
      } else {
        this.updateBuilding(building, file, position);
      }
    });
  }

  private createBuilding(file: FileNode, position: THREE.Vector3): Building {
    const height = this.calculateBuildingHeight(file.linesOfCode);
    const color = new THREE.Color(getFileColor(file.extension));
    
    // Create building geometry
    const geometry = new THREE.BoxGeometry(
      SCENE_CONFIG.BUILDING_BASE_SIZE,
      height,
      SCENE_CONFIG.BUILDING_BASE_SIZE
    );
    
    // Create material with emissive glow for new files
    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.4,
      metalness: 0.6,
      emissive: file.status === 'added' ? color : new THREE.Color(0x000000),
      emissiveIntensity: file.status === 'added' ? 0.5 : 0
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.position.y = height / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Store reference in userData for raycasting
    mesh.userData = {
      isBuilding: true,
      filePath: file.path,
      fileName: file.name
    };
    
    this.scene.add(mesh);
    
    // Animate appearance
    mesh.scale.y = 0.01;
    this.animateScale(mesh, 1, 500);
    
    // Spawn particles for new files
    if (file.status === 'added') {
      this.spawnParticleBurst(position, color);
    }
    
    const building: Building = {
      id: file.path,
      fileNode: file,
      position,
      height,
      baseHeight: 0,
      targetHeight: height,
      width: SCENE_CONFIG.BUILDING_BASE_SIZE,
      depth: SCENE_CONFIG.BUILDING_BASE_SIZE,
      color,
      mesh,
      status: 'growing',
      animationProgress: 0
    };
    
    return building;
  }

  private updateBuilding(building: Building, file: FileNode, position: THREE.Vector3): void {
    const newHeight = this.calculateBuildingHeight(file.linesOfCode);
    
    // Update position if changed
    if (!building.position.equals(position)) {
      building.position.copy(position);
      building.mesh.position.x = position.x;
      building.mesh.position.z = position.z;
    }
    
    // Update height if changed
    if (Math.abs(building.height - newHeight) > 0.1) {
      building.targetHeight = newHeight;
      building.status = newHeight > building.height ? 'growing' : 'shrinking';
      
      // Animate height change
      this.animateHeight(building, newHeight, 500);
    }
    
    // Update color/glow based on status
    const material = building.mesh.material as THREE.MeshStandardMaterial;
    if (file.status === 'modified') {
      material.emissive.set(building.color);
      material.emissiveIntensity = 0.3;
      
      // Fade out glow
      setTimeout(() => {
        material.emissiveIntensity = 0;
      }, 1000);
    }
    
    building.fileNode = file;
  }

  private removeBuilding(building: Building): void {
    // Animate destruction
    this.animateScale(building.mesh, 0, 300, () => {
      this.scene.remove(building.mesh);
      building.mesh.geometry.dispose();
      (building.mesh.material as THREE.Material).dispose();
    });
    
    // Spawn destruction particles
    this.spawnParticleBurst(building.position, new THREE.Color(0xff4444));
  }

  private calculateBuildingHeight(linesOfCode: number): number {
    const scaled = linesOfCode * SCENE_CONFIG.BUILDING_HEIGHT_SCALE;
    return Math.max(
      SCENE_CONFIG.BUILDING_MIN_HEIGHT,
      Math.min(SCENE_CONFIG.BUILDING_MAX_HEIGHT, scaled)
    );
  }

  private animateScale(mesh: THREE.Mesh, targetScale: number, duration: number, onComplete?: () => void): void {
    const startScale = mesh.scale.y;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
      
      mesh.scale.y = startScale + (targetScale - startScale) * eased;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else if (onComplete) {
        onComplete();
      }
    };
    
    animate();
  }

  private animateHeight(building: Building, targetHeight: number, duration: number): void {
    const startHeight = building.height;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const newHeight = startHeight + (targetHeight - startHeight) * eased;
      building.height = newHeight;
      
      // Update geometry
      building.mesh.geometry.dispose();
      building.mesh.geometry = new THREE.BoxGeometry(
        SCENE_CONFIG.BUILDING_BASE_SIZE,
        newHeight,
        SCENE_CONFIG.BUILDING_BASE_SIZE
      );
      building.mesh.position.y = newHeight / 2;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        building.status = 'stable';
      }
    };
    
    animate();
  }

  private spawnParticleBurst(position: THREE.Vector3, color: THREE.Color): void {
    const particleCount = 30;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y + 1;
      positions[i * 3 + 2] = position.z;
      
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 3,
        (Math.random() - 0.5) * 2
      ));
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      size: 0.15,
      color: color,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);
    
    // Animate particles
    const startTime = Date.now();
    const duration = 1000;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        this.scene.remove(particles);
        geometry.dispose();
        material.dispose();
        return;
      }
      
      const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      
      for (let i = 0; i < particleCount; i++) {
        positionAttr.array[i * 3] += velocities[i].x * 0.05;
        positionAttr.array[i * 3 + 1] += velocities[i].y * 0.05 - 0.02; // Gravity
        positionAttr.array[i * 3 + 2] += velocities[i].z * 0.05;
        
        velocities[i].y -= 0.05; // Deceleration
      }
      
      positionAttr.needsUpdate = true;
      material.opacity = 1 - progress;
      
      requestAnimationFrame(animate);
    };
    
    animate();
  }

  private createTextSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;
    
    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.font = 'Bold 24px Arial';
    context.fillStyle = 'rgba(150, 150, 180, 0.8)';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4, 1, 1);
    
    return sprite;
  }

  private getShortDirName(directory: string): string {
    const parts = directory.split('/').filter(Boolean);
    if (parts.length === 0) return 'root';
    return parts[parts.length - 1] || 'root';
  }

  public getBuildingByPath(path: string): Building | undefined {
    return this.buildings.get(path);
  }

  public getAllBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }

  public update(_delta: number): void {
    // Animate ambient particles
    if (this.particles && this.particlePositions) {
      const positions = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
      
      for (let i = 0; i < positions.count; i++) {
        positions.array[i * 3 + 1] += Math.sin(Date.now() * 0.001 + i) * 0.01;
      }
      
      positions.needsUpdate = true;
    }
    
    // Subtle building "breathing" animation
    this.buildings.forEach(building => {
      if (building.status === 'stable') {
        const breathe = Math.sin(Date.now() * 0.002 + building.position.x) * 0.01;
        building.mesh.scale.y = 1 + breathe;
      }
    });
  }

  public clear(): void {
    // Remove all buildings
    this.buildings.forEach(building => {
      this.scene.remove(building.mesh);
      building.mesh.geometry.dispose();
      (building.mesh.material as THREE.Material).dispose();
    });
    this.buildings.clear();
    
    // Remove all districts
    this.districts.forEach(district => {
      if (district.ground) {
        this.scene.remove(district.ground);
        district.ground.geometry.dispose();
        (district.ground.material as THREE.Material).dispose();
      }
      if (district.label) {
        this.scene.remove(district.label);
        (district.label.material as THREE.SpriteMaterial).dispose();
      }
    });
    this.districts.clear();
  }

  public dispose(): void {
    this.clear();
    
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      (this.particles.material as THREE.Material).dispose();
    }
  }
}
