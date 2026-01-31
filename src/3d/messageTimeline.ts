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
 */
export class MessageTimelineEngine {
  private timelineLength: number = 0;
  private timeSpan: number = 0;
  private timelineStart: THREE.Vector3 = new THREE.Vector3(-100, 0, 0);
  
  public calculateLayout(
    messages: MessageData[],
    files: FileData[]
  ): MessageTimelineLayout {
    // Sort by timestamp
    const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    const sortedFiles = [...files].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    
    if (sortedMessages.length === 0) {
      return { timeline: [], districts: [], animals: [] };
    }
    
    // Calculate time span and timeline length
    this.timeSpan = sortedMessages[sortedMessages.length - 1].timestamp - sortedMessages[0].timestamp;
    this.timelineLength = Math.max(200, sortedMessages.length * 15);
    
    // Generate timeline elements (messages + trees)
    const timeline = this.createTimeline(sortedMessages);
    
    // Group files by directory and create districts
    const districts = this.createDistricts(sortedFiles, sortedMessages);
    
    // Generate animal paths
    const animals = this.createAnimalPaths(timeline, districts);
    
    return { timeline, districts, animals };
  }
  
  /**
   * Create timeline with messages and token-cost trees
   */
  private createTimeline(messages: MessageData[]): TimelineElement[] {
    const elements: TimelineElement[] = [];
    const firstTime = messages[0].timestamp;
    
    messages.forEach((msg, index) => {
      // Calculate position along timeline
      const progress = this.timeSpan > 0 
        ? (msg.timestamp - firstTime) / this.timeSpan 
        : index / messages.length;
      
      const x = this.timelineStart.x + progress * this.timelineLength;
      const position = new THREE.Vector3(x, 0, 0);
      
      // Add message marker
      elements.push({
        type: 'message',
        position: position.clone(),
        data: msg,
        delay: progress,
      });
      
      // Add token-cost tree for assistant messages
      if (msg.role === 'assistant' && msg.tokenCost) {
        const treeSize = this.calculateTreeSize(msg.tokenCost);
        const treeSide = index % 2 === 0 ? 1 : -1;
        const treeOffset = 8 + Math.random() * 3;
        
        const treePos = position.clone();
        treePos.z += treeSide * treeOffset;
        
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
   */
  private createDistricts(
    files: FileData[],
    _messages: MessageData[]
  ): District[] {
    // Group files by top-level directory
    const dirGroups = this.groupByDirectory(files);
    const districts: District[] = [];
    
    // Create district for each directory group
    let index = 0;
    dirGroups.forEach((dirFiles, dirName) => {
      const district = this.createDistrict(dirName, dirFiles, index);
      districts.push(district);
      index++;
    });
    
    return districts;
  }
  
  /**
   * Create a single district (neighborhood) for a directory
   */
  private createDistrict(
    dirName: string,
    files: FileData[],
    districtIndex: number
  ): District {
    // Position districts around the timeline
    const side = districtIndex % 2 === 0 ? 1 : -1;
    const distanceFromTimeline = 25 + Math.floor(districtIndex / 2) * 30;
    const alongTimeline = (districtIndex * 0.3) * this.timelineLength / Math.max(1, Math.floor(districtIndex / 2));
    
    const center = new THREE.Vector3(
      this.timelineStart.x + alongTimeline,
      0,
      side * distanceFromTimeline
    );
    
    // Calculate district radius based on file count
    const radius = Math.max(15, Math.sqrt(files.length) * 3);
    
    // Create blocks within district
    const blocks = this.createBlocks(files, center, radius);
    
    // Create internal street network
    const streets = this.createDistrictStreets(center, radius, blocks);
    
    // Add decorations (trees, lamps, parks)
    const decorations = this.createDistrictDecorations(center, radius, blocks.length);
    
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
   * Group files into blocks (neighborhoods)
   */
  private createBlocks(
    files: FileData[],
    districtCenter: THREE.Vector3,
    districtRadius: number
  ): Block[] {
    const blocks: Block[] = [];
    const filesPerBlock = 4;
    
    // Group files into blocks
    for (let i = 0; i < files.length; i += filesPerBlock) {
      const blockFiles = files.slice(i, i + filesPerBlock);
      
      // Arrange blocks in a grid within the district
      const blockIndex = Math.floor(i / filesPerBlock);
      const blocksPerRow = Math.ceil(Math.sqrt(files.length / filesPerBlock));
      const row = Math.floor(blockIndex / blocksPerRow);
      const col = blockIndex % blocksPerRow;
      
      const spacing = (districtRadius * 1.5) / blocksPerRow;
      const offsetX = (col - blocksPerRow / 2) * spacing;
      const offsetZ = (row - blocksPerRow / 2) * spacing;
      
      const position = new THREE.Vector3(
        districtCenter.x + offsetX,
        0,
        districtCenter.z + offsetZ
      );
      
      const plotSize = Math.max(8, blockFiles.length * 2);
      
      blocks.push({
        position,
        files: blockFiles,
        plotSize,
      });
    }
    
    return blocks;
  }
  
  /**
   * Create street network within district - GRID BASED, STRAIGHT ROADS ONLY
   * 
   * Road dimensions (based on 3DStreet standards):
   * - Main road: 4 lanes (12m) + 2×2m sidewalks = 16m total
   * - Side road: 2 lanes (6m) + 2×2m sidewalks = 10m total  
   * - Sub road: 1 lane (3m) + 2×2m sidewalks = 7m total
   */
  private createDistrictStreets(
    center: THREE.Vector3,
    radius: number,
    blocks: Block[]
  ): DistrictStreet[] {
    const streets: DistrictStreet[] = [];
    
    // STREET WIDTHS (road + sidewalks on both sides)
    const MAIN_ROAD_WIDTH = 16;    // 4 lanes (12m) + 2×2m sidewalks
    const SIDE_ROAD_WIDTH = 10;    // 2 lanes (6m) + 2×2m sidewalks
    const SUB_ROAD_WIDTH = 7;      // 1 lane (3m) + 2×2m sidewalks
    
    // Main straight road through district center (horizontal)
    const mainRoadStart = new THREE.Vector3(center.x - radius, 0, center.z);
    const mainRoadEnd = new THREE.Vector3(center.x + radius, 0, center.z);
    streets.push({
      points: [mainRoadStart, mainRoadEnd],
      width: MAIN_ROAD_WIDTH,
      type: 'main',
    });
    
    // Cross road (vertical through center)
    const crossRoadStart = new THREE.Vector3(center.x, 0, center.z - radius);
    const crossRoadEnd = new THREE.Vector3(center.x, 0, center.z + radius);
    streets.push({
      points: [crossRoadStart, crossRoadEnd],
      width: MAIN_ROAD_WIDTH,
      type: 'main',
    });
    
    // Side roads to blocks (straight lines from main road to block)
    const blocksPerQuadrant = Math.ceil(blocks.length / 4);
    
    blocks.forEach((block, index) => {
      // Determine which quadrant the block is in
      const dx = block.position.x - center.x;
      const dz = block.position.z - center.z;
      
      // Create a side road perpendicular to main roads
      if (Math.abs(dx) > Math.abs(dz)) {
        // Block is more horizontal - connect vertically from main road
        const sideRoadStart = new THREE.Vector3(block.position.x, 0, center.z);
        const sideRoadEnd = block.position.clone();
        sideRoadEnd.y = 0;
        streets.push({
          points: [sideRoadStart, sideRoadEnd],
          width: SIDE_ROAD_WIDTH,
          type: 'secondary',
        });
      } else {
        // Block is more vertical - connect horizontally from cross road
        const sideRoadStart = new THREE.Vector3(center.x, 0, block.position.z);
        const sideRoadEnd = block.position.clone();
        sideRoadEnd.y = 0;
        streets.push({
          points: [sideRoadStart, sideRoadEnd],
          width: SIDE_ROAD_WIDTH,
          type: 'secondary',
        });
      }
      
      // Add sub-roads between nearby blocks (every other block)
      if (index > 0 && index % 2 === 0) {
        const prevBlock = blocks[index - 1];
        const subRoadStart = prevBlock.position.clone();
        const subRoadEnd = block.position.clone();
        subRoadStart.y = 0;
        subRoadEnd.y = 0;
        
        // Only add if blocks are reasonably close
        if (subRoadStart.distanceTo(subRoadEnd) < radius) {
          streets.push({
            points: [subRoadStart, subRoadEnd],
            width: SUB_ROAD_WIDTH,
            type: 'tertiary',
          });
        }
      }
    });
    
    return streets;
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
   */
  private createAnimalPaths(
    _timeline: TimelineElement[],
    districts: District[]
  ): AnimalSpawn[] {
    const spawns: AnimalSpawn[] = [];
    
    // Cats walk along the main timeline road sidewalks
    const mainRoadPath: THREE.Vector3[] = [];
    const sidewalkOffset = 9;
    
    // Create path along timeline
    for (let i = 0; i <= 50; i++) {
      const x = this.timelineStart.x + (i / 50) * this.timelineLength;
      mainRoadPath.push(new THREE.Vector3(x, 0, sidewalkOffset));
      mainRoadPath.push(new THREE.Vector3(x, 0, -sidewalkOffset));
    }
    
    spawns.push({
      type: 'cat',
      path: mainRoadPath,
      count: 20, // MANY cats!
    });
    
    // Cats also walk around districts
    districts.forEach(district => {
      const districtPath = district.streets
        .find(s => s.type === 'main')
        ?.points || [];
      
      if (districtPath.length > 0) {
        spawns.push({
          type: 'cat',
          path: districtPath,
          count: 8,
        });
      }
    });
    
    // Seagulls fly in circles above the scene
    const centerX = this.timelineStart.x + this.timelineLength / 2;
    spawns.push({
      type: 'seagull',
      path: this.createCircularPath(new THREE.Vector3(centerX, 30, 0), 60),
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
