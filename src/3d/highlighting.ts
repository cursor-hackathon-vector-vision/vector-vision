import * as THREE from 'three';

/**
 * HIGHLIGHTING SYSTEM
 * 
 * Creates visual connections between messages and affected files:
 * - Beam effects from highway to buildings
 * - Building glow when affected
 * - Particle trails along connections
 */

export interface HighlightBeam {
  id: string;
  sourcePosition: THREE.Vector3;   // Message position on highway
  targetPosition: THREE.Vector3;   // Building position
  type: 'created' | 'modified' | 'referenced';
  mesh: THREE.Group;
  line: THREE.Line;
  particles: THREE.Points;
  pulsePhase: number;
  intensity: number;
  startTime: number;
  duration: number;  // How long the highlight lasts (ms)
}

// Colors for different highlight types
const HIGHLIGHT_COLORS = {
  created: 0x48bb78,   // Green - new file
  modified: 0xf6e05e,  // Yellow - changed
  referenced: 0x63b3ed, // Blue - read/referenced
};

export class HighlightManager {
  private scene: THREE.Scene;
  private highlightGroup: THREE.Group;
  private beams: Map<string, HighlightBeam> = new Map();
  private time: number = 0;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    
    this.highlightGroup = new THREE.Group();
    this.highlightGroup.name = 'highlights';
    scene.add(this.highlightGroup);
  }
  
  /**
   * Create a highlight beam from source to target
   */
  public createBeam(
    id: string,
    source: THREE.Vector3,
    target: THREE.Vector3,
    type: 'created' | 'modified' | 'referenced' = 'modified',
    duration: number = 3000
  ): HighlightBeam {
    const color = HIGHLIGHT_COLORS[type];
    const group = new THREE.Group();
    
    // Create curved path from source to target
    const midPoint = new THREE.Vector3(
      (source.x + target.x) / 2,
      Math.max(source.y, target.y) + 5 + Math.abs(target.z - source.z) * 0.2,
      (source.z + target.z) / 2
    );
    
    const curve = new THREE.QuadraticBezierCurve3(source, midPoint, target);
    const points = curve.getPoints(30);
    
    // Main beam line
    const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      linewidth: 2,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    group.add(line);
    
    // Glow tube around the line
    const tubeGeom = new THREE.TubeGeometry(curve, 30, 0.15, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
    });
    const tube = new THREE.Mesh(tubeGeom, tubeMat);
    group.add(tube);
    
    // Particles along the beam
    const particleCount = 20;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      const point = curve.getPoint(t);
      particlePositions[i * 3] = point.x;
      particlePositions[i * 3 + 1] = point.y;
      particlePositions[i * 3 + 2] = point.z;
      particleSizes[i] = 0.1 + Math.random() * 0.1;
    }
    
    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeom.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    const particleMat = new THREE.PointsMaterial({
      color,
      size: 0.3,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(particleGeom, particleMat);
    group.add(particles);
    
    // Target indicator (ring at building)
    const ringGeom = new THREE.RingGeometry(0.8, 1.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(target);
    ring.position.y = 0.1;
    group.add(ring);
    
    // Source indicator
    const sourceRingGeom = new THREE.RingGeometry(0.3, 0.5, 16);
    const sourceRing = new THREE.Mesh(sourceRingGeom, ringMat.clone());
    sourceRing.rotation.x = -Math.PI / 2;
    sourceRing.position.copy(source);
    sourceRing.position.y = 0.1;
    group.add(sourceRing);
    
    this.highlightGroup.add(group);
    
    const beam: HighlightBeam = {
      id,
      sourcePosition: source.clone(),
      targetPosition: target.clone(),
      type,
      mesh: group,
      line,
      particles,
      pulsePhase: Math.random() * Math.PI * 2,
      intensity: 1,
      startTime: Date.now(),
      duration,
    };
    
    this.beams.set(id, beam);
    return beam;
  }
  
  /**
   * Create highlight from message to multiple buildings
   */
  public highlightFiles(
    messageId: string,
    messagePosition: THREE.Vector3,
    buildings: { id: string; position: THREE.Vector3; type: 'created' | 'modified' | 'referenced' }[],
    duration: number = 3000
  ): void {
    for (let i = 0; i < buildings.length; i++) {
      const building = buildings[i];
      const beamId = `${messageId}-${building.id}`;
      
      // Slightly offset each beam to prevent overlap
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        0,
        (Math.random() - 0.5) * 0.5
      );
      
      this.createBeam(
        beamId,
        messagePosition.clone().add(offset),
        building.position,
        building.type,
        duration + i * 200  // Stagger slightly
      );
    }
  }
  
  /**
   * Update animation
   */
  public update(delta: number): void {
    this.time += delta;
    const now = Date.now();
    
    for (const [id, beam] of this.beams) {
      const elapsed = now - beam.startTime;
      const progress = Math.min(1, elapsed / beam.duration);
      
      // Remove expired beams
      if (elapsed > beam.duration) {
        this.highlightGroup.remove(beam.mesh);
        this.beams.delete(id);
        continue;
      }
      
      // Fade out near end
      const fadeOut = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
      
      // Pulse effect
      const pulse = 0.6 + 0.4 * Math.sin(this.time * 4 + beam.pulsePhase);
      
      // Update line opacity
      const lineMat = beam.line.material as THREE.LineBasicMaterial;
      lineMat.opacity = pulse * fadeOut * beam.intensity;
      
      // Update particle positions (flow along beam)
      const positions = beam.particles.geometry.attributes.position.array as Float32Array;
      const particleCount = positions.length / 3;
      
      for (let i = 0; i < particleCount; i++) {
        // Move particles along the curve
        const baseT = i / particleCount;
        const animatedT = (baseT + this.time * 0.3) % 1;
        
        // Interpolate along beam path
        const point = new THREE.Vector3().lerpVectors(
          beam.sourcePosition,
          beam.targetPosition,
          animatedT
        );
        
        // Add arc height
        const arcHeight = Math.sin(animatedT * Math.PI) * 5;
        point.y += arcHeight;
        
        positions[i * 3] = point.x;
        positions[i * 3 + 1] = point.y;
        positions[i * 3 + 2] = point.z;
      }
      
      beam.particles.geometry.attributes.position.needsUpdate = true;
      
      // Update particle opacity
      const particleMat = beam.particles.material as THREE.PointsMaterial;
      particleMat.opacity = pulse * fadeOut * 0.8;
    }
  }
  
  /**
   * Clear all highlights
   */
  public clear(): void {
    for (const beam of this.beams.values()) {
      this.highlightGroup.remove(beam.mesh);
    }
    this.beams.clear();
  }
  
  /**
   * Get active beam count
   */
  public getActiveCount(): number {
    return this.beams.size;
  }
}

/**
 * Create a building glow effect
 */
export function createBuildingGlow(
  building: THREE.Object3D,
  color: number,
  intensity: number = 1
): THREE.Mesh {
  // Get building bounds
  const box = new THREE.Box3().setFromObject(building);
  const size = new THREE.Vector3();
  box.getSize(size);
  
  // Create glow box slightly larger than building
  const glowGeom = new THREE.BoxGeometry(
    size.x + 0.4,
    size.y + 0.4,
    size.z + 0.4
  );
  const glowMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.3 * intensity,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeom, glowMat);
  
  // Position at building center
  const center = new THREE.Vector3();
  box.getCenter(center);
  glow.position.copy(center);
  
  return glow;
}
