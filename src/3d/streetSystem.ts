import * as THREE from 'three';

/**
 * ADVANCED STREET SYSTEM
 * 
 * Creates a futuristic road network:
 * - Timeline Highway with animated data streams
 * - District access roads with glow effects
 * - Intersection nodes with pulse animations
 */

export interface StreetNetwork {
  mainHighway: THREE.Group;
  accessRoads: THREE.Group[];
  intersections: THREE.Group[];
  dataParticles: THREE.Points;
  update: (time: number) => void;
}

export interface DistrictBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  name: string;
  color: number;
}

/**
 * Create the complete street network
 */
export function createStreetNetwork(
  districts: DistrictBounds[],
  totalWidth: number = 400,
  _totalDepth: number = 400
): StreetNetwork {
  const mainHighway = createTimelineHighway(totalWidth);
  const accessRoads: THREE.Group[] = [];
  const intersections: THREE.Group[] = [];
  
  // Create access roads to each district
  for (const district of districts) {
    const centerX = (district.x0 + district.x1) / 2;
    const centerZ = (district.y0 + district.y1) / 2;
    
    // Connect district to main highway (at z=0)
    if (Math.abs(centerZ) > 20) {
      const road = createAccessRoad(
        new THREE.Vector3(centerX, 0, 0),
        new THREE.Vector3(centerX, 0, centerZ > 0 ? district.y0 : district.y1),
        district.color
      );
      accessRoads.push(road);
      
      // Add intersection at highway connection
      const intersection = createIntersectionNode(
        new THREE.Vector3(centerX, 0.1, 0),
        district.color
      );
      intersections.push(intersection);
    }
  }
  
  // Create data stream particles along the highway
  const dataParticles = createDataStreamParticles(totalWidth);
  
  // Animation update function
  const update = (time: number) => {
    updateDataStream(dataParticles, time, totalWidth);
    updateIntersections(intersections, time);
    updateAccessRoads(accessRoads, time);
  };
  
  return {
    mainHighway,
    accessRoads,
    intersections,
    dataParticles,
    update
  };
}

/**
 * Create the main Timeline Highway with sidewalks
 */
function createTimelineHighway(length: number): THREE.Group {
  const group = new THREE.Group();
  const halfLength = length / 2;
  
  // Road base - dark asphalt
  const roadWidth = 12;
  const sidewalkWidth = 2;
  
  const roadGeom = new THREE.PlaneGeometry(length, roadWidth, 100, 1);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.8,
    metalness: 0.2,
  });
  const road = new THREE.Mesh(roadGeom, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.02;
  group.add(road);
  
  // SIDEWALKS on both sides - where cats walk!
  for (const side of [-1, 1]) {
    const sidewalkGeom = new THREE.PlaneGeometry(length, sidewalkWidth);
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a3e,
      roughness: 0.9,
      metalness: 0.1,
    });
    const sidewalk = new THREE.Mesh(sidewalkGeom, sidewalkMat);
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(0, 0.04, side * (roadWidth / 2 + sidewalkWidth / 2));
    sidewalk.userData = { isSidewalk: true, side };
    group.add(sidewalk);
    
    // Sidewalk curb edge glow
    const curbGeom = new THREE.PlaneGeometry(length, 0.2);
    const curbMat = new THREE.MeshBasicMaterial({
      color: 0x4fc3f7,
      transparent: true,
      opacity: 0.7,
    });
    const curb = new THREE.Mesh(curbGeom, curbMat);
    curb.rotation.x = -Math.PI / 2;
    curb.position.set(0, 0.05, side * roadWidth / 2);
    group.add(curb);
  }
  
  // Center lane - glowing cyan stripe
  const centerStripeGeom = new THREE.PlaneGeometry(length, 0.4, 1, 1);
  const centerStripeMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.95,
  });
  const centerStripe = new THREE.Mesh(centerStripeGeom, centerStripeMat);
  centerStripe.rotation.x = -Math.PI / 2;
  centerStripe.position.y = 0.03;
  group.add(centerStripe);
  
  // Side lanes - dashed lines
  const dashCount = Math.floor(length / 8);
  for (const side of [-1, 1]) {
    for (let i = 0; i < dashCount; i++) {
      const dashGeom = new THREE.PlaneGeometry(4, 0.15);
      const dashMat = new THREE.MeshBasicMaterial({
        color: 0x4fc3f7,
        transparent: true,
        opacity: 0.7,
      });
      const dash = new THREE.Mesh(dashGeom, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(-halfLength + i * 8 + 4, 0.03, side * 3);
      group.add(dash);
    }
  }
  
  // Outer edge glow tubes on sidewalk edges
  for (const side of [-1, 1]) {
    const tubePoints = [
      new THREE.Vector3(-halfLength, 0.2, side * (roadWidth / 2 + sidewalkWidth)),
      new THREE.Vector3(halfLength, 0.2, side * (roadWidth / 2 + sidewalkWidth)),
    ];
    const tubeCurve = new THREE.CatmullRomCurve3(tubePoints);
    const tubeGeom = new THREE.TubeGeometry(tubeCurve, 64, 0.06, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.5,
    });
    const tube = new THREE.Mesh(tubeGeom, tubeMat);
    group.add(tube);
  }
  
  // Time markers along the road (like a timeline)
  for (let i = -5; i <= 5; i++) {
    if (i === 0) continue;
    
    const markerX = i * (length / 12);
    
    // Vertical marker on sidewalk
    const markerGeom = new THREE.BoxGeometry(0.15, 1.2, 0.15);
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0x4fc3f7,
      emissive: new THREE.Color(0x4fc3f7),
      emissiveIntensity: 0.5,
    });
    const marker = new THREE.Mesh(markerGeom, markerMat);
    marker.position.set(markerX, 0.6, roadWidth / 2 + sidewalkWidth - 0.3);
    group.add(marker);
    
    // Mirror on other side
    const marker2 = marker.clone();
    marker2.position.z = -(roadWidth / 2 + sidewalkWidth - 0.3);
    group.add(marker2);
  }
  
  // Store sidewalk positions for cat walking
  group.userData = { 
    roadWidth, 
    sidewalkWidth,
    sidewalkZ: [roadWidth / 2 + sidewalkWidth / 2, -(roadWidth / 2 + sidewalkWidth / 2)]
  };
  
  return group;
}

/**
 * Create an access road from main highway to district - same style as main road
 */
function createAccessRoad(start: THREE.Vector3, end: THREE.Vector3, _color: number): THREE.Group {
  const group = new THREE.Group();
  
  const direction = end.clone().sub(start);
  const length = direction.length();
  const roadWidth = 8;
  const sidewalkWidth = 1.5;
  
  // Straight road surface
  const roadGeom = new THREE.PlaneGeometry(roadWidth, length);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.8,
    metalness: 0.2,
  });
  const road = new THREE.Mesh(roadGeom, roadMat);
  road.rotation.x = -Math.PI / 2;
  
  // Position and rotate to align
  const center = start.clone().add(end).multiplyScalar(0.5);
  road.position.copy(center);
  road.position.y = 0.02;
  road.rotation.z = Math.atan2(direction.x, direction.z);
  group.add(road);
  
  // Center stripe - glowing cyan
  const stripeGeom = new THREE.PlaneGeometry(0.3, length);
  const stripeMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.9,
  });
  const stripe = new THREE.Mesh(stripeGeom, stripeMat);
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.copy(center);
  stripe.position.y = 0.03;
  stripe.rotation.z = road.rotation.z;
  group.add(stripe);
  
  // Sidewalks on both sides
  for (const side of [-1, 1]) {
    const sidewalkGeom = new THREE.PlaneGeometry(sidewalkWidth, length);
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a3e,
      roughness: 0.9,
      metalness: 0.1,
    });
    const sidewalk = new THREE.Mesh(sidewalkGeom, sidewalkMat);
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.copy(center);
    sidewalk.position.y = 0.04;
    sidewalk.rotation.z = road.rotation.z;
    
    // Offset perpendicular to road direction
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    sidewalk.position.add(perpendicular.multiplyScalar(side * (roadWidth / 2 + sidewalkWidth / 2)));
    group.add(sidewalk);
    
    // Sidewalk edge glow
    const edgeGeom = new THREE.PlaneGeometry(0.15, length);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0x4fc3f7,
      transparent: true,
      opacity: 0.6,
    });
    const edge = new THREE.Mesh(edgeGeom, edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.copy(sidewalk.position);
    edge.position.y = 0.05;
    edge.rotation.z = road.rotation.z;
    group.add(edge);
  }
  
  // Dashed lane markings
  const dashCount = Math.floor(length / 6);
  for (let i = 0; i < dashCount; i++) {
    for (const side of [-1, 1]) {
      const dashGeom = new THREE.PlaneGeometry(3, 0.12);
      const dashMat = new THREE.MeshBasicMaterial({
        color: 0x4fc3f7,
        transparent: true,
        opacity: 0.6,
      });
      const dash = new THREE.Mesh(dashGeom, dashMat);
      dash.rotation.x = -Math.PI / 2;
      
      // Position along road
      const t = (i + 0.5) / dashCount;
      const pos = start.clone().lerp(end, t);
      dash.position.copy(pos);
      dash.position.y = 0.03;
      dash.rotation.z = road.rotation.z;
      
      // Offset to lane
      const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
      dash.position.add(perpendicular.multiplyScalar(side * 2));
      group.add(dash);
    }
  }
  
  group.userData = { length, direction };
  
  return group;
}

/**
 * Create glowing intersection node
 */
function createIntersectionNode(position: THREE.Vector3, color: number): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  
  // Hexagon base
  const hexGeom = new THREE.CircleGeometry(2, 6);
  const hexMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.4,
  });
  const hex = new THREE.Mesh(hexGeom, hexMat);
  hex.rotation.x = -Math.PI / 2;
  group.add(hex);
  
  // Inner ring
  const ringGeom = new THREE.RingGeometry(1, 1.3, 6);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  group.add(ring);
  
  // Center point light
  const light = new THREE.PointLight(color, 1, 10);
  light.position.y = 1;
  group.add(light);
  
  // Floating orb
  const orbGeom = new THREE.SphereGeometry(0.3, 16, 16);
  const orbMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
  });
  const orb = new THREE.Mesh(orbGeom, orbMat);
  orb.position.y = 1;
  group.add(orb);
  
  group.userData = { color, baseY: position.y };
  
  return group;
}

/**
 * Create flowing data stream particles
 */
function createDataStreamParticles(roadLength: number): THREE.Points {
  const particleCount = 200;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  
  for (let i = 0; i < particleCount; i++) {
    // Random position along road
    positions[i * 3] = (Math.random() - 0.5) * roadLength;
    positions[i * 3 + 1] = 0.5 + Math.random() * 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
    
    // Cyan to white gradient
    const t = Math.random();
    colors[i * 3] = 0.5 + t * 0.5;
    colors[i * 3 + 1] = 1;
    colors[i * 3 + 2] = 1;
    
    sizes[i] = 0.2 + Math.random() * 0.3;
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  const material = new THREE.PointsMaterial({
    size: 0.3,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
  });
  
  const particles = new THREE.Points(geometry, material);
  particles.userData = { roadLength, speeds: Array(particleCount).fill(0).map(() => 10 + Math.random() * 20) };
  
  return particles;
}

/**
 * Update data stream particles
 */
function updateDataStream(particles: THREE.Points, time: number, roadLength: number): void {
  const positions = particles.geometry.attributes.position.array as Float32Array;
  const speeds = particles.userData.speeds;
  const halfLength = roadLength / 2;
  const particleCount = positions.length / 3;
  
  for (let i = 0; i < particleCount; i++) {
    // Move along road
    positions[i * 3] += speeds[i] * 0.016; // ~60fps
    
    // Wrap around
    if (positions[i * 3] > halfLength) {
      positions[i * 3] = -halfLength;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    
    // Subtle vertical oscillation
    positions[i * 3 + 1] = 0.5 + Math.sin(time * 2 + i) * 0.2;
  }
  
  particles.geometry.attributes.position.needsUpdate = true;
}

/**
 * Update intersection pulse animations
 */
function updateIntersections(intersections: THREE.Group[], time: number): void {
  for (let i = 0; i < intersections.length; i++) {
    const node = intersections[i];
    const phase = time + i * 0.5;
    
    // Pulse the ring
    const ring = node.children[1] as THREE.Mesh;
    if (ring && ring.material instanceof THREE.MeshBasicMaterial) {
      ring.material.opacity = 0.5 + Math.sin(phase * 3) * 0.3;
      ring.rotation.z = time * 0.5;
    }
    
    // Bob the orb
    const orb = node.children[3] as THREE.Mesh;
    if (orb) {
      orb.position.y = 1 + Math.sin(phase * 2) * 0.2;
    }
    
    // Pulse the light
    const light = node.children[2] as THREE.PointLight;
    if (light) {
      light.intensity = 0.5 + Math.sin(phase * 4) * 0.5;
    }
  }
}

/**
 * Update access road animations
 */
function updateAccessRoads(roads: THREE.Group[], time: number): void {
  for (let i = 0; i < roads.length; i++) {
    const road = roads[i];
    const stripe = road.children[1] as THREE.Mesh;
    
    if (stripe && stripe.material instanceof THREE.MeshBasicMaterial) {
      // Subtle pulse
      stripe.material.opacity = 0.6 + Math.sin(time * 2 + i) * 0.2;
    }
  }
}

/**
 * Add all street elements to scene groups
 */
export function addStreetNetworkToScene(
  network: StreetNetwork,
  streetGroup: THREE.Group,
  effectsGroup: THREE.Group
): void {
  streetGroup.add(network.mainHighway);
  
  for (const road of network.accessRoads) {
    streetGroup.add(road);
  }
  
  for (const intersection of network.intersections) {
    streetGroup.add(intersection);
  }
  
  effectsGroup.add(network.dataParticles);
}
