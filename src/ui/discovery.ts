import { api, DiscoveredProject } from '../api/client';
import { store } from '../store';
import { loadProjectFromBackend } from '../data/projectLoader';

/**
 * Discovery Panel for finding and loading Cursor projects
 */
export class DiscoveryPanel {
  private element: HTMLElement;
  private isOpen: boolean = false;
  private projects: DiscoveredProject[] = [];
  private selectedProjects: Set<string> = new Set();
  private isScanning: boolean = false;
  
  constructor() {
    this.element = this.createPanel();
    document.body.appendChild(this.element);
  }
  
  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'discovery-panel';
    panel.className = 'discovery-panel hidden';
    panel.innerHTML = `
      <div class="discovery-header">
        <h2>🔍 Discover Cursor Projects</h2>
        <button class="discovery-close">×</button>
      </div>
      
      <div class="discovery-body">
        <div class="discovery-actions">
          <button id="btn-scan-all" class="action-btn primary">
            <span class="btn-icon">🔎</span>
            Scan for Projects
          </button>
          <div class="scan-path-input">
            <input type="text" id="scan-path" placeholder="Custom search path..." />
            <button id="btn-scan-path">Scan</button>
          </div>
        </div>
        
        <div class="discovery-status" id="discovery-status"></div>
        
        <div class="discovered-list" id="discovered-list">
          <div class="empty-state">
            <span class="empty-icon">📂</span>
            <p>Click "Scan for Projects" to find Cursor projects</p>
          </div>
        </div>
      </div>
      
      <div class="discovery-footer">
        <div class="selection-info">
          <span id="selection-count">0 selected</span>
        </div>
        <button id="btn-load-selected" class="action-btn" disabled>
          Load Selected Projects
        </button>
      </div>
    `;
    
    // Event listeners
    panel.querySelector('.discovery-close')?.addEventListener('click', () => this.close());
    panel.querySelector('#btn-scan-all')?.addEventListener('click', () => this.scanForProjects());
    panel.querySelector('#btn-scan-path')?.addEventListener('click', () => this.scanCustomPath());
    panel.querySelector('#btn-load-selected')?.addEventListener('click', () => this.loadSelectedProjects());
    
    // Enter key in path input
    const pathInput = panel.querySelector('#scan-path') as HTMLInputElement;
    pathInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.scanCustomPath();
    });
    
    return panel;
  }
  
  public open(): void {
    this.isOpen = true;
    this.element.classList.remove('hidden');
  }
  
  public close(): void {
    this.isOpen = false;
    this.element.classList.add('hidden');
  }
  
  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
  
  private async scanForProjects(): Promise<void> {
    if (this.isScanning) return;
    
    this.isScanning = true;
    this.updateStatus('Scanning for Cursor projects...', 'loading');
    
    try {
      this.projects = await api.discoverProjects();
      this.renderProjects();
      this.updateStatus(`Found ${this.projects.length} Cursor projects`, 'success');
    } catch (error) {
      console.error('Scan failed:', error);
      this.updateStatus('Scan failed. Make sure backend is running.', 'error');
    } finally {
      this.isScanning = false;
    }
  }
  
  private async scanCustomPath(): Promise<void> {
    const pathInput = this.element.querySelector('#scan-path') as HTMLInputElement;
    const customPath = pathInput.value.trim();
    
    if (!customPath) return;
    
    if (this.isScanning) return;
    
    this.isScanning = true;
    this.updateStatus(`Scanning ${customPath}...`, 'loading');
    
    try {
      this.projects = await api.discoverProjects([customPath]);
      this.renderProjects();
      this.updateStatus(`Found ${this.projects.length} projects in custom path`, 'success');
    } catch (error) {
      console.error('Custom scan failed:', error);
      this.updateStatus('Scan failed. Check the path and try again.', 'error');
    } finally {
      this.isScanning = false;
    }
  }
  
  private renderProjects(): void {
    const listEl = this.element.querySelector('#discovered-list')!;
    
    if (this.projects.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔍</span>
          <p>No Cursor projects found</p>
        </div>
      `;
      return;
    }
    
    listEl.innerHTML = this.projects.map(project => this.renderProjectItem(project)).join('');
    
    // Add click handlers
    listEl.querySelectorAll('.project-item').forEach(item => {
      const checkbox = item.querySelector('.project-checkbox') as HTMLInputElement;
      const path = item.getAttribute('data-path')!;
      
      // Checkbox change
      checkbox?.addEventListener('change', () => {
        if (checkbox.checked) {
          this.selectedProjects.add(path);
        } else {
          this.selectedProjects.delete(path);
        }
        this.updateSelectionCount();
      });
      
      // Double click to load single project
      item.addEventListener('dblclick', () => {
        this.loadSingleProject(path);
      });
    });
  }
  
  private renderProjectItem(project: DiscoveredProject): string {
    const lastModified = new Date(project.lastModified).toLocaleDateString();
    const agentTypes = new Set(project.agentSessions.map(s => s.type));
    
    return `
      <div class="project-item" data-path="${project.path}">
        <input type="checkbox" class="project-checkbox" />
        <div class="project-info">
          <div class="project-name">
            ${project.hasGit ? '📂' : '📁'} ${project.name}
            ${project.hasGit ? '<span class="tag git">Git</span>' : ''}
            ${project.hasCursor ? '<span class="tag cursor">Cursor</span>' : ''}
          </div>
          <div class="project-path">${project.path}</div>
          <div class="project-meta">
            <span>📅 ${lastModified}</span>
            <span>💬 ${project.conversationCount} conversations</span>
            ${project.agentSessions.length > 0 ? `
              <span class="agents">
                ${Array.from(agentTypes).map(t => this.getAgentIcon(t)).join('')}
              </span>
            ` : ''}
          </div>
        </div>
        <button class="quick-load" title="Load this project">▶</button>
      </div>
    `;
  }
  
  private getAgentIcon(type: string): string {
    const icons: Record<string, string> = {
      'chat': '💬',
      'composer': '🎼',
      'agent': '🤖',
      'unknown': '❓'
    };
    return `<span class="agent-icon" title="${type}">${icons[type] || icons.unknown}</span>`;
  }
  
  private updateStatus(message: string, type: 'loading' | 'success' | 'error'): void {
    const statusEl = this.element.querySelector('#discovery-status')!;
    statusEl.className = `discovery-status ${type}`;
    statusEl.innerHTML = `
      ${type === 'loading' ? '<span class="spinner"></span>' : ''}
      ${message}
    `;
  }
  
  private updateSelectionCount(): void {
    const countEl = this.element.querySelector('#selection-count')!;
    const loadBtn = this.element.querySelector('#btn-load-selected') as HTMLButtonElement;
    
    countEl.textContent = `${this.selectedProjects.size} selected`;
    loadBtn.disabled = this.selectedProjects.size === 0;
  }
  
  private async loadSingleProject(path: string): Promise<void> {
    this.updateStatus(`Loading ${path}...`, 'loading');
    
    try {
      const projectData = await loadProjectFromBackend(path);
      store.getState().addProject(projectData);
      store.getState().setProjectData(projectData);
      
      this.updateStatus('Project loaded!', 'success');
      
      // Close after short delay
      setTimeout(() => this.close(), 500);
      
    } catch (error) {
      console.error('Failed to load project:', error);
      this.updateStatus('Failed to load project', 'error');
    }
  }
  
  private async loadSelectedProjects(): Promise<void> {
    if (this.selectedProjects.size === 0) return;
    
    const paths = Array.from(this.selectedProjects);
    this.updateStatus(`Loading ${paths.length} projects...`, 'loading');
    
    try {
      const result = await api.scanMultipleProjects(paths);
      
      // Add each project to store
      for (const projectResult of result.projects) {
        const projectData = await loadProjectFromBackend(projectResult.path);
        store.getState().addProject(projectData);
      }
      
      // Set first as active
      if (result.projects.length > 0) {
        const firstProject = await loadProjectFromBackend(result.projects[0].path);
        store.getState().setProjectData(firstProject);
      }
      
      this.updateStatus(`Loaded ${result.projects.length} projects!`, 'success');
      
      // Build unified timeline
      store.getState().buildUnifiedTimeline();
      
      // Close panel
      setTimeout(() => this.close(), 500);
      
    } catch (error) {
      console.error('Failed to load projects:', error);
      this.updateStatus('Failed to load some projects', 'error');
    }
  }
}
