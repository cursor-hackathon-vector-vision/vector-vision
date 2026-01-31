import * as THREE from 'three';

/**
 * ANIMALS FACTORY
 * 
 * Creates adorable low-poly animals for the city:
 * - Orange cats walking on sidewalks
 * - White seagulls flying overhead
 */

export interface Animal {
  group: THREE.Group;
  type: 'cat' | 'seagull';
  speed: number;
  path?: THREE.Vector3[]; // Path to follow
  pathIndex: number;
}

/**
 * Create a low-poly orange cat
 */
export function createCat(scale: number = 0.5): THREE.Group {
  const cat = new THREE.Group();
  
  const orange = 0xff8844;
  const catMat = new THREE.MeshStandardMaterial({
    color: orange,
    roughness: 0.8,
    flatShading: true,
  });
  
  // Body - capsule shape
  const bodyGeom = new THREE.CapsuleGeometry(0.3, 0.6, 4, 8);
  const body = new THREE.Mesh(bodyGeom, catMat);
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 0, 0.35);
  cat.add(body);
  
  // Head - sphere
  const headGeom = new THREE.SphereGeometry(0.25, 8, 6);
  const head = new THREE.Mesh(headGeom, catMat);
  head.position.set(0.5, 0, 0.45);
  cat.add(head);
  
  // Ears - triangular
  const earGeom = new THREE.ConeGeometry(0.1, 0.2, 4);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeom, catMat);
    ear.position.set(0.55, side * 0.12, 0.65);
    cat.add(ear);
  }
  
  // Tail - curved
  const tailGeom = new THREE.CylinderGeometry(0.05, 0.08, 0.5, 6);
  const tail = new THREE.Mesh(tailGeom, catMat);
  tail.rotation.z = Math.PI / 4;
  tail.position.set(-0.5, 0, 0.5);
  cat.add(tail);
  
  // Eyes - glowing green
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x44ff44 });
  for (const side of [-1, 1]) {
    const eyeGeom = new THREE.SphereGeometry(0.05, 6, 6);
    const eye = new THREE.Mesh(eyeGeom, eyeMat);
    eye.position.set(0.7, side * 0.1, 0.5);
    cat.add(eye);
  }
  
  // Nose - pink
  const noseGeom = new THREE.SphereGeometry(0.04, 6, 6);
  const noseMat = new THREE.MeshBasicMaterial({ color: 0xff69b4 });
  const nose = new THREE.Mesh(noseGeom, noseMat);
  nose.position.set(0.72, 0, 0.42);
  cat.add(nose);
  
  cat.scale.setScalar(scale);
  cat.userData.isCat = true;
  cat.userData.walkSpeed = 0.3 + Math.random() * 0.3;
  cat.userData.walkDirection = Math.random() > 0.5 ? 1 : -1;
  
  return cat;
}

/**
 * Create a low-poly white seagull
 */
export function createSeagull(scale: number = 0.4): THREE.Group {
  const seagull = new THREE.Group();
  
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    flatShading: true,
  });
  
  const grayMat = new THREE.MeshStandardMaterial({
    color: 0xaaaaaa,
    roughness: 0.7,
    flatShading: true,
  });
  
  // Body - stretched sphere
  const bodyGeom = new THREE.SphereGeometry(0.3, 6, 6);
  const body = new THREE.Mesh(bodyGeom, whiteMat);
  body.scale.set(1, 0.8, 1.2);
  body.position.z = 0;
  seagull.add(body);
  
  // Head - small sphere
  const headGeom = new THREE.SphereGeometry(0.2, 6, 6);
  const head = new THREE.Mesh(headGeom, whiteMat);
  head.position.set(0.35, 0, 0.15);
  seagull.add(head);
  
  // Beak - cone
  const beakGeom = new THREE.ConeGeometry(0.05, 0.15, 4);
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
  const beak = new THREE.Mesh(beakGeom, beakMat);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.5, 0, 0.15);
  seagull.add(beak);
  
  // Eyes - black
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  for (const side of [-1, 1]) {
    const eyeGeom = new THREE.SphereGeometry(0.04, 6, 6);
    const eye = new THREE.Mesh(eyeGeom, eyeMat);
    eye.position.set(0.42, side * 0.08, 0.2);
    seagull.add(eye);
  }
  
  // Wings - triangular flaps
  const wingGeom = new THREE.ConeGeometry(0.4, 0.8, 3);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeom, grayMat);
    wing.rotation.z = side * Math.PI / 2;
    wing.rotation.x = Math.PI / 4;
    wing.position.set(0, side * 0.4, 0);
    wing.userData.isSide = side;
    seagull.add(wing);
  }
  
  // Tail - triangle
  const tailGeom = new THREE.ConeGeometry(0.15, 0.3, 3);
  const tail = new THREE.Mesh(tailGeom, whiteMat);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.4, 0, 0);
  seagull.add(tail);
  
  seagull.scale.setScalar(scale);
  seagull.userData.isSeagull = true;
  seagull.userData.flySpeed = 1 + Math.random() * 0.5;
  seagull.userData.wingsPhase = Math.random() * Math.PI * 2;
  
  return seagull;
}

/**
 * Animate cat walking
 */
export function animateCat(cat: THREE.Group, delta: number): void {
  const speed = cat.userData.walkSpeed || 0.5;
  
  // Bob up and down while walking
  if (!cat.userData.walkPhase) cat.userData.walkPhase = 0;
  cat.userData.walkPhase += delta * speed * 10;
  
  const bobAmount = Math.abs(Math.sin(cat.userData.walkPhase)) * 0.08;
  cat.children.forEach(child => {
    if (child instanceof THREE.Mesh && child.position.z > 0.1) {
      child.position.z += bobAmount;
    }
  });
  
  // Tail swish
  const tail = cat.children.find(c => c.position.x < -0.4);
  if (tail) {
    tail.rotation.y = Math.sin(cat.userData.walkPhase * 0.8) * 0.3;
  }
}

/**
 * Animate seagull flying
 */
export function animateSeagull(seagull: THREE.Group, delta: number): void {
  const speed = seagull.userData.flySpeed || 1;
  
  // Flap wings
  if (!seagull.userData.wingsPhase) seagull.userData.wingsPhase = 0;
  seagull.userData.wingsPhase += delta * speed * 8;
  
  seagull.children.forEach(child => {
    if (child.userData.isSide !== undefined) {
      const side = child.userData.isSide;
      const flapAngle = Math.sin(seagull.userData.wingsPhase) * 0.6;
      child.rotation.x = Math.PI / 4 + flapAngle * side;
    }
  });
  
  // Bob up and down
  const bobAmount = Math.sin(seagull.userData.wingsPhase * 0.5) * 0.3;
  seagull.position.y += bobAmount * delta;
}

/**
 * Create many cats along a path (sidewalk)
 */
export function createManyCats(
  sidewalkPath: THREE.Vector3[],
  count: number = 12
): Animal[] {
  const cats: Animal[] = [];
  
  for (let i = 0; i < count; i++) {
    const cat = createCat(0.4 + Math.random() * 0.2);
    const startIndex = Math.floor(Math.random() * sidewalkPath.length);
    const speed = 0.5 + Math.random() * 0.5;
    
    // Position at random point on path
    if (sidewalkPath[startIndex]) {
      cat.position.copy(sidewalkPath[startIndex]);
    }
    
    // Face direction of travel
    if (sidewalkPath[startIndex + 1]) {
      const dir = new THREE.Vector3()
        .subVectors(sidewalkPath[startIndex + 1], sidewalkPath[startIndex])
        .normalize();
      cat.rotation.y = Math.atan2(dir.x, dir.z);
    }
    
    cats.push({
      group: cat,
      type: 'cat',
      speed,
      path: sidewalkPath,
      pathIndex: startIndex,
    });
  }
  
  return cats;
}

/**
 * Create seagulls flying in circles
 */
export function createSeagulls(
  center: THREE.Vector3,
  radius: number = 50,
  count: number = 8,
  height: number = 30
): Animal[] {
  const seagulls: Animal[] = [];
  
  // Create circular path
  const segments = 32;
  const path: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = center.x + Math.cos(angle) * radius;
    const z = center.z + Math.sin(angle) * radius;
    const y = center.y + height + Math.sin(angle * 3) * 5; // Wavy height
    path.push(new THREE.Vector3(x, y, z));
  }
  
  for (let i = 0; i < count; i++) {
    const seagull = createSeagull(0.3 + Math.random() * 0.2);
    const startIndex = Math.floor((i / count) * path.length);
    const speed = 1 + Math.random() * 0.5;
    
    // Position at point on circular path
    if (path[startIndex]) {
      seagull.position.copy(path[startIndex]);
    }
    
    // Face direction of travel
    if (path[startIndex + 1]) {
      const dir = new THREE.Vector3()
        .subVectors(path[startIndex + 1], path[startIndex])
        .normalize();
      seagull.rotation.y = Math.atan2(dir.x, dir.z);
    }
    
    seagulls.push({
      group: seagull,
      type: 'seagull',
      speed,
      path,
      pathIndex: startIndex,
    });
  }
  
  return seagulls;
}

/**
 * Update animal along its path
 */
export function updateAnimalPath(animal: Animal, delta: number): void {
  if (!animal.path || animal.path.length < 2) return;
  
  const distanceToMove = animal.speed * delta;
  let remainingDistance = distanceToMove;
  
  while (remainingDistance > 0 && animal.path.length > 0) {
    const currentPos = animal.group.position;
    const nextIndex = (animal.pathIndex + 1) % animal.path.length;
    const nextPos = animal.path[nextIndex];
    
    const toNext = new THREE.Vector3().subVectors(nextPos, currentPos);
    const distance = toNext.length();
    
    if (remainingDistance >= distance) {
      // Move to next point
      animal.group.position.copy(nextPos);
      animal.pathIndex = nextIndex;
      remainingDistance -= distance;
      
      // Update rotation to face next direction
      if (animal.path[(nextIndex + 1) % animal.path.length]) {
        const dir = new THREE.Vector3()
          .subVectors(
            animal.path[(nextIndex + 1) % animal.path.length],
            nextPos
          )
          .normalize();
        animal.group.rotation.y = Math.atan2(dir.x, dir.z);
      }
    } else {
      // Move towards next point
      toNext.normalize().multiplyScalar(remainingDistance);
      animal.group.position.add(toNext);
      remainingDistance = 0;
    }
  }
  
  // Animate based on type
  if (animal.type === 'cat') {
    animateCat(animal.group, delta);
  } else if (animal.type === 'seagull') {
    animateSeagull(animal.group, delta);
  }
}
