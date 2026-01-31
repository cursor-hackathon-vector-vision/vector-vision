import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export interface ScannedFile {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  directory: string;
  linesOfCode: number;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
}

// Directories to ignore
const IGNORE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '__pycache__',
  'venv',
  '.venv',
  'vendor',
  'target',
  '.idea',
  '.vscode',
  'coverage',
  '.cache',
  '.parcel-cache',
  'tmp',
  'temp',
];

// File extensions to include (text-based files)
const TEXT_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.css', '.scss', '.sass', '.less', '.styl',
  '.html', '.htm', '.vue', '.svelte', '.astro',
  '.json', '.yaml', '.yml', '.xml', '.toml',
  '.md', '.mdx', '.txt', '.rst',
  '.py', '.pyw', '.pyx',
  '.rs', '.go', '.rb', '.php',
  '.java', '.kt', '.kts', '.scala',
  '.c', '.cpp', '.h', '.hpp', '.cc',
  '.sh', '.bash', '.zsh', '.fish',
  '.sql', '.graphql', '.gql',
  '.env', '.gitignore', '.dockerignore',
  '.dockerfile', '.makefile',
];

export async function scanProject(projectPath: string): Promise<ScannedFile[]> {
  const files: ScannedFile[] = [];
  
  // Build ignore pattern
  const ignorePattern = IGNORE_DIRS.map(d => `**/${d}/**`);
  
  // Find all files
  const allFiles = await glob('**/*', {
    cwd: projectPath,
    nodir: true,
    ignore: ignorePattern,
    dot: false, // Ignore hidden files
    absolute: false,
  });
  
  for (const relativePath of allFiles) {
    const fullPath = path.join(projectPath, relativePath);
    const ext = path.extname(relativePath).toLowerCase();
    
    // Skip non-text files and very large files
    if (!TEXT_EXTENSIONS.includes(ext)) continue;
    
    try {
      const stats = fs.statSync(fullPath);
      
      // Skip files larger than 1MB
      if (stats.size > 1024 * 1024) continue;
      
      // Count lines
      const content = fs.readFileSync(fullPath, 'utf-8');
      const linesOfCode = content.split('\n').length;
      
      const fileName = path.basename(relativePath);
      const directory = '/' + path.dirname(relativePath);
      
      files.push({
        path: fullPath,
        relativePath: '/' + relativePath,
        name: fileName,
        extension: ext,
        directory: directory === '/.' ? '/' : directory,
        linesOfCode,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      });
      
    } catch (error) {
      // Skip files that can't be read
      console.debug(`Skipping file: ${relativePath}`, error);
    }
  }
  
  console.log(`Scanned ${files.length} files`);
  return files;
}

export function getProjectStats(files: ScannedFile[]): {
  totalFiles: number;
  totalLines: number;
  byExtension: Record<string, { count: number; lines: number }>;
  byDirectory: Record<string, number>;
} {
  const byExtension: Record<string, { count: number; lines: number }> = {};
  const byDirectory: Record<string, number> = {};
  let totalLines = 0;
  
  for (const file of files) {
    // By extension
    if (!byExtension[file.extension]) {
      byExtension[file.extension] = { count: 0, lines: 0 };
    }
    byExtension[file.extension].count++;
    byExtension[file.extension].lines += file.linesOfCode;
    
    // By directory
    if (!byDirectory[file.directory]) {
      byDirectory[file.directory] = 0;
    }
    byDirectory[file.directory]++;
    
    totalLines += file.linesOfCode;
  }
  
  return {
    totalFiles: files.length,
    totalLines,
    byExtension,
    byDirectory,
  };
}
