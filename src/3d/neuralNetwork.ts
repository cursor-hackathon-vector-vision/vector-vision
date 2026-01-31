import * as THREE from 'three';
import type { ProjectSnapshot, FileNode, ChatMessage } from '../types';

/**
 * NEURAL NETWORK VISUALIZATION
 * 
 * Metaphor: Project as a Living Brain
 * - Neurons = Files (pulsing nodes)
 * - Synapses = Import connections (glowing lines)
 * - Clusters = Directories (organic groups)
 * - Impulses = AI chats traveling through network
 * - Memory waves = Commits spreading outward
 */

interface Neuron {
  id: string;
  fileNode: FileNode;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  targetPosition: THREE.Vector3;
  velocity: THREE.Vector3;
  pulsePhase: number;
  pulseSpeed: number;
  connections: string[];
  cluster: string;
  isActive: boolean;
  activity: number; // 0-1, affects glow
}

interface Synapse {
  from: string;
  to: string;
  line: THREE.Line;
  pulsePosition: number;
  active: boolean;
}

interface ThoughtImpulse {
  chat: ChatMessage;
  position: THREE.Vector3;
  targetNeuron: string | null;
  mesh: THREE.Mesh;
  trail: THREE.Points;
  age: number;
  maxAge: number;
}

interface ClusterInfo {
  name: string;
  center: THREE.Vector3;
  neurons: string[];
  color: THREE.Color;
}

// File type to color mapping for neurons
const NEURON_COLORS: Record<string, number> = {
  '.ts': 0x3178c6,    // TypeScript blue
  '.tsx': 0x61dafb,   // React cyan
  '.js': 0xf7df1e,    // JavaScript yellow
  '.jsx': 0x61dafb,   // React cyan
  '.css': 0x264de4,   // CSS blue
  '.scss': 0xcc6699,  // SCSS pink
  '.html': 0xe34c26,  // HTML orange
  '.json': 0xcbcb41,  // JSON gold
  '.md': 0x083fa1,    // Markdown blue
  '.py': 0x3776ab,    // Python blue
  '.rs': 0xdea584,    // Rust orange
  '.go': 0x00add8,    // Go cyan
  'default': 0x888888,
};

export class NeuralNetworkVisualization {
  private scene: THREE.Scene;
  private neurons: Map<string, Neuron> = new Map();
  private synapses: Synapse[] = [];
  private clusters: Map<string, ClusterInfo> = new Map();
  private impulses: ThoughtImpulse[] = [];
  
  // Group containers
  private neuronGroup: THREE.Group;
  private synapseGroup: THREE.Group;
  private impulseGroup: THREE.Group;
  private clusterGroup: THREE.Group;
  
  // Materials
  private neuronMaterial: THREE.ShaderMaterial;
  private synapseMaterial: THREE.ShaderMaterial;
  
  // Animation
  private time: number = 0;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    
    // Create groups
    this.neuronGroup = new THREE.Group();
    this.neuronGroup.name = 'neurons';
    this.synapseGroup = new THREE.Group();
    this.synapseGroup.name = 'synapses';
    this.impulseGroup = new THREE.Group();
    this.impulseGroup.name = 'impulses';
    this.clusterGroup = new THREE.Group();
    this.clusterGroup.name = 'clusters';
    
    scene.add(this.clusterGroup);
    scene.add(this.synapseGroup);
    scene.add(this.neuronGroup);
    scene.add(this.impulseGroup);
    
    // Create materials
    this.neuronMaterial = this.createNeuronMaterial();
    this.synapseMaterial = this.createSynapseMaterial();
  }
  
  private createNeuronMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        baseColor: { value: new THREE.Color(0x3178c6) },
        pulseColor: { value: new THREE.Color(0x88ccff) },
        activity: { value: 0.5 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 baseColor;
        uniform vec3 pulseColor;
        uniform float activity;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          // Fresnel effect for glow
          vec3 viewDir = normalize(cameraPosition - vPosition);
          float fresnel = pow(1.0 - dot(vNormal, viewDir), 2.0);
          
          // Pulsing based on activity
          float pulse = sin(time * 2.0 + activity * 10.0) * 0.5 + 0.5;
          pulse = pulse * activity;
          
          // Mix colors
          vec3 color = mix(baseColor, pulseColor, pulse * 0.5 + fresnel * 0.3);
          
          // Add glow at edges
          float glow = fresnel * (0.5 + activity * 0.5);
          color += pulseColor * glow;
          
          gl_FragColor = vec4(color, 0.9);
        }
      `,
      transparent: true,
      side: THREE.FrontSide,
    });
  }
  
  private createSynapseMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x4488ff) },
        opacity: { value: 0.3 },
      },
      vertexShader: `
        attribute float lineDistance;
        varying float vLineDistance;
        
        void main() {
          vLineDistance = lineDistance;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float opacity;
        
        varying float vLineDistance;
        
        void main() {
          // Animated dash pattern
          float dash = sin(vLineDistance * 10.0 - time * 3.0) * 0.5 + 0.5;
          float alpha = opacity * (0.3 + dash * 0.7);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
  }
  
  /**
   * Update visualization for a new snapshot
   */
  public updateFromSnapshot(snapshot: ProjectSnapshot): void {
    // Clear old neurons that don't exist anymore
    const currentPaths = new Set(snapshot.files.map(f => f.path));
    
    for (const [path, neuron] of this.neurons) {
      if (!currentPaths.has(path)) {
        this.removeNeuron(neuron);
        this.neurons.delete(path);
      }
    }
    
    // Update or create neurons
    for (const file of snapshot.files) {
      if (this.neurons.has(file.path)) {
        this.updateNeuron(file);
      } else {
        this.createNeuron(file);
      }
    }
    
    // Update cluster positions
    this.updateClusters();
    
    // Apply force-directed layout
    this.calculateLayout();
    
    // Update synapses (connections)
    this.updateSynapses();
    
    // Create impulses for new chats
    for (const chat of snapshot.chats) {
      this.createImpulse(chat);
    }
  }
  
  private createNeuron(file: FileNode): void {
    const color = NEURON_COLORS[file.extension] || NEURON_COLORS['default'];
    
    // Size based on lines of code
    const baseSize = 0.5;
    const locScale = Math.log10(file.linesOfCode + 10) / 3;
    const size = baseSize + locScale;
    
    // Create mesh
    const geometry = new THREE.IcosahedronGeometry(size, 2);
    const material = this.neuronMaterial.clone();
    material.uniforms.baseColor.value = new THREE.Color(color);
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = {
      isNeuron: true,
      filePath: file.path,
      fileName: file.name,
    };
    
    // Initial position in cluster area
    const clusterName = file.directory || '/';
    const clusterInfo = this.getOrCreateCluster(clusterName);
    
    const initialPos = clusterInfo.center.clone().add(
      new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      )
    );
    
    mesh.position.copy(initialPos);
    
    const neuron: Neuron = {
      id: file.path,
      fileNode: file,
      mesh,
      position: initialPos.clone(),
      targetPosition: initialPos.clone(),
      velocity: new THREE.Vector3(),
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.5 + Math.random() * 0.5,
      connections: [],
      cluster: clusterName,
      isActive: file.status !== 'unchanged',
      activity: file.status === 'added' ? 1 : file.status === 'modified' ? 0.7 : 0.3,
    };
    
    // Set activity uniform
    (mesh.material as THREE.ShaderMaterial).uniforms.activity.value = neuron.activity;
    
    this.neurons.set(file.path, neuron);
    this.neuronGroup.add(mesh);
    
    // Add to cluster
    clusterInfo.neurons.push(file.path);
    
    // Spawn effect for new files
    if (file.status === 'added') {
      this.spawnNeuronEffect(mesh.position, color);
    }
  }
  
  private updateNeuron(file: FileNode): void {
    const neuron = this.neurons.get(file.path);
    if (!neuron) return;
    
    neuron.fileNode = file;
    neuron.isActive = file.status !== 'unchanged';
    neuron.activity = file.status === 'added' ? 1 : file.status === 'modified' ? 0.7 : 0.3;
    
    // Update material
    const material = neuron.mesh.material as THREE.ShaderMaterial;
    material.uniforms.activity.value = neuron.activity;
    
    // Flash effect for modified files
    if (file.status === 'modified') {
      this.flashNeuron(neuron);
    }
  }
  
  private removeNeuron(neuron: Neuron): void {
    this.neuronGroup.remove(neuron.mesh);
    neuron.mesh.geometry.dispose();
    (neuron.mesh.material as THREE.Material).dispose();
  }
  
  private getOrCreateCluster(name: string): ClusterInfo {
    if (!this.clusters.has(name)) {
      // Calculate cluster position based on name hash
      const hash = this.hashString(name);
      const angle = (hash % 360) * Math.PI / 180;
      const radius = 30 + (hash % 20);
      const height = (hash % 40) - 20;
      
      const center = new THREE.Vector3(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      );
      
      // Color based on directory depth
      const depth = (name.match(/\//g) || []).length;
      const hue = (depth * 0.15 + hash / 1000) % 1;
      
      const cluster: ClusterInfo = {
        name,
        center,
        neurons: [],
        color: new THREE.Color().setHSL(hue, 0.6, 0.5),
      };
      
      this.clusters.set(name, cluster);
      
      // Create cluster visual (soft cloud)
      this.createClusterVisual(cluster);
    }
    
    return this.clusters.get(name)!;
  }
  
  private createClusterVisual(cluster: ClusterInfo): void {
    // Create a soft glowing sphere for the cluster
    const geometry = new THREE.SphereGeometry(15, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: cluster.color,
      transparent: true,
      opacity: 0.05,
      side: THREE.BackSide,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(cluster.center);
    this.clusterGroup.add(mesh);
  }
  
  private updateClusters(): void {
    // Update cluster centers based on contained neurons
    for (const [_name, cluster] of this.clusters) {
      if (cluster.neurons.length === 0) continue;
      
      const center = new THREE.Vector3();
      let count = 0;
      
      for (const neuronId of cluster.neurons) {
        const neuron = this.neurons.get(neuronId);
        if (neuron) {
          center.add(neuron.position);
          count++;
        }
      }
      
      if (count > 0) {
        center.divideScalar(count);
        cluster.center.lerp(center, 0.1);
      }
    }
  }
  
  private calculateLayout(): void {
    const neurons = Array.from(this.neurons.values());
    if (neurons.length === 0) return;
    
    // Force-directed layout
    const repulsionForce = 5;
    const attractionForce = 0.01;
    const clusterForce = 0.05;
    const damping = 0.9;
    
    for (const neuron of neurons) {
      const force = new THREE.Vector3();
      
      // Repulsion from other neurons
      for (const other of neurons) {
        if (other.id === neuron.id) continue;
        
        const diff = neuron.position.clone().sub(other.position);
        const dist = diff.length();
        
        if (dist < 0.1) continue;
        if (dist < 20) {
          diff.normalize().multiplyScalar(repulsionForce / (dist * dist));
          force.add(diff);
        }
      }
      
      // Attraction to cluster center
      const cluster = this.clusters.get(neuron.cluster);
      if (cluster) {
        const toCluster = cluster.center.clone().sub(neuron.position);
        toCluster.multiplyScalar(clusterForce);
        force.add(toCluster);
      }
      
      // Attraction to connected neurons
      for (const connId of neuron.connections) {
        const connected = this.neurons.get(connId);
        if (connected) {
          const toConnected = connected.position.clone().sub(neuron.position);
          toConnected.multiplyScalar(attractionForce);
          force.add(toConnected);
        }
      }
      
      // Apply force
      neuron.velocity.add(force);
      neuron.velocity.multiplyScalar(damping);
      neuron.targetPosition.add(neuron.velocity);
    }
  }
  
  private updateSynapses(): void {
    // Clear old synapses
    for (const synapse of this.synapses) {
      this.synapseGroup.remove(synapse.line);
      synapse.line.geometry.dispose();
    }
    this.synapses = [];
    
    // Create synapses based on directory proximity
    // (In a real implementation, we'd parse imports)
    const neurons = Array.from(this.neurons.values());
    
    for (const neuron of neurons) {
      // Connect to neurons in same directory
      const sameDir = neurons.filter(n => 
        n.id !== neuron.id && 
        n.cluster === neuron.cluster
      );
      
      for (const other of sameDir.slice(0, 3)) {
        this.createSynapse(neuron.id, other.id);
        neuron.connections.push(other.id);
      }
    }
  }
  
  private createSynapse(fromId: string, toId: string): void {
    const fromNeuron = this.neurons.get(fromId);
    const toNeuron = this.neurons.get(toId);
    
    if (!fromNeuron || !toNeuron) return;
    
    // Create curved line
    const points = this.createCurvedPath(fromNeuron.position, toNeuron.position);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Add line distances for animated shader
    const distances: number[] = [];
    let totalDist = 0;
    for (let i = 0; i < points.length; i++) {
      if (i > 0) {
        totalDist += points[i].distanceTo(points[i - 1]);
      }
      distances.push(totalDist);
    }
    geometry.setAttribute('lineDistance', new THREE.Float32BufferAttribute(distances, 1));
    
    const material = this.synapseMaterial.clone();
    const line = new THREE.Line(geometry, material);
    
    this.synapses.push({
      from: fromId,
      to: toId,
      line,
      pulsePosition: 0,
      active: false,
    });
    
    this.synapseGroup.add(line);
  }
  
  private createCurvedPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    const midPoint = from.clone().add(to).multiplyScalar(0.5);
    
    // Add curve offset perpendicular to the line
    const dir = to.clone().sub(from).normalize();
    const perpendicular = new THREE.Vector3(-dir.z, 0, dir.x);
    const curveAmount = from.distanceTo(to) * 0.2;
    midPoint.add(perpendicular.multiplyScalar(curveAmount));
    midPoint.y += curveAmount * 0.5;
    
    const curve = new THREE.QuadraticBezierCurve3(from, midPoint, to);
    return curve.getPoints(20);
  }
  
  private createImpulse(chat: ChatMessage): void {
    // Find target neuron from related files
    let targetNeuron: string | null = null;
    if (chat.relatedFiles.length > 0) {
      const targetPath = chat.relatedFiles[0];
      if (this.neurons.has(targetPath)) {
        targetNeuron = targetPath;
      }
    }
    
    // Random start position if no target
    const startPos = targetNeuron 
      ? this.neurons.get(targetNeuron)!.position.clone().add(new THREE.Vector3(0, 10, 0))
      : new THREE.Vector3(
          (Math.random() - 0.5) * 50,
          20 + Math.random() * 10,
          (Math.random() - 0.5) * 50
        );
    
    // Create impulse mesh
    const color = chat.role === 'user' ? 0x667eea : 0x48bb78;
    const geometry = new THREE.SphereGeometry(0.5, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(startPos);
    
    // Create trail
    const trailGeometry = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(30 * 3);
    for (let i = 0; i < 30; i++) {
      trailPositions[i * 3] = startPos.x;
      trailPositions[i * 3 + 1] = startPos.y;
      trailPositions[i * 3 + 2] = startPos.z;
    }
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    
    const trailMaterial = new THREE.PointsMaterial({
      color,
      size: 0.2,
      transparent: true,
      opacity: 0.5,
    });
    const trail = new THREE.Points(trailGeometry, trailMaterial);
    
    const impulse: ThoughtImpulse = {
      chat,
      position: startPos,
      targetNeuron,
      mesh,
      trail,
      age: 0,
      maxAge: 5000,
    };
    
    this.impulses.push(impulse);
    this.impulseGroup.add(mesh);
    this.impulseGroup.add(trail);
  }
  
  private spawnNeuronEffect(position: THREE.Vector3, color: number): void {
    // Particle burst effect
    const particleCount = 30;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 2,
        (Math.random() - 0.5) * 2
      ));
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color,
      size: 0.3,
      transparent: true,
      opacity: 1,
    });
    
    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);
    
    // Animate and remove
    let life = 0;
    const animate = () => {
      life += 16;
      if (life > 1000) {
        this.scene.remove(particles);
        geometry.dispose();
        material.dispose();
        return;
      }
      
      const posArray = geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        posArray[i * 3] += velocities[i].x * 0.1;
        posArray[i * 3 + 1] += velocities[i].y * 0.1;
        posArray[i * 3 + 2] += velocities[i].z * 0.1;
        velocities[i].y -= 0.01; // gravity
      }
      geometry.attributes.position.needsUpdate = true;
      material.opacity = 1 - life / 1000;
      
      requestAnimationFrame(animate);
    };
    animate();
  }
  
  private flashNeuron(neuron: Neuron): void {
    const material = neuron.mesh.material as THREE.ShaderMaterial;
    const originalActivity = neuron.activity;
    
    // Flash to full brightness
    material.uniforms.activity.value = 1;
    
    setTimeout(() => {
      material.uniforms.activity.value = originalActivity;
    }, 500);
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  /**
   * Update animation
   */
  public update(delta: number): void {
    this.time += delta;
    
    // Update neuron materials
    for (const neuron of this.neurons.values()) {
      const material = neuron.mesh.material as THREE.ShaderMaterial;
      material.uniforms.time.value = this.time;
      
      // Smooth position interpolation
      neuron.position.lerp(neuron.targetPosition, 0.02);
      neuron.mesh.position.copy(neuron.position);
      
      // Gentle floating motion
      neuron.mesh.position.y += Math.sin(this.time * neuron.pulseSpeed + neuron.pulsePhase) * 0.02;
      
      // Slow rotation
      neuron.mesh.rotation.y += delta * 0.1;
    }
    
    // Update synapse materials
    for (const synapse of this.synapses) {
      const material = synapse.line.material as THREE.ShaderMaterial;
      material.uniforms.time.value = this.time;
      
      // Update line positions if neurons moved
      const from = this.neurons.get(synapse.from);
      const to = this.neurons.get(synapse.to);
      if (from && to) {
        const points = this.createCurvedPath(from.position, to.position);
        synapse.line.geometry.setFromPoints(points);
      }
    }
    
    // Update impulses
    for (let i = this.impulses.length - 1; i >= 0; i--) {
      const impulse = this.impulses[i];
      impulse.age += delta * 1000;
      
      if (impulse.age > impulse.maxAge) {
        // Remove impulse
        this.impulseGroup.remove(impulse.mesh);
        this.impulseGroup.remove(impulse.trail);
        impulse.mesh.geometry.dispose();
        (impulse.mesh.material as THREE.Material).dispose();
        this.impulses.splice(i, 1);
        continue;
      }
      
      // Move towards target or drift
      if (impulse.targetNeuron) {
        const target = this.neurons.get(impulse.targetNeuron);
        if (target) {
          impulse.position.lerp(target.position, 0.02);
        }
      } else {
        // Drift downward
        impulse.position.y -= delta * 2;
      }
      
      impulse.mesh.position.copy(impulse.position);
      
      // Update trail
      const trailPos = impulse.trail.geometry.attributes.position.array as Float32Array;
      // Shift positions
      for (let j = trailPos.length - 3; j >= 3; j -= 3) {
        trailPos[j] = trailPos[j - 3];
        trailPos[j + 1] = trailPos[j - 2];
        trailPos[j + 2] = trailPos[j - 1];
      }
      // Set new position
      trailPos[0] = impulse.position.x;
      trailPos[1] = impulse.position.y;
      trailPos[2] = impulse.position.z;
      impulse.trail.geometry.attributes.position.needsUpdate = true;
      
      // Fade out
      (impulse.mesh.material as THREE.MeshBasicMaterial).opacity = 
        1 - (impulse.age / impulse.maxAge);
    }
  }
  
  /**
   * Get neuron at position (for raycasting)
   */
  public getNeuronAt(raycaster: THREE.Raycaster): Neuron | null {
    const intersects = raycaster.intersectObjects(this.neuronGroup.children);
    
    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      const path = mesh.userData.filePath;
      return this.neurons.get(path) || null;
    }
    
    return null;
  }
  
  /**
   * Highlight a specific neuron
   */
  public highlightNeuron(path: string): void {
    const neuron = this.neurons.get(path);
    if (neuron) {
      this.flashNeuron(neuron);
    }
  }
  
  /**
   * Get all neurons
   */
  public getAllNeurons(): Neuron[] {
    return Array.from(this.neurons.values());
  }
  
  /**
   * Dispose of resources
   */
  public dispose(): void {
    for (const neuron of this.neurons.values()) {
      neuron.mesh.geometry.dispose();
      (neuron.mesh.material as THREE.Material).dispose();
    }
    
    for (const synapse of this.synapses) {
      synapse.line.geometry.dispose();
      (synapse.line.material as THREE.Material).dispose();
    }
    
    this.neurons.clear();
    this.synapses = [];
    this.clusters.clear();
    this.impulses = [];
    
    this.scene.remove(this.neuronGroup);
    this.scene.remove(this.synapseGroup);
    this.scene.remove(this.impulseGroup);
    this.scene.remove(this.clusterGroup);
  }
}
