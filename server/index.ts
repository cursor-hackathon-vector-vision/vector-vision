import express from 'express';
import cors from 'cors';
import { scanProject } from './projectScanner';
import { getGitHistory } from './gitParser';
import { getCursorData } from './cursorParser';
import { discoverCursorProjects, getProjectConversations, quickScanForCursor } from './cursorDiscovery';
import { getUniversalHistory } from './universalHistoryParser';
import { getTranscripts, transcriptsToChatMessages } from './transcriptParser';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = 3333;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Validate and scan a project directory
app.post('/api/scan', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    // Resolve and validate path
    const resolvedPath = path.resolve(projectPath);
    
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Path does not exist', path: resolvedPath });
    }
    
    if (!fs.statSync(resolvedPath).isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }
    
    console.log(`Scanning project: ${resolvedPath}`);
    
    // Scan project files
    const files = await scanProject(resolvedPath);
    
    // Get Git history
    const gitHistory = await getGitHistory(resolvedPath);
    
    // Get Cursor data (legacy parser for backward compat)
    const cursorData = await getCursorData(resolvedPath);
    
    // Get Universal History (new comprehensive parser)
    const universalHistory = await getUniversalHistory(resolvedPath);
    
    // Get Agent Transcripts (the REAL conversations!)
    const transcripts = await getTranscripts(resolvedPath);
    const transcriptMessages = transcriptsToChatMessages(transcripts);
    console.log(`[Transcripts] Found ${transcripts.length} transcripts with ${transcriptMessages.length} messages`);
    
    // Build response
    const projectName = path.basename(resolvedPath);
    
    // Merge transcript messages with cursor data
    const allChats = [
      ...cursorData.chats,
      ...transcriptMessages,
    ];
    
    // Sort by timestamp and dedupe
    allChats.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    res.json({
      success: true,
      project: {
        name: projectName,
        path: resolvedPath,
        files,
        gitHistory,
        cursorData: {
          ...cursorData,
          chats: allChats, // Include transcript messages!
          conversationCount: cursorData.conversationCount + transcripts.length,
        },
        // New: Universal history with all sources
        history: universalHistory,
        // Also expose transcripts separately for granular access
        transcripts: {
          count: transcripts.length,
          totalMessages: transcriptMessages.length,
          ids: transcripts.map(t => t.id),
        }
      }
    });
    
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ 
      error: 'Failed to scan project',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get universal history for a project (all sources: transcripts, DB, JSON)
app.post('/api/history', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    const resolvedPath = path.resolve(projectPath);
    
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Path does not exist' });
    }
    
    console.log(`Getting universal history for: ${resolvedPath}`);
    
    const history = await getUniversalHistory(resolvedPath);
    
    res.json({
      success: true,
      history
    });
    
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ 
      error: 'Failed to get history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List recent/common project directories
app.get('/api/recent-paths', (_req, res) => {
  // Common development directories
  const homeDir = process.env.HOME || process.env.USERPROFILE || '/';
  const suggestions = [
    path.join(homeDir, 'projects'),
    path.join(homeDir, 'dev'),
    path.join(homeDir, 'code'),
    path.join(homeDir, 'Documents'),
    path.join(homeDir, 'workspace'),
    process.cwd(),
  ].filter(p => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  });
  
  res.json({ suggestions });
});

// Browse directory contents
app.post('/api/browse', (req, res) => {
  try {
    const { dirPath } = req.body;
    const targetPath = dirPath ? path.resolve(dirPath) : process.env.HOME || '/';
    
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Path does not exist' });
    }
    
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    
    const directories = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => ({
        name: e.name,
        path: path.join(targetPath, e.name),
        isGitRepo: fs.existsSync(path.join(targetPath, e.name, '.git'))
      }))
      .sort((a, b) => {
        // Git repos first
        if (a.isGitRepo && !b.isGitRepo) return -1;
        if (!a.isGitRepo && b.isGitRepo) return 1;
        return a.name.localeCompare(b.name);
      });
    
    res.json({
      currentPath: targetPath,
      parentPath: path.dirname(targetPath),
      directories
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to browse directory' });
  }
});

// Get file content
app.post('/api/file', (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const stats = fs.statSync(filePath);
    
    res.json({
      path: filePath,
      content,
      size: stats.size,
      modified: stats.mtime
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Get file contents for multiple files (for building generation)
app.post('/api/files-content', async (req, res) => {
  try {
    const { filePaths, projectPath } = req.body;
    
    if (!Array.isArray(filePaths) || !projectPath) {
      return res.status(400).json({ error: 'filePaths array and projectPath required' });
    }
    
    const results: Record<string, { content: string; lines: string[]; functions: string[]; imports: string[] }> = {};
    
    for (const relativePath of filePaths.slice(0, 50)) { // Limit to 50 files
      const fullPath = path.join(projectPath, relativePath.replace(/^\//, ''));
      
      try {
        if (!fs.existsSync(fullPath)) continue;
        
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n').slice(0, 100); // First 100 lines
        
        // Extract function names
        const functions = extractFunctions(content, relativePath);
        
        // Extract imports
        const imports = extractImports(content, relativePath);
        
        results[relativePath] = {
          content: content.slice(0, 5000), // First 5000 chars
          lines,
          functions,
          imports
        };
      } catch {
        // Skip unreadable files
      }
    }
    
    res.json({ success: true, files: results });
    
  } catch (error) {
    console.error('Files content error:', error);
    res.status(500).json({ error: 'Failed to read files' });
  }
});

function extractFunctions(content: string, filePath: string): string[] {
  const functions: string[] = [];
  const ext = path.extname(filePath).toLowerCase();
  
  // TypeScript/JavaScript
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) {
    // function declarations
    const funcMatches = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g) || [];
    functions.push(...funcMatches.map(m => m.split(/\s+/).pop() || ''));
    
    // arrow functions assigned to const/let
    const arrowMatches = content.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g) || [];
    functions.push(...arrowMatches.map(m => m.match(/(?:const|let|var)\s+(\w+)/)?.[1] || ''));
    
    // class methods
    const methodMatches = content.match(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/g) || [];
    functions.push(...methodMatches.map(m => m.match(/(\w+)\s*\(/)?.[1] || '').filter(m => !['if', 'for', 'while', 'switch', 'catch'].includes(m)));
  }
  
  // Python
  if (ext === '.py') {
    const pyFuncs = content.match(/def\s+(\w+)/g) || [];
    functions.push(...pyFuncs.map(m => m.replace('def ', '')));
  }
  
  return [...new Set(functions)].filter(f => f.length > 0).slice(0, 20);
}

function extractImports(content: string, filePath: string): string[] {
  const imports: string[] = [];
  const ext = path.extname(filePath).toLowerCase();
  
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) {
    // ES imports
    const importMatches = content.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g) || [];
    for (const m of importMatches) {
      const match = m.match(/from\s+['"]([^'"]+)['"]/);
      if (match && match[1].startsWith('.')) {
        imports.push(match[1]);
      }
    }
  }
  
  if (ext === '.py') {
    const pyImports = content.match(/from\s+(\S+)\s+import/g) || [];
    imports.push(...pyImports.map(m => m.replace(/from\s+/, '').replace(/\s+import.*/, '')));
  }
  
  return [...new Set(imports)].slice(0, 10);
}

// Discover Cursor projects
app.post('/api/discover', async (req, res) => {
  try {
    const { searchPaths } = req.body;
    
    console.log('Discovering Cursor projects...');
    const projects = await discoverCursorProjects(searchPaths);
    
    console.log(`Found ${projects.length} Cursor projects`);
    
    res.json({
      success: true,
      projects,
      count: projects.length
    });
    
  } catch (error) {
    console.error('Discovery error:', error);
    res.status(500).json({ error: 'Failed to discover projects' });
  }
});

// Quick scan for Cursor in specific directory
app.post('/api/quick-scan', async (req, res) => {
  try {
    const { basePath } = req.body;
    
    if (!basePath || !fs.existsSync(basePath)) {
      return res.status(400).json({ error: 'Invalid base path' });
    }
    
    const projectPaths = await quickScanForCursor(basePath);
    
    res.json({
      success: true,
      projectPaths,
      count: projectPaths.length
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Quick scan failed' });
  }
});

// Get conversations for a project
app.post('/api/conversations', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath || !fs.existsSync(projectPath)) {
      return res.status(400).json({ error: 'Invalid project path' });
    }
    
    const conversations = await getProjectConversations(projectPath);
    
    res.json({
      success: true,
      ...conversations
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Scan multiple projects at once
app.post('/api/scan-multi', async (req, res) => {
  try {
    const { projectPaths } = req.body;
    
    if (!Array.isArray(projectPaths) || projectPaths.length === 0) {
      return res.status(400).json({ error: 'Project paths array required' });
    }
    
    console.log(`Scanning ${projectPaths.length} projects...`);
    
    const results = await Promise.all(
      projectPaths.map(async (projectPath: string) => {
        try {
          const resolvedPath = path.resolve(projectPath);
          
          if (!fs.existsSync(resolvedPath)) {
            return { path: projectPath, error: 'Not found' };
          }
          
          const files = await scanProject(resolvedPath);
          const gitHistory = await getGitHistory(resolvedPath);
          const cursorData = await getCursorData(resolvedPath);
          
          return {
            success: true,
            project: {
              name: path.basename(resolvedPath),
              path: resolvedPath,
              files,
              gitHistory,
              cursorData
            }
          };
        } catch (error) {
          return { 
            path: projectPath, 
            error: error instanceof Error ? error.message : 'Scan failed' 
          };
        }
      })
    );
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`Scanned: ${successful.length} success, ${failed.length} failed`);
    
    res.json({
      success: true,
      projects: successful.map(r => r.project),
      errors: failed,
      totalScanned: projectPaths.length
    });
    
  } catch (error) {
    console.error('Multi-scan error:', error);
    res.status(500).json({ error: 'Multi-project scan failed' });
  }
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🏙️  Vector Vision Backend Server                    ║
║                                                       ║
║   Running on: http://localhost:${PORT}                  ║
║                                                       ║
║   Endpoints:                                          ║
║   - POST /api/scan     - Scan a project directory     ║
║   - POST /api/browse   - Browse directories           ║
║   - GET  /api/recent-paths - Get suggested paths      ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`);
});
