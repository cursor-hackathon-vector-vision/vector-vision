import * as THREE from 'three';
import type { ChatMessage, Building } from '../types';

export interface ChatBubble3D {
  id: string;
  chat: ChatMessage;
  sprite: THREE.Sprite;
  position: THREE.Vector3;
  targetBuilding: Building | null;
  connectionLine: THREE.Line | null;
  visible: boolean;
  animationProgress: number;
}

export class ChatBubbleManager {
  private scene: THREE.Scene;
  private bubbles: Map<string, ChatBubble3D> = new Map();
  private connectionMaterial: THREE.LineBasicMaterial;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.connectionMaterial = new THREE.LineBasicMaterial({
      color: 0x667eea,
      transparent: true,
      opacity: 0.6,
      linewidth: 2
    });
  }

  public createBubble(
    chat: ChatMessage, 
    position: THREE.Vector3,
    targetBuilding: Building | null = null
  ): ChatBubble3D {
    // Create canvas for bubble texture
    const canvas = this.createBubbleCanvas(chat);
    const texture = new THREE.CanvasTexture(canvas);
    
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthTest: false
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(6, 3, 1);
    sprite.position.copy(position);
    sprite.position.y += 8;
    
    this.scene.add(sprite);
    
    // Create connection line if target building exists
    let connectionLine: THREE.Line | null = null;
    if (targetBuilding) {
      connectionLine = this.createConnectionLine(sprite.position, targetBuilding.position);
    }
    
    const bubble: ChatBubble3D = {
      id: chat.id,
      chat,
      sprite,
      position: sprite.position.clone(),
      targetBuilding,
      connectionLine,
      visible: false,
      animationProgress: 0
    };
    
    this.bubbles.set(chat.id, bubble);
    
    // Animate in
    this.animateBubbleIn(bubble);
    
    return bubble;
  }

  private createBubbleCanvas(chat: ChatMessage): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = 512;
    canvas.height = 256;
    
    // Background
    ctx.fillStyle = chat.role === 'user' ? 'rgba(102, 126, 234, 0.9)' : 'rgba(30, 30, 40, 0.95)';
    this.roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 40, 20);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = chat.role === 'user' ? 'rgba(150, 170, 255, 0.8)' : 'rgba(102, 126, 234, 0.6)';
    ctx.lineWidth = 3;
    this.roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 40, 20);
    ctx.stroke();
    
    // Role label
    ctx.fillStyle = chat.role === 'user' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(102, 126, 234, 0.9)';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(chat.role.toUpperCase(), 30, 50);
    
    // Content text (truncated)
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px Arial';
    const maxWidth = canvas.width - 60;
    const lines = this.wrapText(ctx, chat.content.slice(0, 200), maxWidth);
    
    lines.slice(0, 4).forEach((line, index) => {
      ctx.fillText(line, 30, 90 + index * 30);
    });
    
    if (lines.length > 4 || chat.content.length > 200) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText('...', 30, 90 + 4 * 30);
    }
    
    // Speech bubble pointer
    ctx.fillStyle = chat.role === 'user' ? 'rgba(102, 126, 234, 0.9)' : 'rgba(30, 30, 40, 0.95)';
    ctx.beginPath();
    ctx.moveTo(60, canvas.height - 30);
    ctx.lineTo(80, canvas.height - 5);
    ctx.lineTo(100, canvas.height - 30);
    ctx.closePath();
    ctx.fill();
    
    return canvas;
  }

  private roundRect(
    ctx: CanvasRenderingContext2D, 
    x: number, y: number, 
    width: number, height: number, 
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  private createConnectionLine(from: THREE.Vector3, to: THREE.Vector3): THREE.Line {
    // Create curved line using quadratic bezier
    const midPoint = new THREE.Vector3(
      (from.x + to.x) / 2,
      Math.max(from.y, to.y) + 2,
      (from.z + to.z) / 2
    );
    
    const curve = new THREE.QuadraticBezierCurve3(
      from.clone(),
      midPoint,
      new THREE.Vector3(to.x, to.y + 2, to.z)
    );
    
    const points = curve.getPoints(30);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    const line = new THREE.Line(geometry, this.connectionMaterial.clone());
    line.userData.isChatLine = true;
    
    this.scene.add(line);
    
    return line;
  }

  private animateBubbleIn(bubble: ChatBubble3D): void {
    const startY = bubble.sprite.position.y - 2;
    const targetY = bubble.sprite.position.y;
    bubble.sprite.position.y = startY;
    
    const material = bubble.sprite.material as THREE.SpriteMaterial;
    const startTime = Date.now();
    const duration = 500;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      
      bubble.sprite.position.y = startY + (targetY - startY) * eased;
      material.opacity = eased;
      bubble.animationProgress = progress;
      
      // Animate connection line
      if (bubble.connectionLine) {
        const lineMaterial = bubble.connectionLine.material as THREE.LineBasicMaterial;
        lineMaterial.opacity = eased * 0.6;
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        bubble.visible = true;
      }
    };
    
    animate();
  }

  public removeBubble(id: string): void {
    const bubble = this.bubbles.get(id);
    if (!bubble) return;
    
    // Animate out
    const material = bubble.sprite.material as THREE.SpriteMaterial;
    const startTime = Date.now();
    const duration = 300;
    const startOpacity = material.opacity;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      material.opacity = startOpacity * (1 - progress);
      
      if (bubble.connectionLine) {
        const lineMaterial = bubble.connectionLine.material as THREE.LineBasicMaterial;
        lineMaterial.opacity = 0.6 * (1 - progress);
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Remove from scene
        this.scene.remove(bubble.sprite);
        material.dispose();
        (bubble.sprite.material as THREE.SpriteMaterial).map?.dispose();
        
        if (bubble.connectionLine) {
          this.scene.remove(bubble.connectionLine);
          bubble.connectionLine.geometry.dispose();
        }
        
        this.bubbles.delete(id);
      }
    };
    
    animate();
  }

  public updateBubblesForSnapshot(
    chats: ChatMessage[], 
    buildings: Map<string, { position: THREE.Vector3 }>
  ): void {
    // Remove old bubbles not in current chats
    const currentChatIds = new Set(chats.map(c => c.id));
    this.bubbles.forEach((_, id) => {
      if (!currentChatIds.has(id)) {
        this.removeBubble(id);
      }
    });
    
    // Add new bubbles
    chats.forEach((chat, index) => {
      if (!this.bubbles.has(chat.id)) {
        // Calculate position based on related files or center
        let position = new THREE.Vector3(0, 0, 0);
        let targetBuilding: Building | null = null;
        
        if (chat.relatedFiles.length > 0) {
          const relatedPath = chat.relatedFiles[0];
          const building = buildings.get(relatedPath);
          if (building) {
            position = building.position.clone();
            // Offset bubbles to avoid overlap
            position.x += (index % 3 - 1) * 3;
            position.z += Math.floor(index / 3) * 3;
          }
        } else {
          // Position in a circle around center
          const angle = (index / chats.length) * Math.PI * 2;
          const radius = 15;
          position.x = Math.cos(angle) * radius;
          position.z = Math.sin(angle) * radius;
        }
        
        // Stagger creation for visual effect
        setTimeout(() => {
          this.createBubble(chat, position, targetBuilding);
        }, index * 200);
      }
    });
  }

  public update(_delta: number): void {
    // Gentle floating animation
    this.bubbles.forEach(bubble => {
      if (bubble.visible) {
        const float = Math.sin(Date.now() * 0.002 + bubble.position.x) * 0.1;
        bubble.sprite.position.y = bubble.position.y + float;
      }
    });
  }

  public setVisibility(visible: boolean): void {
    this.bubbles.forEach(bubble => {
      const material = bubble.sprite.material as THREE.SpriteMaterial;
      material.opacity = visible ? 1 : 0;
      
      if (bubble.connectionLine) {
        const lineMaterial = bubble.connectionLine.material as THREE.LineBasicMaterial;
        lineMaterial.opacity = visible ? 0.6 : 0;
      }
    });
  }

  public clear(): void {
    this.bubbles.forEach((_, id) => {
      this.removeBubble(id);
    });
  }

  public dispose(): void {
    this.clear();
    this.connectionMaterial.dispose();
  }
}
