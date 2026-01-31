import simpleGit, { SimpleGit, LogResult, DefaultLogFields } from 'simple-git';
import path from 'path';
import fs from 'fs';

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  files: GitFileChange[];
}

export interface GitFileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions?: number;
  deletions?: number;
}

export interface GitHistory {
  isGitRepo: boolean;
  branch?: string;
  commits: GitCommit[];
  totalCommits: number;
}

export async function getGitHistory(projectPath: string, maxCommits: number = 100): Promise<GitHistory> {
  const gitDir = path.join(projectPath, '.git');
  
  if (!fs.existsSync(gitDir)) {
    console.log('Not a git repository');
    return {
      isGitRepo: false,
      commits: [],
      totalCommits: 0
    };
  }
  
  const git: SimpleGit = simpleGit(projectPath);
  
  try {
    // Get current branch
    const branchResult = await git.branch();
    const currentBranch = branchResult.current;
    
    // Get commit log with file stats
    const log: LogResult<DefaultLogFields> = await git.log({
      maxCount: maxCommits,
      '--stat': null,
    });
    
    const commits: GitCommit[] = [];
    
    for (const entry of log.all) {
      // Get detailed diff for this commit
      let fileChanges: GitFileChange[] = [];
      
      try {
        const diffSummary = await git.diffSummary([`${entry.hash}^`, entry.hash]);
        
        fileChanges = diffSummary.files.map(f => ({
          path: '/' + f.file,
          status: getFileStatus(f),
          additions: 'insertions' in f ? f.insertions : undefined,
          deletions: 'deletions' in f ? f.deletions : undefined,
        }));
      } catch {
        // First commit or other error - try different approach
        try {
          const show = await git.show([entry.hash, '--name-status', '--format=']);
          fileChanges = parseNameStatus(show);
        } catch {
          // Ignore
        }
      }
      
      commits.push({
        hash: entry.hash,
        shortHash: entry.hash.substring(0, 7),
        message: entry.message,
        author: entry.author_name,
        email: entry.author_email,
        date: new Date(entry.date),
        files: fileChanges,
      });
    }
    
    console.log(`Found ${commits.length} commits`);
    
    return {
      isGitRepo: true,
      branch: currentBranch,
      commits,
      totalCommits: commits.length,
    };
    
  } catch (error) {
    console.error('Git error:', error);
    return {
      isGitRepo: true,
      commits: [],
      totalCommits: 0,
    };
  }
}

function getFileStatus(file: { file: string; changes?: number; insertions?: number; deletions?: number; binary?: boolean }): GitFileChange['status'] {
  // Heuristic based on changes
  if (file.insertions && !file.deletions) return 'added';
  if (file.deletions && !file.insertions) return 'deleted';
  return 'modified';
}

function parseNameStatus(output: string): GitFileChange[] {
  const lines = output.trim().split('\n').filter(l => l.length > 0);
  const changes: GitFileChange[] = [];
  
  for (const line of lines) {
    const match = line.match(/^([ADMR])\t(.+)$/);
    if (match) {
      const [, status, filePath] = match;
      changes.push({
        path: '/' + filePath,
        status: statusMap[status] || 'modified',
      });
    }
  }
  
  return changes;
}

const statusMap: Record<string, GitFileChange['status']> = {
  'A': 'added',
  'D': 'deleted',
  'M': 'modified',
  'R': 'renamed',
};

export async function getFileDiff(projectPath: string, commitHash: string, filePath: string): Promise<string> {
  const git: SimpleGit = simpleGit(projectPath);
  
  try {
    const diff = await git.show([commitHash, '--', filePath]);
    return diff;
  } catch {
    return '';
  }
}
