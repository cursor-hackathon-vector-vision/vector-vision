import * as THREE from 'three';
import { MessageData, TreeData } from './messageTimeline';

/**
 * TIMELINE 3D RENDERERS
 * 
 * Creates 3D objects for timeline elements:
 * - Message markers (spheres with glow)
 * - Token-cost trees (size = cost)
 * - Parks, fountains, benches
 */

/**
 * Create a message marker
 */
export function createMessageMarker(message: MessageData): THREE.Group {
  const group = new THREE.Group();
  
  // Color based on role
  const colors = {
    user: 0x61dafb,     // Blue
    assistant: 0x9b59b6, // Purple
    system: 0xf39c12,    // Orange
  };
  
  const color = colors[message.role] || colors.user;
  
  // Main sphere
  const geom = new THREE.SphereGeometry(0.8, 16, 16);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.5,
    roughness: 0.3,
    metalness: 0.7,
  });
  
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.z = 1;
  group.add(mesh);
  
  // Glow ring
  const ringGeom = new THREE.RingGeometry(1, 1.3, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.z = 0.01;
  group.add(ring);
  
  // Pulsing light
  const light = new THREE.PointLight(color, 2, 10);
  light.position.z = 1;
  group.add(light);
  
  // Store data
  group.userData.messageData = message;
  group.userData.isMessage = true;
  
  return group;
}

/**
 * Create a token-cost tree
 * Size increases with token cost
 */
export function createTokenTree(treeData: TreeData): THREE.Group {
  const tree = new THREE.Group();
  const size = treeData.size;
  
  // Trunk - darker brown
  const trunkHeight = size * 1.2;
  const trunkRadius = size * 0.15;
  
  const trunkGeom = new THREE.CylinderGeometry(
    trunkRadius * 0.8,
    trunkRadius,
    trunkHeight,
    8
  );
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4a3728,
    roughness: 0.9,
    flatShading: true,
  });
  
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.z = trunkHeight / 2;
  tree.add(trunk);
  
  // Crown - multiple layers, size = token cost
  const crownColors = [0x2d5a27, 0x3d7a37, 0x4d9a47];
  const layers = 3;
  
  for (let i = 0; i < layers; i++) {
    const layerSize = size * (1.5 - i * 0.3);
    const layerHeight = size * 1.2;
    const layerZ = trunkHeight + i * (size * 0.7);
    
    const crownGeom = new THREE.ConeGeometry(layerSize, layerHeight, 8);
    const crownMat = new THREE.MeshStandardMaterial({
      color: crownColors[i],
      roughness: 0.7,
      flatShading: true,
    });
    
    const crown = new THREE.Mesh(crownGeom, crownMat);
    crown.position.z = layerZ;
    tree.add(crown);
  }
  
  // Add glow for high-cost trees (>5000 tokens)
  if (treeData.tokenCost > 5000) {
    const glowGeom = new THREE.SphereGeometry(size * 1.5, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffdd00,
      transparent: true,
      opacity: 0.15,
    });
    
    const glow = new THREE.Mesh(glowGeom, glowMat);
    glow.position.z = trunkHeight + size;
    tree.add(glow);
  }
  
  tree.userData.treeData = treeData;
  tree.userData.isTokenTree = true;
  
  return tree;
}

/**
 * Create a park/plaza
 */
export function createPark(scale: number = 3): THREE.Group {
  const park = new THREE.Group();
  
  // Grass base
  const grassGeom = new THREE.CircleGeometry(scale * 3, 32);
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x7ec850,
    roughness: 0.9,
  });
  
  const grass = new THREE.Mesh(grassGeom, grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.z = 0.02;
  park.add(grass);
  
  // Flower patches
  const flowerColors = [0xff69b4, 0xffdd00, 0xff6b6b, 0x4ecdc4];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const distance = scale * (1 + Math.random() * 1.5);
    
    const flowerGeom = new THREE.SphereGeometry(0.3, 8, 8);
    const flowerMat = new THREE.MeshStandardMaterial({
      color: flowerColors[i % flowerColors.length],
      emissive: flowerColors[i % flowerColors.length],
      emissiveIntensity: 0.3,
    });
    
    const flower = new THREE.Mesh(flowerGeom, flowerMat);
    flower.position.set(
      Math.cos(angle) * distance,
      0,
      Math.sin(angle) * distance + 0.3
    );
    flower.scale.set(1, 1, 0.5);
    park.add(flower);
  }
  
  // Central feature (small fountain or statue)
  const featureGeom = new THREE.CylinderGeometry(0.5, 0.8, 2, 8);
  const featureMat = new THREE.MeshStandardMaterial({
    color: 0x95a5a6,
    roughness: 0.3,
    metalness: 0.7,
  });
  
  const feature = new THREE.Mesh(featureGeom, featureMat);
  feature.position.z = 1;
  park.add(feature);
  
  park.userData.isPark = true;
  return park;
}

/**
 * Create a fountain
 */
export function createFountain(scale: number = 1): THREE.Group {
  const fountain = new THREE.Group();
  
  // Base
  const baseGeom = new THREE.CylinderGeometry(scale * 2, scale * 2.5, 0.5, 16);
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x95a5a6,
    roughness: 0.4,
    metalness: 0.3,
  });
  
  const base = new THREE.Mesh(baseGeom, stoneMat);
  base.position.z = 0.25;
  fountain.add(base);
  
  // Bowl
  const bowlGeom = new THREE.SphereGeometry(scale * 1.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const bowl = new THREE.Mesh(bowlGeom, stoneMat);
  bowl.position.z = 0.5;
  fountain.add(bowl);
  
  // Water (particles)
  const waterParticles: THREE.Vector3[] = [];
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * scale;
    const height = Math.random() * scale * 2;
    
    waterParticles.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      0,
      height + 0.5
    ));
  }
  
  const waterGeom = new THREE.BufferGeometry().setFromPoints(waterParticles);
  const waterMat = new THREE.PointsMaterial({
    color: 0x3498db,
    size: 0.2,
    transparent: true,
    opacity: 0.6,
  });
  
  const water = new THREE.Points(waterGeom, waterMat);
  fountain.add(water);
  
  fountain.userData.isFountain = true;
  fountain.userData.waterParticles = water;
  
  return fountain;
}

/**
 * Create a bench
 */
export function createBench(scale: number = 0.8): THREE.Group {
  const bench = new THREE.Group();
  
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x8b4513,
    roughness: 0.8,
  });
  
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.3,
    metalness: 0.8,
  });
  
  // Seat
  const seatGeom = new THREE.BoxGeometry(scale * 3, scale * 0.8, scale * 0.3);
  const seat = new THREE.Mesh(seatGeom, woodMat);
  seat.position.z = scale * 0.8;
  bench.add(seat);
  
  // Backrest
  const backGeom = new THREE.BoxGeometry(scale * 3, scale * 0.3, scale * 1.2);
  const back = new THREE.Mesh(backGeom, woodMat);
  back.position.y = -scale * 0.4;
  back.position.z = scale * 1.4;
  bench.add(back);
  
  // Legs
  const legGeom = new THREE.CylinderGeometry(scale * 0.1, scale * 0.1, scale * 0.8, 8);
  
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      const leg = new THREE.Mesh(legGeom, metalMat);
      leg.position.set(x * scale * 1.2, y * scale * 0.3, scale * 0.4);
      bench.add(leg);
    }
  }
  
  bench.scale.setScalar(scale);
  bench.userData.isBench = true;
  
  return bench;
}

/**
 * Animate message marker (pulsing)
 */
export function animateMessage(marker: THREE.Group, time: number): void {
  const sphere = marker.children.find(c => c instanceof THREE.Mesh && c.geometry instanceof THREE.SphereGeometry);
  const ring = marker.children.find(c => c instanceof THREE.Mesh && c.geometry instanceof THREE.RingGeometry);
  const light = marker.children.find(c => c instanceof THREE.PointLight);
  
  if (sphere) {
    sphere.position.z = 1 + Math.sin(time * 2) * 0.2;
  }
  
  if (ring) {
    ring.scale.set(
      1 + Math.sin(time * 3) * 0.1,
      1 + Math.sin(time * 3) * 0.1,
      1
    );
    
    const mat = (ring as THREE.Mesh).material as THREE.MeshBasicMaterial;
    mat.opacity = 0.3 + Math.sin(time * 3) * 0.15;
  }
  
  if (light) {
    (light as THREE.PointLight).intensity = 2 + Math.sin(time * 4) * 0.5;
  }
}

/**
 * Animate fountain water
 */
export function animateFountain(fountain: THREE.Group, delta: number): void {
  const water = fountain.userData.waterParticles as THREE.Points | undefined;
  if (!water) return;
  
  const positions = water.geometry.attributes.position;
  
  for (let i = 0; i < positions.count; i++) {
    let z = positions.getZ(i);
    z += delta * 2;
    
    if (z > 3) {
      z = 0.5;
    }
    
    positions.setZ(i, z);
  }
  
  positions.needsUpdate = true;
}
