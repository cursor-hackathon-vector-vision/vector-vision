import * as THREE from 'three';

/**
 * MESSAGE-BASED TIMELINE LAYOUT
 * 
 * The main road IS the conversation timeline!
 * - Messages are placed along the main timeline road
 * - Token costs = trees along the road (size = cost)
 * - Files/folders branch off as districts
 * - Everything grows over time
 */

export interface MessageData {
  id: string;
  timestamp: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokenCost?: number;
  relatedFiles: string[];
}

export interface FileData {
  path: string;
  name: string;
  directory: string;
  extension: string;
  linesOfCode: number;
  createdAt?: number;
}

export interface MessageTimelineLayout {
  timeline: TimelineElement[];
  districts: District[];
  animals: AnimalSpawn[];
  mainRoad: DistrictStreet; // The main highway running South→North
}

export interface TimelineElement {
  type: 'message' | 'tree' | 'milestone';
  position: THREE.Vector3;
  data: MessageData | TreeData | MilestoneData;
  delay: number; // For growth animation
}

export interface TreeData {
  size: number; // Based on token cost
  tokenCost: number;
  messageId: string;
}

export interface MilestoneData {
  name: string;
  commitHash?: string;
  filesChanged: number;
}

export interface District {
  name: string; // Folder name
  center: THREE.Vector3;
  radius: number;
  blocks: Block[];
  streets: DistrictStreet[];
  decorations: Decoration[];
}

export interface Block {
  position: THREE.Vector3;
  files: FileData[];
  plotSize: number;
}

export interface DistrictStreet {
  points: THREE.Vector3[];
  width: number;
  type: 'main' | 'secondary' | 'tertiary' | 'alley';
}

export interface Decoration {
  type: 'tree' | 'lamp' | 'bench' | 'fountain' | 'park';
  position: THREE.Vector3;
  scale: number;
  delay: number;
}

export interface AnimalSpawn {
  type: 'cat' | 'seagull';
  path: THREE.Vector3[];
  count: number;
}

/**
 * Message Timeline Layout Engine
 * 
 * NEW LAYOUT:
 * - Main road runs SOUTH to NORTH (along -Z axis, so Z decreases = going north)
 * - Districts branch off to the LEFT (West, -X) and RIGHT (East, +X)
 * - Each district = one top-level folder
 * - Side streets connect main road to districts
 * - Buildings line up along the side streets
 */
export class MessageTimelineEngine {
  private timelineLength: number = 0;
  private timeSpan: number = 0;
  
  // MAIN ROAD: Süd → Nord (positive Z = south, negative Z = north)
  // Start at south end (positive Z), go north (negative Z)
  private mainRoadSouth: THREE.Vector3 = new THREE.Vector3(0, 0, 200);  // SOUTH START
  private mainRoadNorth: THREE.Vector3 = new THREE.Vector3(0, 0, -200); // NORTH END
  
  public calculateLayout(
    messages: MessageData[],
    files: FileData[]
  ): MessageTimelineLayout {
    // Sort by timestamp
    const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    const sortedFiles = [...files].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    
    // Default main road (even if no messages)
    const MAIN_ROAD_WIDTH = 16; // 4 lanes + sidewalks
    
    if (sortedMessages.length === 0) {
      // Even with no messages, create a long highway
      const defaultMainRoad: DistrictStreet = {
        points: [
          new THREE.Vector3(0, 0, 500),   // SOUTH (far)
          new THREE.Vector3(0, 0, -500)   // NORTH (far)
        ],
        width: MAIN_ROAD_WIDTH,
        type: 'main'
      };
      return { timeline: [], districts: [], animals: [], mainRoad: defaultMainRoad };
    }
    
    // Calculate time span and timeline length
    this.timeSpan = sortedMessages[sortedMessages.length - 1].timestamp - sortedMessages[0].timestamp;
    this.timelineLength = Math.max(300, sortedMessages.length * 10);
    
    // === HAUPTSTRASSE: VERY LONG (into "infinity") ===
    // Road extends far beyond the content for visual effect
    const ROAD_EXTENSION = 500; // Extra length on each end
    this.mainRoadSouth = new THREE.Vector3(0, 0, this.timelineLength / 2 + ROAD_EXTENSION);
    this.mainRoadNorth = new THREE.Vector3(0, 0, -this.timelineLength / 2 - ROAD_EXTENSION);
    
    // Create main road (the highway running South→North along Z-axis)
    const mainRoad: DistrictStreet = {
      points: [this.mainRoadSouth.clone(), this.mainRoadNorth.clone()],
      width: MAIN_ROAD_WIDTH,
      type: 'main'
    };
    
    // Generate timeline elements (messages along main road)
    const timeline = this.createTimeline(sortedMessages);
    
    // Group files by directory and create districts (side streets)
    const districts = this.createDistricts(sortedFiles, sortedMessages);
    
    // Generate animal paths
    const animals = this.createAnimalPaths(timeline, districts);
    
    return { timeline, districts, animals, mainRoad };
  }
  
  /**
   * Create timeline with messages along the MAIN ROAD (Süd→Nord)
   * Messages are placed along the Z-axis
   */
  private createTimeline(messages: MessageData[]): TimelineElement[] {
    const elements: TimelineElement[] = [];
    const firstTime = messages[0].timestamp;
    
    messages.forEach((msg, index) => {
      // Calculate position along timeline (Z axis, from south to north)
      const progress = this.timeSpan > 0 
        ? (msg.timestamp - firstTime) / this.timeSpan 
        : index / messages.length;
      
      // Z goes from +timelineLength/2 (south) to -timelineLength/2 (north)
      const z = this.mainRoadSouth.z - progress * this.timelineLength;
      
      // User messages on WEST side (-X), Assistant on EAST side (+X)
      const laneOffset = msg.role === 'user' ? -3 : 3;
      const position = new THREE.Vector3(laneOffset, 0, z);
      
      // Add message marker
      elements.push({
        type: 'message',
        position: position.clone(),
        data: msg,
        delay: progress,
      });
      
      // Add token-cost tree for assistant messages (outside the lanes)
      if (msg.role === 'assistant' && msg.tokenCost) {
        const treeSize = this.calculateTreeSize(msg.tokenCost);
        const treeSide = index % 2 === 0 ? 1 : -1;
        const treeOffset = 12 + Math.random() * 3;
        
        const treePos = position.clone();
        treePos.x = treeSide * treeOffset;
        
        elements.push({
          type: 'tree',
          position: treePos,
          data: {
            size: treeSize,
            tokenCost: msg.tokenCost,
            messageId: msg.id,
          },
          delay: progress + 0.05,
        });
      }
    });
    
    return elements;
  }
  
  /**
   * Calculate tree size based on token cost
   * More tokens = bigger tree
   */
  private calculateTreeSize(tokenCost: number): number {
    // Logarithmic scale for tree size
    const baseSize = 2;
    const scale = Math.log10(tokenCost + 1) * 1.5;
    return baseSize + scale;
  }
  
  /**
   * Create districts from file groups
   * 
   * ORIGINAL CONCEPT (from earlier versions):
   * - Districts are DIRECTLY NEXT TO EACH OTHER along the main road
   * - Each district = one folder = one short side street branching off
   * - Buildings line up ALONG the side streets
   * - Everything is TOGETHER, not scattered!
   */
  private createDistricts(
    files: FileData[],
    _messages: MessageData[]
  ): District[] {
    // Group files by top-level directory
    const dirGroups = this.groupByDirectory(files);
    const districts: District[] = [];
    
    // === TIGHT SPACING - Districts directly next to each other! ===
    const SIDE_STREET_SPACING = 30; // Distance between side streets along main road
    const SIDE_STREET_LENGTH = 50;  // How far side streets extend from main road
    
    // Start position (centered around Z=0)
    const totalLength = (dirGroups.size - 1) * SIDE_STREET_SPACING;
    const startZ = totalLength / 2;
    
    // Create district for each directory group
    let index = 0;
    dirGroups.forEach((dirFiles, dirName) => {
      // Position along main road - tightly packed!
      const positionAlongRoad = startZ - index * SIDE_STREET_SPACING;
      
      // Alternate sides: even = EAST (+X), odd = WEST (-X)
      const side = index % 2 === 0 ? 1 : -1;
      
      const district = this.createTightDistrict(
        dirName, 
        dirFiles, 
        positionAlongRoad, 
        side, 
        SIDE_STREET_LENGTH
      );
      districts.push(district);
      index++;
    });
    
    return districts;
  }
  
  /**
   * Create a TIGHT district - buildings directly along a short side street
   * 
   * Layout:
   * - Short side street branches from main road
   * - Buildings lined up along ONE side of the side street
   * - Everything compact and together!
   */
  private createTightDistrict(
    dirName: string,
    files: FileData[],
    positionAlongRoad: number,
    side: number,  // +1 = East, -1 = West
    sideStreetLength: number
  ): District {
    // District center is at the END of the side street
    const center = new THREE.Vector3(
      side * sideStreetLength,
      0,
      positionAlongRoad
    );
    
    // Small radius - keep it tight!
    const radius = Math.max(15, files.length * 2);
    
    // Create blocks - buildings along the side street
    const blocks = this.createBlocksAlongSideStreet(files, positionAlongRoad, side, sideStreetLength);
    
    // Create the ONE side street
    const streets = this.createSingleSideStreet(positionAlongRoad, side, sideStreetLength);
    
    // Minimal decorations
    const decorations = this.createMinimalDecorations(center, side);
    
    return {
      name: this.getShortName(dirName),
      center,
      radius,
      blocks,
      streets,
      decorations,
    };
  }
  
  /**
   * Create blocks DIRECTLY ALONG the side street
   * 
   * Buildings in a LINE along the side street, on the NORTH side (negative Z offset)
   */
  private createBlocksAlongSideStreet(
    files: FileData[],
    streetZ: number,
    side: number, // +1 = East, -1 = West
    streetLength: number
  ): Block[] {
    const blocks: Block[] = [];
    const BUILDING_SPACING = 6;
    const NORTH_OFFSET = -8; // Buildings north of the side street
    
    // Buildings line up along the side street (X-axis direction)
    files.forEach((file, index) => {
      // X position: from main road outward along the side street
      const distanceFromRoad = 15 + index * BUILDING_SPACING;
      const x = side * distanceFromRoad;
      
      // Z position: north of the side street
      const z = streetZ + NORTH_OFFSET;
      
      const position = new THREE.Vector3(x, 0, z);
      
      blocks.push({
        position,
        files: [file], // One file per block for tight layout
        plotSize: 5,
      });
    });
    
    return blocks;
  }
  
  /**
   * Create a SINGLE side street from main road
   */
  private createSingleSideStreet(
    streetZ: number,
    side: number,
    length: number
  ): DistrictStreet[] {
    const SIDE_ROAD_WIDTH = 8;
    
    // One straight side street from main road (X=0) outward
    const start = new THREE.Vector3(0, 0, streetZ);
    const end = new THREE.Vector3(side * length, 0, streetZ);
    
    return [{
      points: [start, end],
      width: SIDE_ROAD_WIDTH,
      type: 'secondary',
    }];
  }
  
  /**
   * Minimal decorations - just a few lamps along the side street
   */
  private createMinimalDecorations(
    center: THREE.Vector3,
    side: number
  ): Decoration[] {
    const decorations: Decoration[] = [];
    
    // A few lamps along the side street
    for (let i = 0; i < 3; i++) {
      const x = side * (15 + i * 15);
      decorations.push({
        type: 'lamp',
        position: new THREE.Vector3(x, 0, center.z + 5), // South side of street
        scale: 0.8,
        delay: i * 0.1,
      });
    }
    
    return decorations;
  }
  
  /**
   * LEGACY: Create blocks along street - kept for compatibility
   */
  private createBlocksAlongStreet(
    files: FileData[],
    districtCenter: THREE.Vector3,
    _districtRadius: number,
    side: number
  ): Block[] {
    return this.createBlocksAlongSideStreet(files, districtCenter.z, side, 50);
  }
  
  /**
   * LEGACY: Group files into blocks - kept for compatibility
   */
  private createBlocks(
    files: FileData[],
    districtCenter: THREE.Vector3,
    districtRadius: number
  ): Block[] {
    return this.createBlocksAlongStreet(files, districtCenter, districtRadius, 1);
  }
  
  /**
   * Create SIDE STREET from main road to district
   * 
   * Layout:
   * - One main SIDE STREET goes from main road (X=0) to district
   * - Buildings are along the NORTH side of this side street
   * - The side street runs along the X-axis (West-East direction)
   * 
   * Road dimensions:
   * - Main highway: 4 lanes + sidewalks = 16m
   * - Side street: 2 lanes + sidewalks = 10m
   */
  private createSideStreetWithBranches(
    districtCenter: THREE.Vector3,
    radius: number,
    side: number, // -1 = West, +1 = East
    mainRoadZ: number,
    sideStreetLength: number,
    blocks: Block[]
  ): DistrictStreet[] {
    const streets: DistrictStreet[] = [];
    
    const SIDE_ROAD_WIDTH = 10;    // 2 lanes (6m) + 2×2m sidewalks
    
    // === ONLY ONE SIDE STREET per district ===
    // From main road (X=0) to the district area
    // Runs along X-axis (EAST-WEST) at the district's Z position
    const sideStreetStart = new THREE.Vector3(0, 0, mainRoadZ);
    const sideStreetEnd = new THREE.Vector3(side * sideStreetLength, 0, mainRoadZ);
    
    streets.push({
      points: [sideStreetStart, sideStreetEnd],
      width: SIDE_ROAD_WIDTH,
      type: 'secondary',
    });
    
    // NO SUB-STREETS - they were causing the extra Süd-Nord roads!
    // Buildings are placed directly along the side street
    
    return streets;
  }
  
  /**
   * LEGACY: Create street network within district - kept for compatibility
   */
  private createDistrictStreets(
    center: THREE.Vector3,
    radius: number,
    blocks: Block[]
  ): DistrictStreet[] {
    // Delegate to new method with default values
    return this.createSideStreetWithBranches(center, radius, 1, center.z, 40, blocks);
  }
  
  /**
   * Create decorations for district
   */
  private createDistrictDecorations(
    center: THREE.Vector3,
    radius: number,
    blockCount: number
  ): Decoration[] {
    const decorations: Decoration[] = [];
    
    // Central park/fountain if district is large
    if (blockCount > 5) {
      decorations.push({
        type: 'park',
        position: center.clone(),
        scale: 3,
        delay: Math.random() * 0.5,
      });
    }
    
    // Random trees around perimeter
    const treeCount = Math.floor(radius / 5);
    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2 + Math.random() * 0.3;
      const distance = radius * (0.9 + Math.random() * 0.2);
      
      decorations.push({
        type: 'tree',
        position: new THREE.Vector3(
          center.x + Math.cos(angle) * distance,
          0,
          center.z + Math.sin(angle) * distance
        ),
        scale: 0.6 + Math.random() * 0.4,
        delay: Math.random(),
      });
    }
    
    // Lamps along streets
    const lampCount = Math.max(4, Math.floor(blockCount / 2));
    for (let i = 0; i < lampCount; i++) {
      const angle = (i / lampCount) * Math.PI * 2;
      const distance = radius * 0.75;
      
      decorations.push({
        type: 'lamp',
        position: new THREE.Vector3(
          center.x + Math.cos(angle) * distance,
          0,
          center.z + Math.sin(angle) * distance
        ),
        scale: 0.7,
        delay: Math.random() * 0.3,
      });
    }
    
    return decorations;
  }
  
  /**
   * Generate animal paths (sidewalks and sky)
   * 
   * Cats walk along:
   * - Main road sidewalks (Z-axis, both sides)
   * - Side street sidewalks
   */
  private createAnimalPaths(
    _timeline: TimelineElement[],
    districts: District[]
  ): AnimalSpawn[] {
    const spawns: AnimalSpawn[] = [];
    
    // Cats walk along the MAIN ROAD sidewalks (Z-axis)
    const mainRoadPathWest: THREE.Vector3[] = [];
    const mainRoadPathEast: THREE.Vector3[] = [];
    const sidewalkOffset = 10; // Distance from center
    
    // Create path along main road (Z-axis, south to north)
    for (let i = 0; i <= 50; i++) {
      const z = this.mainRoadSouth.z - (i / 50) * this.timelineLength;
      mainRoadPathWest.push(new THREE.Vector3(-sidewalkOffset, 0, z));
      mainRoadPathEast.push(new THREE.Vector3(sidewalkOffset, 0, z));
    }
    
    spawns.push({
      type: 'cat',
      path: mainRoadPathWest,
      count: 15,
    });
    
    spawns.push({
      type: 'cat',
      path: mainRoadPathEast,
      count: 15,
    });
    
    // Cats also walk along district side streets
    districts.forEach(district => {
      const sideStreet = district.streets.find(s => s.type === 'secondary');
      
      if (sideStreet && sideStreet.points.length >= 2) {
        spawns.push({
          type: 'cat',
          path: sideStreet.points,
          count: 5,
        });
      }
    });
    
    // Seagulls fly in circles above the scene
    spawns.push({
      type: 'seagull',
      path: this.createCircularPath(new THREE.Vector3(0, 30, 0), 80),
      count: 12,
    });
    
    return spawns;
  }
  
  private createCircularPath(center: THREE.Vector3, radius: number): THREE.Vector3[] {
    const path: THREE.Vector3[] = [];
    const segments = 32;
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      path.push(new THREE.Vector3(
        center.x + Math.cos(angle) * radius,
        center.y + Math.sin(angle * 3) * 5,
        center.z + Math.sin(angle) * radius
      ));
    }
    
    return path;
  }
  
  // Helper methods
  private groupByDirectory(files: FileData[]): Map<string, FileData[]> {
    const groups = new Map<string, FileData[]>();
    
    for (const file of files) {
      // Get top-level directory
      const parts = file.directory.split('/').filter(p => p);
      const topDir = parts[0] || 'root';
      
      if (!groups.has(topDir)) groups.set(topDir, []);
      groups.get(topDir)!.push(file);
    }
    
    return groups;
  }
  
  private getShortName(dir: string): string {
    const parts = dir.split('/').filter(p => p);
    return parts[parts.length - 1] || 'root';
  }
}
