import * as THREE from 'three';

/**
 * CLEAN SIMPLE STREET
 * 
 * Just one main road - no complex network, no chaos
 */

export interface CleanStreet {
  group: THREE.Group;
  update: (time: number) => void;
}

/**
 * Create a clean, simple main street
 */
export function createCleanStreet(length: number = 300): CleanStreet {
  const group = new THREE.Group();
  group.name = 'cleanStreet';
  
  const halfLength = length / 2;
  const roadWidth = 10;
  
  // Road surface - dark with subtle grid
  const roadGeom = new THREE.PlaneGeometry(length, roadWidth);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.9,
    metalness: 0.1,
  });
  const road = new THREE.Mesh(roadGeom, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  group.add(road);
  
  // Center stripe - glowing cyan
  const stripeGeom = new THREE.PlaneGeometry(length, 0.3);
  const stripeMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.8,
  });
  const stripe = new THREE.Mesh(stripeGeom, stripeMat);
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.y = 0.02;
  group.add(stripe);
  
  // Edge lines
  for (const side of [-1, 1]) {
    const edgeGeom = new THREE.PlaneGeometry(length, 0.15);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0x4fc3f7,
      transparent: true,
      opacity: 0.6,
    });
    const edge = new THREE.Mesh(edgeGeom, edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(0, 0.02, side * (roadWidth / 2 - 0.1));
    group.add(edge);
  }
  
  // Simple sidewalks
  for (const side of [-1, 1]) {
    const walkGeom = new THREE.PlaneGeometry(length, 3);
    const walkMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a4e,
      roughness: 0.7,
    });
    const walk = new THREE.Mesh(walkGeom, walkMat);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(0, 0.005, side * (roadWidth / 2 + 1.5));
    walk.userData = { isSidewalk: true, side };
    group.add(walk);
  }
  
  // Start and end markers
  for (const xPos of [-halfLength, halfLength]) {
    const markerGeom = new THREE.BoxGeometry(0.5, 2, roadWidth + 6);
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.5,
    });
    const marker = new THREE.Mesh(markerGeom, markerMat);
    marker.position.set(xPos, 1, 0);
    group.add(marker);
  }
  
  // Simple animated particles along the center
  const particleCount = 50;
  const particleGeom = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * length;
    positions[i * 3 + 1] = 0.2;
    positions[i * 3 + 2] = 0;
  }
  
  particleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const particleMat = new THREE.PointsMaterial({
    color: 0x00ffff,
    size: 0.5,
    transparent: true,
    opacity: 0.8,
  });
  
  const particles = new THREE.Points(particleGeom, particleMat);
  group.add(particles);
  
  // Update function for animation
  const update = (time: number) => {
    // Animate particles
    const pos = particleGeom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < particleCount; i++) {
      pos.array[i * 3] += 0.5; // Move right
      if (pos.array[i * 3] > halfLength) {
        pos.array[i * 3] = -halfLength;
      }
    }
    pos.needsUpdate = true;
    
    // Pulse the center stripe
    stripeMat.opacity = 0.5 + Math.sin(time * 2) * 0.3;
  };
  
  // Store sidewalk info for cats
  group.userData = {
    roadWidth,
    sidewalkZ: [roadWidth / 2 + 1.5, -(roadWidth / 2 + 1.5)],
    length
  };
  
  return { group, update };
}
