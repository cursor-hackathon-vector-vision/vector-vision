import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Post-processing effects manager for enhanced visuals
 */
export class EffectsManager {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private enabled: boolean = true;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) {
    // Create composer
    this.composer = new EffectComposer(renderer);
    
    // Render pass
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);
    
    // Bloom pass for glow effects
    const bloomParams = {
      threshold: 0.6,
      strength: 0.4,
      radius: 0.5
    };
    
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloomParams.strength,
      bloomParams.radius,
      bloomParams.threshold
    );
    this.composer.addPass(this.bloomPass);
    
    // Output pass for correct color space
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  public render(): void {
    if (this.enabled) {
      this.composer.render();
    }
  }

  public setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  public setBloomStrength(strength: number): void {
    this.bloomPass.strength = strength;
  }

  public setBloomThreshold(threshold: number): void {
    this.bloomPass.threshold = threshold;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public dispose(): void {
    this.composer.dispose();
  }
}

/**
 * Animated glow ring effect for highlighting
 */
export class GlowRing {
  public mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private startTime: number;
  private duration: number;
  private maxScale: number;

  constructor(
    position: THREE.Vector3,
    color: THREE.Color = new THREE.Color(0x667eea),
    duration: number = 1000,
    maxScale: number = 5
  ) {
    this.startTime = Date.now();
    this.duration = duration;
    this.maxScale = maxScale;

    const geometry = new THREE.RingGeometry(0.5, 0.7, 32);
    this.material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.copy(position);
    this.mesh.position.y = 0.1;
    this.mesh.rotation.x = -Math.PI / 2;
  }

  public update(): boolean {
    const elapsed = Date.now() - this.startTime;
    const progress = elapsed / this.duration;

    if (progress >= 1) {
      return false; // Animation complete
    }

    const scale = 1 + (this.maxScale - 1) * this.easeOut(progress);
    this.mesh.scale.set(scale, scale, 1);
    this.material.opacity = 1 - this.easeIn(progress);

    return true; // Animation ongoing
  }

  private easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private easeIn(t: number): number {
    return t * t;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * Rising particles effect for file creation
 */
export class RisingParticles {
  public points: THREE.Points;
  private positions: Float32Array;
  private velocities: THREE.Vector3[];
  private startTime: number;
  private duration: number;
  private particleCount: number;

  constructor(
    position: THREE.Vector3,
    color: THREE.Color = new THREE.Color(0x667eea),
    particleCount: number = 50,
    duration: number = 2000
  ) {
    this.startTime = Date.now();
    this.duration = duration;
    this.particleCount = particleCount;
    this.velocities = [];

    // Create particles
    this.positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      // Start position with some spread
      this.positions[i * 3] = position.x + (Math.random() - 0.5) * 2;
      this.positions[i * 3 + 1] = position.y;
      this.positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 2;

      // Velocity - mostly upward with some spread
      this.velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        2 + Math.random() * 2,
        (Math.random() - 0.5) * 0.5
      ));
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const material = new THREE.PointsMaterial({
      color,
      size: 0.2,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(geometry, material);
  }

  public update(): boolean {
    const elapsed = Date.now() - this.startTime;
    const progress = elapsed / this.duration;

    if (progress >= 1) {
      return false;
    }

    const positionAttr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const dt = 0.016; // ~60fps

    for (let i = 0; i < this.particleCount; i++) {
      // Update position
      positionAttr.array[i * 3] += this.velocities[i].x * dt;
      positionAttr.array[i * 3 + 1] += this.velocities[i].y * dt;
      positionAttr.array[i * 3 + 2] += this.velocities[i].z * dt;

      // Apply gravity and drag
      this.velocities[i].y -= 2 * dt;
      this.velocities[i].multiplyScalar(0.99);
    }

    positionAttr.needsUpdate = true;

    // Fade out
    const material = this.points.material as THREE.PointsMaterial;
    material.opacity = 1 - this.easeIn(progress);

    return true;
  }

  private easeIn(t: number): number {
    return t * t;
  }

  public dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

/**
 * Pulsing highlight effect for modified files
 */
export class PulseHighlight {
  private mesh: THREE.Mesh;
  private originalEmissive: THREE.Color;
  private highlightColor: THREE.Color;
  private startTime: number;
  private duration: number;
  private pulseCount: number;

  constructor(
    mesh: THREE.Mesh,
    highlightColor: THREE.Color = new THREE.Color(0xffff00),
    duration: number = 1500,
    pulseCount: number = 3
  ) {
    this.mesh = mesh;
    this.highlightColor = highlightColor;
    this.startTime = Date.now();
    this.duration = duration;
    this.pulseCount = pulseCount;

    const material = mesh.material as THREE.MeshStandardMaterial;
    this.originalEmissive = material.emissive.clone();
  }

  public update(): boolean {
    const elapsed = Date.now() - this.startTime;
    const progress = elapsed / this.duration;

    if (progress >= 1) {
      // Reset to original
      const material = this.mesh.material as THREE.MeshStandardMaterial;
      material.emissive.copy(this.originalEmissive);
      material.emissiveIntensity = 0;
      return false;
    }

    // Pulsing effect
    const pulseProgress = (progress * this.pulseCount) % 1;
    const intensity = Math.sin(pulseProgress * Math.PI) * 0.5;

    const material = this.mesh.material as THREE.MeshStandardMaterial;
    material.emissive.copy(this.highlightColor);
    material.emissiveIntensity = intensity * (1 - progress); // Fade out over time

    return true;
  }
}

/**
 * Connection line with animated flow
 */
export class FlowLine {
  public line: THREE.Line;
  private dashOffset: number = 0;

  constructor(
    start: THREE.Vector3,
    end: THREE.Vector3,
    color: THREE.Color = new THREE.Color(0x667eea)
  ) {
    // Create curved line
    const mid = new THREE.Vector3(
      (start.x + end.x) / 2,
      Math.max(start.y, end.y) + 5,
      (start.z + end.z) / 2
    );

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(50);

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineDashedMaterial({
      color,
      dashSize: 0.5,
      gapSize: 0.3,
      transparent: true,
      opacity: 0.8
    });

    this.line = new THREE.Line(geometry, material);
    this.line.computeLineDistances();
  }

  public update(): void {
    // Animate dash offset for flow effect
    this.dashOffset += 0.02;
    const material = this.line.material as THREE.LineDashedMaterial;
    material.dashSize = 0.5;
    material.gapSize = 0.3;
    
    // Recreate line distances to animate
    this.line.computeLineDistances();
  }

  public dispose(): void {
    this.line.geometry.dispose();
    (this.line.material as THREE.Material).dispose();
  }
}

/**
 * Ambient floating particles in the background
 */
export class AmbientParticles {
  public points: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private bounds: THREE.Box3;

  constructor(
    count: number = 500,
    bounds: THREE.Box3 = new THREE.Box3(
      new THREE.Vector3(-50, 0, -50),
      new THREE.Vector3(50, 30, 50)
    )
  ) {
    this.bounds = bounds;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);

    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Random position within bounds
      this.positions[i * 3] = bounds.min.x + Math.random() * (bounds.max.x - bounds.min.x);
      this.positions[i * 3 + 1] = bounds.min.y + Math.random() * (bounds.max.y - bounds.min.y);
      this.positions[i * 3 + 2] = bounds.min.z + Math.random() * (bounds.max.z - bounds.min.z);

      // Slow random velocity
      this.velocities[i * 3] = (Math.random() - 0.5) * 0.2;
      this.velocities[i * 3 + 1] = Math.random() * 0.1;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;

      // Purple-ish colors
      colors[i * 3] = 0.4 + Math.random() * 0.2;     // R
      colors[i * 3 + 1] = 0.3 + Math.random() * 0.3; // G
      colors[i * 3 + 2] = 0.7 + Math.random() * 0.3; // B
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(geometry, material);
  }

  public update(): void {
    const positions = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i < positions.count; i++) {
      // Update position
      positions.array[i * 3] += this.velocities[i * 3] * 0.1;
      positions.array[i * 3 + 1] += this.velocities[i * 3 + 1] * 0.1;
      positions.array[i * 3 + 2] += this.velocities[i * 3 + 2] * 0.1;

      // Wrap around bounds
      if (positions.array[i * 3] < this.bounds.min.x) positions.array[i * 3] = this.bounds.max.x;
      if (positions.array[i * 3] > this.bounds.max.x) positions.array[i * 3] = this.bounds.min.x;
      if (positions.array[i * 3 + 1] < this.bounds.min.y) positions.array[i * 3 + 1] = this.bounds.max.y;
      if (positions.array[i * 3 + 1] > this.bounds.max.y) positions.array[i * 3 + 1] = this.bounds.min.y;
      if (positions.array[i * 3 + 2] < this.bounds.min.z) positions.array[i * 3 + 2] = this.bounds.max.z;
      if (positions.array[i * 3 + 2] > this.bounds.max.z) positions.array[i * 3 + 2] = this.bounds.min.z;

      // Add some sine wave movement
      positions.array[i * 3 + 1] += Math.sin(Date.now() * 0.001 + i * 0.1) * 0.01;
    }

    positions.needsUpdate = true;
  }

  public dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
