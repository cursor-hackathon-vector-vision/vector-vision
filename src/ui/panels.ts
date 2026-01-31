import { store, getState } from '../store';
import type { ChatMessage, FileNode, ProjectSnapshot } from '../types';

/**
 * UI Panels Manager - Creates and manages sidebar panels for file list and chat
 */
export class UIPanels {
  private fileListEl: HTMLElement;
  private chatPanelEl: HTMLElement;
  private chatExpandedEl: HTMLElement;
  
  constructor() {
    this.fileListEl = this.createFileListPanel();
    this.chatPanelEl = this.createChatPanel();
    this.chatExpandedEl = this.createExpandedChatModal();
    
    document.body.appendChild(this.fileListEl);
    document.body.appendChild(this.chatPanelEl);
    document.body.appendChild(this.chatExpandedEl);
    
    // Subscribe to store changes
    store.subscribe((state, prevState) => {
      if (state.showFileList !== prevState.showFileList) {
        this.fileListEl.classList.toggle('hidden', !state.showFileList);
      }
      if (state.showChatPanel !== prevState.showChatPanel) {
        this.chatPanelEl.classList.toggle('hidden', !state.showChatPanel);
      }
      if (state.expandedChat !== prevState.expandedChat) {
        this.updateExpandedChat(state.expandedChat);
      }
    });
  }
  
  private createFileListPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'file-list-panel';
    panel.className = 'side-panel left-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <h3>📁 Files</h3>
        <div class="panel-stats">
          <span id="file-count">0 files</span>
          <span id="total-loc">0 LOC</span>
        </div>
        <button class="panel-close" data-panel="files">×</button>
      </div>
      <div class="panel-search">
        <input type="text" placeholder="Search files..." id="file-search" />
      </div>
      <div class="file-tree" id="file-tree"></div>
      <div class="panel-footer">
        <div class="growth-indicator">
          <span class="growth-label">Growth</span>
          <div class="growth-bar"><div class="growth-fill" id="growth-fill"></div></div>
          <span class="growth-value" id="growth-value">+0%</span>
        </div>
      </div>
    `;
    
    // Close button handler
    panel.querySelector('.panel-close')?.addEventListener('click', () => {
      store.getState().setShowFileList(false);
    });
    
    // Search handler
    const searchInput = panel.querySelector('#file-search') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.filterFiles(searchInput.value);
    });
    
    return panel;
  }
  
  private createChatPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'chat-panel';
    panel.className = 'side-panel right-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <h3>💬 AI Conversations</h3>
        <div class="panel-stats">
          <span id="chat-count">0 messages</span>
        </div>
        <button class="panel-close" data-panel="chat">×</button>
      </div>
      <div class="agent-tabs" id="agent-tabs">
        <button class="agent-tab active" data-agent="all">All</button>
      </div>
      <div class="chat-list" id="chat-list"></div>
      <div class="panel-footer">
        <div class="chat-timeline">
          <span class="timeline-label">Timeline</span>
          <div class="mini-timeline" id="chat-mini-timeline"></div>
        </div>
      </div>
    `;
    
    // Close button handler
    panel.querySelector('.panel-close')?.addEventListener('click', () => {
      store.getState().setShowChatPanel(false);
    });
    
    return panel;
  }
  
  private createExpandedChatModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.id = 'chat-expanded-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <span class="chat-role" id="modal-role">User</span>
          <span class="chat-time" id="modal-time"></span>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body" id="modal-body"></div>
        <div class="modal-footer">
          <div class="related-files" id="modal-related-files"></div>
        </div>
      </div>
    `;
    
    // Close handlers
    modal.querySelector('.modal-overlay')?.addEventListener('click', () => {
      store.getState().setExpandedChat(null);
    });
    modal.querySelector('.modal-close')?.addEventListener('click', () => {
      store.getState().setExpandedChat(null);
    });
    
    return modal;
  }
  
  /**
   * Update file list for current snapshot
   */
  public updateFiles(snapshot: ProjectSnapshot, prevSnapshot?: ProjectSnapshot): void {
    const fileTree = this.fileListEl.querySelector('#file-tree')!;
    const fileCount = this.fileListEl.querySelector('#file-count')!;
    const totalLoc = this.fileListEl.querySelector('#total-loc')!;
    const growthFill = this.fileListEl.querySelector('#growth-fill') as HTMLElement;
    const growthValue = this.fileListEl.querySelector('#growth-value')!;
    
    // Calculate stats
    const files = snapshot.files;
    const totalLines = files.reduce((sum, f) => sum + f.linesOfCode, 0);
    const prevLines = prevSnapshot?.files.reduce((sum, f) => sum + f.linesOfCode, 0) || 0;
    
    fileCount.textContent = `${files.length} files`;
    totalLoc.textContent = `${totalLines.toLocaleString()} LOC`;
    
    // Calculate growth
    const growth = prevLines > 0 ? ((totalLines - prevLines) / prevLines) * 100 : 100;
    const growthPercent = Math.min(100, Math.abs(growth));
    growthFill.style.width = `${growthPercent}%`;
    growthFill.className = `growth-fill ${growth >= 0 ? 'positive' : 'negative'}`;
    growthValue.textContent = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
    
    // Build file tree
    const tree = this.buildFileTree(files);
    fileTree.innerHTML = tree;
    
    // Add click handlers
    fileTree.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', () => {
        const path = item.getAttribute('data-path');
        if (path) {
          this.highlightFile(path);
        }
      });
    });
  }
  
  private buildFileTree(files: FileNode[]): string {
    // Group by directory
    const dirs = new Map<string, FileNode[]>();
    
    for (const file of files) {
      const dir = file.directory || '/';
      if (!dirs.has(dir)) {
        dirs.set(dir, []);
      }
      dirs.get(dir)!.push(file);
    }
    
    let html = '';
    
    // Sort directories
    const sortedDirs = Array.from(dirs.keys()).sort();
    
    for (const dir of sortedDirs) {
      const dirFiles = dirs.get(dir)!;
      const dirLoc = dirFiles.reduce((sum, f) => sum + f.linesOfCode, 0);
      
      html += `
        <div class="dir-group">
          <div class="dir-header">
            <span class="dir-icon">📂</span>
            <span class="dir-name">${dir}</span>
            <span class="dir-loc">${dirLoc} LOC</span>
          </div>
          <div class="dir-files">
      `;
      
      for (const file of dirFiles) {
        const statusClass = file.status || 'unchanged';
        const icon = this.getFileIcon(file.extension);
        
        html += `
          <div class="file-item ${statusClass}" data-path="${file.path}">
            <span class="file-icon">${icon}</span>
            <span class="file-name">${file.name}</span>
            <span class="file-loc">${file.linesOfCode}</span>
            ${file.status === 'added' ? '<span class="file-badge new">NEW</span>' : ''}
            ${file.status === 'modified' ? '<span class="file-badge mod">MOD</span>' : ''}
          </div>
        `;
      }
      
      html += '</div></div>';
    }
    
    return html;
  }
  
  private getFileIcon(ext: string): string {
    const icons: Record<string, string> = {
      '.ts': '🟦',
      '.tsx': '⚛️',
      '.js': '🟨',
      '.jsx': '⚛️',
      '.css': '🎨',
      '.scss': '🎨',
      '.html': '🌐',
      '.json': '📋',
      '.md': '📝',
      '.py': '🐍',
      '.rs': '🦀',
      '.go': '🐹',
    };
    return icons[ext] || '📄';
  }
  
  private filterFiles(query: string): void {
    const items = this.fileListEl.querySelectorAll('.file-item');
    const lowerQuery = query.toLowerCase();
    
    items.forEach(item => {
      const name = item.querySelector('.file-name')?.textContent?.toLowerCase() || '';
      const match = name.includes(lowerQuery);
      (item as HTMLElement).style.display = match ? '' : 'none';
    });
  }
  
  private highlightFile(path: string): void {
    // Dispatch event for 3D scene to highlight
    window.dispatchEvent(new CustomEvent('highlight-file', { detail: { path } }));
  }
  
  /**
   * Update chat list for current snapshot
   */
  public updateChats(chats: ChatMessage[], allChats: ChatMessage[] = []): void {
    const chatList = this.chatPanelEl.querySelector('#chat-list')!;
    const chatCount = this.chatPanelEl.querySelector('#chat-count')!;
    const agentTabs = this.chatPanelEl.querySelector('#agent-tabs')!;
    const miniTimeline = this.chatPanelEl.querySelector('#chat-mini-timeline')!;
    
    chatCount.textContent = `${chats.length} messages`;
    
    // Build agent tabs
    const agents = new Set(chats.map(c => c.model || 'unknown'));
    let tabsHtml = '<button class="agent-tab active" data-agent="all">All</button>';
    agents.forEach(agent => {
      tabsHtml += `<button class="agent-tab" data-agent="${agent}">${this.formatAgentName(agent)}</button>`;
    });
    agentTabs.innerHTML = tabsHtml;
    
    // Add tab click handlers
    agentTabs.querySelectorAll('.agent-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        agentTabs.querySelectorAll('.agent-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.filterChatsByAgent(tab.getAttribute('data-agent') || 'all');
      });
    });
    
    // Build chat list (limit to 100 for performance)
    const maxChats = 100;
    const displayChats = chats.slice(-maxChats); // Show most recent
    chatList.innerHTML = displayChats.map((chat, index) => this.renderChatItem(chat, index)).join('');
    
    if (chats.length > maxChats) {
      chatList.innerHTML = `<div class="chat-info">Showing ${maxChats} of ${chats.length} messages</div>` + chatList.innerHTML;
    }
    
    // Add click handlers to expand
    chatList.querySelectorAll('.chat-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        store.getState().setExpandedChat(displayChats[index]);
      });
    });
    
    // Build mini timeline
    if (allChats.length > 0) {
      const timelineHtml = this.buildMiniTimeline(allChats, chats);
      miniTimeline.innerHTML = timelineHtml;
    }
  }
  
  private renderChatItem(chat: ChatMessage, index: number): string {
    const roleClass = chat.role === 'user' ? 'user' : 'assistant';
    const roleIcon = chat.role === 'user' ? '👤' : '🤖';
    const time = chat.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const preview = chat.content.slice(0, 100) + (chat.content.length > 100 ? '...' : '');
    
    return `
      <div class="chat-item ${roleClass}" data-index="${index}">
        <div class="chat-header">
          <span class="chat-icon">${roleIcon}</span>
          <span class="chat-role">${chat.role}</span>
          ${chat.model ? `<span class="chat-model">${this.formatAgentName(chat.model)}</span>` : ''}
          <span class="chat-time">${time}</span>
        </div>
        <div class="chat-preview">${this.escapeHtml(preview)}</div>
        ${chat.relatedFiles.length > 0 ? `
          <div class="chat-files">
            ${chat.relatedFiles.slice(0, 3).map(f => `<span class="file-tag">${f.split('/').pop()}</span>`).join('')}
            ${chat.relatedFiles.length > 3 ? `<span class="file-tag more">+${chat.relatedFiles.length - 3}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  private buildMiniTimeline(allChats: ChatMessage[], currentChats: ChatMessage[]): string {
    if (allChats.length === 0) return '';
    
    const currentIds = new Set(currentChats.map(c => c.id));
    
    // Limit to max 200 dots to prevent memory issues
    const maxDots = 200;
    const step = allChats.length > maxDots ? Math.ceil(allChats.length / maxDots) : 1;
    const sampledChats = allChats.filter((_, i) => i % step === 0).slice(0, maxDots);
    
    return sampledChats.map(chat => {
      const isActive = currentIds.has(chat.id);
      const roleClass = chat.role === 'user' ? 'user' : 'assistant';
      return `<div class="timeline-dot ${roleClass} ${isActive ? 'active' : ''}" title="${chat.content?.slice(0, 50) || ''}"></div>`;
    }).join('');
  }
  
  private formatAgentName(model: string): string {
    if (model.includes('gpt-4')) return 'GPT-4';
    if (model.includes('gpt-3')) return 'GPT-3.5';
    if (model.includes('claude')) return 'Claude';
    if (model.includes('cursor')) return 'Cursor';
    return model.split('/').pop() || model;
  }
  
  private filterChatsByAgent(agent: string): void {
    const items = this.chatPanelEl.querySelectorAll('.chat-item');
    
    items.forEach(item => {
      if (agent === 'all') {
        (item as HTMLElement).style.display = '';
      } else {
        const model = item.querySelector('.chat-model')?.textContent || '';
        const match = model.includes(agent) || agent === 'unknown';
        (item as HTMLElement).style.display = match ? '' : 'none';
      }
    });
  }
  
  private updateExpandedChat(chat: ChatMessage | null): void {
    if (!chat) {
      this.chatExpandedEl.classList.add('hidden');
      return;
    }
    
    this.chatExpandedEl.classList.remove('hidden');
    
    const roleEl = this.chatExpandedEl.querySelector('#modal-role')!;
    const timeEl = this.chatExpandedEl.querySelector('#modal-time')!;
    const bodyEl = this.chatExpandedEl.querySelector('#modal-body')!;
    const filesEl = this.chatExpandedEl.querySelector('#modal-related-files')!;
    
    roleEl.textContent = chat.role === 'user' ? '👤 User' : '🤖 Assistant';
    roleEl.className = `chat-role ${chat.role}`;
    timeEl.textContent = chat.timestamp.toLocaleString();
    
    // Render content with code highlighting
    bodyEl.innerHTML = this.formatChatContent(chat.content);
    
    // Related files
    if (chat.relatedFiles.length > 0) {
      filesEl.innerHTML = `
        <div class="related-label">Related Files:</div>
        ${chat.relatedFiles.map(f => `
          <span class="related-file" data-path="${f}">${f}</span>
        `).join('')}
      `;
      
      filesEl.querySelectorAll('.related-file').forEach(el => {
        el.addEventListener('click', () => {
          const path = el.getAttribute('data-path');
          if (path) this.highlightFile(path);
        });
      });
    } else {
      filesEl.innerHTML = '';
    }
  }
  
  private formatChatContent(content: string): string {
    // Escape HTML first
    let formatted = this.escapeHtml(content);
    
    // Format code blocks
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre class="code-block ${lang || ''}"><code>${code}</code></pre>`;
    });
    
    // Format inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // Format line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
  }
  
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  
  /**
   * Toggle panel visibility
   */
  public toggleFileList(): void {
    const current = getState().showFileList;
    store.getState().setShowFileList(!current);
  }
  
  public toggleChatPanel(): void {
    const current = getState().showChatPanel;
    store.getState().setShowChatPanel(!current);
  }
}
