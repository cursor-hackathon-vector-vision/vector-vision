import * as THREE from 'three';

/**
 * MODULAR FILE TYPE RENDERERS
 * 
 * Extensible system for rendering different file types:
 * - Text files: Show code preview
 * - Images: Display thumbnail on building
 * - HTML: Render preview
 * - Databases: Special 3D visualization
 * - Default: Basic building with file info
 */

export interface FileRenderData {
  path: string;
  name: string;
  extension: string;
  content?: string;
  lines?: string[];
  linesOfCode: number;
  size?: number;
}

export interface FileRenderer {
  extensions: string[];
  createTexture: (file: FileRenderData) => THREE.Texture | null;
  createDecoration?: (file: FileRenderData) => THREE.Group | null;
  getBuildingStyle?: (file: FileRenderData) => BuildingStyle;
}

export interface BuildingStyle {
  color: number;
  emissive: number;
  shape: 'box' | 'cylinder' | 'hexagon' | 'database';
  heightMultiplier: number;
}

// Registry of file renderers
const renderers: Map<string, FileRenderer> = new Map();

/**
 * Register a file renderer
 */
export function registerRenderer(renderer: FileRenderer): void {
  for (const ext of renderer.extensions) {
    renderers.set(ext.toLowerCase(), renderer);
  }
}

/**
 * Get renderer for file type
 */
export function getRenderer(extension: string): FileRenderer {
  return renderers.get(extension.toLowerCase()) || defaultRenderer;
}

/**
 * Create texture for file
 */
export function createFileTexture(file: FileRenderData): THREE.Texture | null {
  const renderer = getRenderer(file.extension);
  return renderer.createTexture(file);
}

/**
 * Get building style for file
 */
export function getBuildingStyle(file: FileRenderData): BuildingStyle {
  const renderer = getRenderer(file.extension);
  return renderer.getBuildingStyle?.(file) || defaultRenderer.getBuildingStyle!(file);
}

// ============================================
// DEFAULT RENDERER
// ============================================

const defaultRenderer: FileRenderer = {
  extensions: ['*'],
  
  createTexture: (file: FileRenderData): THREE.Texture | null => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    // Dark background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 256, 256);
    
    // File name
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(truncate(file.name, 20), 128, 30);
    
    // Extension badge
    ctx.fillStyle = '#3178c6';
    ctx.fillRect(90, 45, 76, 24);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(file.extension || '?', 128, 62);
    
    // LOC info
    ctx.font = '12px monospace';
    ctx.fillStyle = '#888888';
    ctx.fillText(`${file.linesOfCode} lines`, 128, 90);
    
    return new THREE.CanvasTexture(canvas);
  },
  
  getBuildingStyle: (_file: FileRenderData): BuildingStyle => ({
    color: 0x4a4a6a,
    emissive: 0x1a1a3a,
    shape: 'box',
    heightMultiplier: 1,
  }),
};

// ============================================
// CODE FILE RENDERER (ts, js, py, etc.)
// ============================================

const codeRenderer: FileRenderer = {
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.rb'],
  
  createTexture: (file: FileRenderData): THREE.Texture | null => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Dark code editor background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, 256, 512);
    
    // Line numbers gutter
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, 35, 512);
    
    // Render code lines
    const lines = file.lines || file.content?.split('\n') || [];
    const maxLines = Math.min(25, lines.length);
    
    ctx.font = '11px monospace';
    
    for (let i = 0; i < maxLines; i++) {
      const y = 15 + i * 18;
      
      // Line number
      ctx.fillStyle = '#484f58';
      ctx.textAlign = 'right';
      ctx.fillText(String(i + 1), 30, y);
      
      // Code line with syntax highlighting simulation
      ctx.textAlign = 'left';
      const line = lines[i] || '';
      const colored = colorizeCode(line, file.extension);
      
      // Simple coloring
      ctx.fillStyle = colored.color;
      ctx.fillText(truncate(line, 28), 40, y);
    }
    
    // Fade at bottom if more lines
    if (lines.length > maxLines) {
      const gradient = ctx.createLinearGradient(0, 400, 0, 512);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(1, '#0d1117');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 400, 256, 112);
      
      ctx.fillStyle = '#666666';
      ctx.textAlign = 'center';
      ctx.fillText(`... ${lines.length - maxLines} more lines`, 128, 480);
    }
    
    return new THREE.CanvasTexture(canvas);
  },
  
  getBuildingStyle: (file: FileRenderData): BuildingStyle => {
    const colors: Record<string, number> = {
      '.ts': 0x3178c6,
      '.tsx': 0x61dafb,
      '.js': 0xf7df1e,
      '.jsx': 0x61dafb,
      '.py': 0x3776ab,
      '.go': 0x00add8,
      '.rs': 0xdea584,
      '.java': 0xb07219,
    };
    return {
      color: colors[file.extension] || 0x4a4a6a,
      emissive: 0x111122,
      shape: 'box',
      heightMultiplier: 1,
    };
  },
};

// ============================================
// HTML RENDERER
// ============================================

const htmlRenderer: FileRenderer = {
  extensions: ['.html', '.htm', '.vue', '.svelte'],
  
  createTexture: (file: FileRenderData): THREE.Texture | null => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    // Browser chrome
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, 0, 256, 256);
    
    // Title bar
    ctx.fillStyle = '#3c3c3c';
    ctx.fillRect(0, 0, 256, 30);
    
    // Traffic lights
    ctx.fillStyle = '#ff5f56';
    ctx.beginPath();
    ctx.arc(15, 15, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffbd2e';
    ctx.beginPath();
    ctx.arc(35, 15, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#27ca3f';
    ctx.beginPath();
    ctx.arc(55, 15, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Tab
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(70, 5, 100, 20);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(truncate(file.name, 15), 80, 18);
    
    // Content area - white page
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(5, 35, 246, 216);
    
    // Render simplified HTML structure
    const content = file.content || '';
    renderHtmlPreview(ctx, content, 10, 45, 236, 200);
    
    return new THREE.CanvasTexture(canvas);
  },
  
  getBuildingStyle: (_file: FileRenderData): BuildingStyle => ({
    color: 0xe34c26,
    emissive: 0x331100,
    shape: 'box',
    heightMultiplier: 0.8,
  }),
};

// ============================================
// IMAGE RENDERER
// ============================================

const imageRenderer: FileRenderer = {
  extensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'],
  
  createTexture: (file: FileRenderData): THREE.Texture | null => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    // Image frame
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(0, 0, 256, 256);
    
    // Frame border
    ctx.strokeStyle = '#4a4a5a';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 236, 200);
    
    // Image placeholder with icon
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(14, 14, 228, 192);
    
    // Image icon
    ctx.fillStyle = '#666677';
    ctx.beginPath();
    ctx.moveTo(100, 80);
    ctx.lineTo(156, 80);
    ctx.lineTo(156, 140);
    ctx.lineTo(100, 140);
    ctx.closePath();
    ctx.fill();
    
    // Mountain shape in icon
    ctx.fillStyle = '#888899';
    ctx.beginPath();
    ctx.moveTo(105, 130);
    ctx.lineTo(120, 100);
    ctx.lineTo(135, 120);
    ctx.lineTo(145, 95);
    ctx.lineTo(151, 130);
    ctx.closePath();
    ctx.fill();
    
    // Sun
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(145, 95, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // File name
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(truncate(file.name, 25), 128, 235);
    
    // Extension
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#888888';
    ctx.fillText(file.extension.toUpperCase(), 128, 250);
    
    return new THREE.CanvasTexture(canvas);
  },
  
  getBuildingStyle: (_file: FileRenderData): BuildingStyle => ({
    color: 0x9b59b6,
    emissive: 0x2a1a3a,
    shape: 'box',
    heightMultiplier: 0.6,
  }),
};

// ============================================
// DATABASE RENDERER
// ============================================

const databaseRenderer: FileRenderer = {
  extensions: ['.db', '.sqlite', '.sqlite3', '.sql', '.mdb'],
  
  createTexture: (file: FileRenderData): THREE.Texture | null => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    // Dark background
    ctx.fillStyle = '#0a1929';
    ctx.fillRect(0, 0, 256, 256);
    
    // Database cylinders
    ctx.fillStyle = '#1976d2';
    
    // Draw stacked cylinders
    for (let i = 0; i < 3; i++) {
      const y = 60 + i * 50;
      
      // Cylinder body
      ctx.fillStyle = '#1565c0';
      ctx.fillRect(78, y, 100, 40);
      
      // Top ellipse
      ctx.fillStyle = '#1976d2';
      ctx.beginPath();
      ctx.ellipse(128, y, 50, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Bottom ellipse
      ctx.fillStyle = '#0d47a1';
      ctx.beginPath();
      ctx.ellipse(128, y + 40, 50, 15, 0, 0, Math.PI);
      ctx.fill();
      
      // Highlight
      ctx.strokeStyle = '#42a5f5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(128, y, 50, 15, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Label
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('DATABASE', 128, 30);
    
    ctx.font = '12px monospace';
    ctx.fillStyle = '#90caf9';
    ctx.fillText(truncate(file.name, 20), 128, 240);
    
    return new THREE.CanvasTexture(canvas);
  },
  
  createDecoration: (_file: FileRenderData): THREE.Group => {
    // Create floating data particles around database
    const group = new THREE.Group();
    
    const particleCount = 20;
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 3 + Math.random() * 2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 2 + Math.random() * 4;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0x42a5f5,
      size: 0.3,
      transparent: true,
      opacity: 0.8,
    });
    
    const particles = new THREE.Points(geometry, material);
    particles.userData.isDataParticles = true;
    group.add(particles);
    
    return group;
  },
  
  getBuildingStyle: (_file: FileRenderData): BuildingStyle => ({
    color: 0x1976d2,
    emissive: 0x0d47a1,
    shape: 'database',
    heightMultiplier: 1.5,
  }),
};

// ============================================
// JSON/CONFIG RENDERER
// ============================================

const configRenderer: FileRenderer = {
  extensions: ['.json', '.yaml', '.yml', '.toml', '.xml', '.env', '.config'],
  
  createTexture: (file: FileRenderData): THREE.Texture | null => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    // Config file background
    ctx.fillStyle = '#1e2127';
    ctx.fillRect(0, 0, 256, 256);
    
    // Gear icon
    ctx.fillStyle = '#5c6370';
    drawGear(ctx, 128, 60, 30);
    
    // Config name
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#abb2bf';
    ctx.textAlign = 'center';
    ctx.fillText(truncate(file.name, 20), 128, 110);
    
    // Show some key-value pairs
    const content = file.content || '';
    const lines = content.split('\n').slice(0, 8);
    
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    
    lines.forEach((line, i) => {
      const y = 130 + i * 14;
      const trimmed = line.trim();
      
      if (trimmed.includes(':') || trimmed.includes('=')) {
        ctx.fillStyle = '#e06c75'; // Key color
        ctx.fillText(truncate(trimmed, 30), 20, y);
      } else {
        ctx.fillStyle = '#5c6370';
        ctx.fillText(truncate(trimmed, 30), 20, y);
      }
    });
    
    return new THREE.CanvasTexture(canvas);
  },
  
  getBuildingStyle: (_file: FileRenderData): BuildingStyle => ({
    color: 0x5a9a5a,
    emissive: 0x1a3a1a,
    shape: 'hexagon',
    heightMultiplier: 0.7,
  }),
};

// ============================================
// MARKDOWN RENDERER
// ============================================

const markdownRenderer: FileRenderer = {
  extensions: ['.md', '.mdx', '.markdown'],
  
  createTexture: (file: FileRenderData): THREE.Texture | null => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    // Paper background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, 256, 256);
    
    // Paper shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(250, 5, 6, 246);
    ctx.fillRect(5, 250, 246, 6);
    
    // Content
    const content = file.content || '';
    const lines = content.split('\n');
    
    ctx.textAlign = 'left';
    let y = 25;
    
    for (const line of lines) {
      if (y > 230) break;
      
      const trimmed = line.trim();
      
      if (trimmed.startsWith('# ')) {
        ctx.font = 'bold 16px serif';
        ctx.fillStyle = '#1a1a1a';
        ctx.fillText(truncate(trimmed.slice(2), 20), 15, y);
        y += 24;
      } else if (trimmed.startsWith('## ')) {
        ctx.font = 'bold 14px serif';
        ctx.fillStyle = '#333333';
        ctx.fillText(truncate(trimmed.slice(3), 22), 15, y);
        y += 20;
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        ctx.font = '11px serif';
        ctx.fillStyle = '#444444';
        ctx.fillText('• ' + truncate(trimmed.slice(2), 26), 20, y);
        y += 14;
      } else if (trimmed) {
        ctx.font = '11px serif';
        ctx.fillStyle = '#444444';
        ctx.fillText(truncate(trimmed, 28), 15, y);
        y += 14;
      } else {
        y += 8;
      }
    }
    
    return new THREE.CanvasTexture(canvas);
  },
  
  getBuildingStyle: (_file: FileRenderData): BuildingStyle => ({
    color: 0x083fa1,
    emissive: 0x021530,
    shape: 'box',
    heightMultiplier: 0.5,
  }),
};

// ============================================
// CSS/STYLE RENDERER
// ============================================

const styleRenderer: FileRenderer = {
  extensions: ['.css', '.scss', '.sass', '.less', '.styl'],
  
  createTexture: (file: FileRenderData): THREE.Texture | null => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    // Gradient background showing colors
    const gradient = ctx.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, '#264de4');
    gradient.addColorStop(0.5, '#2965f1');
    gradient.addColorStop(1, '#1a73e8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    
    // CSS3 shield icon
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(128, 20);
    ctx.lineTo(188, 50);
    ctx.lineTo(178, 150);
    ctx.lineTo(128, 180);
    ctx.lineTo(78, 150);
    ctx.lineTo(68, 50);
    ctx.closePath();
    ctx.fill();
    
    // CSS text
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('CSS', 128, 115);
    
    // File name
    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(truncate(file.name, 20), 128, 220);
    
    // LOC
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(`${file.linesOfCode} lines`, 128, 240);
    
    return new THREE.CanvasTexture(canvas);
  },
  
  getBuildingStyle: (_file: FileRenderData): BuildingStyle => ({
    color: 0x264de4,
    emissive: 0x0a1a4a,
    shape: 'box',
    heightMultiplier: 0.8,
  }),
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 2) + '..';
}

function colorizeCode(line: string, _ext: string): { color: string } {
  const trimmed = line.trim();
  
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
    return { color: '#6a9955' }; // Comment
  }
  if (trimmed.startsWith('import ') || trimmed.startsWith('from ') || trimmed.startsWith('export ')) {
    return { color: '#c586c0' }; // Import
  }
  if (trimmed.startsWith('function ') || trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ')) {
    return { color: '#569cd6' }; // Keyword
  }
  if (trimmed.startsWith('class ') || trimmed.startsWith('interface ')) {
    return { color: '#4ec9b0' }; // Type
  }
  if (trimmed.startsWith('return ') || trimmed.startsWith('if ') || trimmed.startsWith('for ') || trimmed.startsWith('while ')) {
    return { color: '#c586c0' }; // Control
  }
  
  return { color: '#d4d4d4' }; // Default
}

function renderHtmlPreview(
  ctx: CanvasRenderingContext2D,
  _content: string,
  x: number,
  y: number,
  _width: number,
  _height: number
): void {
  // Simplified HTML preview - show structure blocks
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(x + 10, y + 10, 200, 30); // Header
  
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(x + 10, y + 50, 60, 100); // Sidebar
  ctx.fillRect(x + 80, y + 50, 130, 100); // Main content
  
  ctx.fillStyle = '#d0d0d0';
  ctx.fillRect(x + 10, y + 160, 200, 25); // Footer
  
  // Labels
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#666666';
  ctx.fillText('header', x + 85, y + 28);
  ctx.fillText('nav', x + 25, y + 100);
  ctx.fillText('main', x + 125, y + 100);
  ctx.fillText('footer', x + 85, y + 178);
}

function drawGear(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const teeth = 8;
  const outerRadius = size;
  const innerRadius = size * 0.6;
  
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const angle = (i / (teeth * 2)) * Math.PI * 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  
  // Center hole
  ctx.fillStyle = '#1e2127';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================
// REGISTER ALL RENDERERS
// ============================================

registerRenderer(codeRenderer);
registerRenderer(htmlRenderer);
registerRenderer(imageRenderer);
registerRenderer(databaseRenderer);
registerRenderer(configRenderer);
registerRenderer(markdownRenderer);
registerRenderer(styleRenderer);

export { defaultRenderer };
