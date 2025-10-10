// Download Manager Module
// Manages download tasks with progress tracking and UI updates

import { formatSize, formatSpeed } from './utils.js';

export class DownloadManager {
  constructor(statusCallback) {
    this.tasks = new Map(); // taskId -> task object
    this.taskIdCounter = 0;
    this.statusCallback = statusCallback; // Function to show status messages
    this.hlsDownloader = null; // Will be set externally
    this.setupMessageListener();
  }
  
  setHLSDownloader(downloader) {
    this.hlsDownloader = downloader;
  }
  
  setupMessageListener() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'downloadProgress') {
        this.handleProgressUpdate(message);
      } else if (message.action === 'downloadComplete') {
        this.handleDownloadComplete(message);
      } else if (message.action === 'downloadError') {
        this.handleDownloadError(message);
      }
    });
  }
  
  async startDirectDownload(url, filename, videoInfo) {
    const taskId = `task_${++this.taskIdCounter}_${Date.now()}`;
    
    const task = {
      id: taskId,
      type: 'direct',
      url: url,
      filename: filename,
      videoInfo: videoInfo,
      status: 'starting',
      progress: 0,
      bytesReceived: 0,
      totalBytes: 0,
      speed: 0,
      startTime: Date.now(),
      downloadId: null,
      error: null
    };
    
    this.tasks.set(taskId, task);
    this.updateTaskUI(task);
    
    try {
      // Request download through background script
      const response = await chrome.runtime.sendMessage({
        action: 'startDownload',
        url: url,
        filename: filename,
        taskId: taskId
      });
      
      if (response.success) {
        task.downloadId = response.downloadId;
        task.status = 'downloading';
        this.updateTaskUI(task);
        return { success: true, taskId: taskId };
      } else {
        task.status = 'error';
        task.error = response.error;
        this.updateTaskUI(task);
        return { success: false, error: response.error };
      }
    } catch (error) {
      task.status = 'error';
      task.error = error.message;
      this.updateTaskUI(task);
      return { success: false, error: error.message };
    }
  }
  
  async startRecordingDownload(video, index, tabId) {
    const taskId = `record_${++this.taskIdCounter}_${Date.now()}`;
    
    const task = {
      id: taskId,
      type: 'recording',
      video: video,
      index: index,
      tabId: tabId,
      status: 'preparing',
      progress: 0,
      startTime: Date.now(),
      error: null
    };
    
    this.tasks.set(taskId, task);
    this.updateTaskUI(task);
    
    return taskId;
  }
  
  async startSegmentedDownload(url, filename, videoInfo, videoIndex = 0) {
    const taskId = `hls_${++this.taskIdCounter}_${Date.now()}`;
    
    const task = {
      id: taskId,
      type: 'segmented',
      url: url,
      filename: filename,
      videoInfo: videoInfo,
      videoIndex: videoIndex, // For individual progress bar
      status: 'parsing',
      progress: 0,
      segment: 0,
      totalSegments: 0,
      message: 'Parsing manifest...',
      startTime: Date.now(),
      error: null
    };
    
    this.tasks.set(taskId, task);
    this.updateTaskUI(task);
    
    if (!this.hlsDownloader) {
      const error = 'HLS downloader not initialized';
      task.status = 'error';
      task.error = error;
      this.updateTaskUI(task);
      return { success: false, error: error };
    }
    
    // Start HLS download
    const result = await this.hlsDownloader.downloadSegmentedVideo(
      url, 
      filename, 
      videoInfo,
      (progressInfo) => {
        task.status = progressInfo.stage;
        task.progress = Math.round(progressInfo.progress);
        task.message = progressInfo.message;
        task.segment = progressInfo.segment || 0;
        task.totalSegments = progressInfo.totalSegments || 0;
        
        if (progressInfo.stage === 'completed') {
          task.status = 'completed';
          task.endTime = Date.now();
          task.size = progressInfo.size;
        } else if (progressInfo.stage === 'error') {
          task.status = 'error';
          task.error = progressInfo.message;
        }
        
        this.updateTaskUI(task);
      }
    );
    
    if (result.success) {
      if (this.statusCallback) {
        this.statusCallback(`✓ Video downloaded! (${Math.round(result.size / 1024 / 1024)}MB)`, 'success');
      }
      setTimeout(() => this.removeTask(taskId), 5000);
    } else {
      if (this.statusCallback) {
        this.statusCallback(`✗ Download failed: ${result.error}`, 'error');
      }
    }
    
    return { 
      success: result.success, 
      taskId: taskId,
      hadSeparateAudio: result.hadSeparateAudio || false
    };
  }
  
  handleProgressUpdate(message) {
    const { taskId, progress, bytesReceived, totalBytes, speed } = message;
    const task = this.tasks.get(taskId);
    
    if (task) {
      task.progress = Math.round(progress);
      task.bytesReceived = bytesReceived;
      task.totalBytes = totalBytes;
      task.speed = speed;
      task.status = 'downloading';
      this.updateTaskUI(task);
    }
  }
  
  handleDownloadComplete(message) {
    const { taskId } = message;
    const task = this.tasks.get(taskId);
    
    if (task) {
      task.status = 'completed';
      task.progress = 100;
      task.endTime = Date.now();
      this.updateTaskUI(task);
      
      // Show success notification
      if (this.statusCallback) {
        this.statusCallback(`✓ ${task.filename} downloaded!`, 'success');
      }
      
      // Remove from UI after delay
      setTimeout(() => {
        this.removeTask(taskId);
      }, 5000);
    }
  }
  
  handleDownloadError(message) {
    const { taskId, error } = message;
    const task = this.tasks.get(taskId);
    
    if (task) {
      task.status = 'error';
      task.error = error;
      this.updateTaskUI(task);
      
      if (this.statusCallback) {
        this.statusCallback(`✗ Download failed: ${error}`, 'error');
      }
    }
  }
  
  async cancelDownload(taskId) {
    const task = this.tasks.get(taskId);
    
    if (task && task.downloadId) {
      try {
        await chrome.runtime.sendMessage({
          action: 'cancelDownload',
          downloadId: task.downloadId
        });
        
        task.status = 'cancelled';
        this.updateTaskUI(task);
        
        setTimeout(() => {
          this.removeTask(taskId);
        }, 2000);
      } catch (error) {
        console.error('Failed to cancel download:', error);
      }
    }
  }
  
  removeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task) {
      this.tasks.delete(taskId);
      this.removeTaskUI(taskId);
    }
  }
  
  updateTaskUI(task) {
    // Try to update individual video progress bar first
    if (task.videoIndex !== undefined) {
      const videoProgressEl = document.getElementById(`video-progress-${task.videoIndex}`);
      
      if (videoProgressEl) {
        // Show the progress bar
        videoProgressEl.classList.remove('hidden');
        
        // Update progress
        const progressFill = document.getElementById(`video-progress-fill-${task.videoIndex}`);
        const progressLabel = document.getElementById(`video-progress-label-${task.videoIndex}`);
        const progressStats = document.getElementById(`video-progress-stats-${task.videoIndex}`);
        
        if (progressFill) {
          progressFill.style.width = `${task.progress || 0}%`;
        }
        
        if (progressLabel) {
          progressLabel.textContent = task.message || `${task.status}...`;
        }
        
        if (progressStats) {
          let statsHtml = `${task.progress || 0}%`;
          
          if (task.segment && task.totalSegments) {
            statsHtml += ` • Segment ${task.segment}/${task.totalSegments}`;
          }
          
          if (task.size) {
            statsHtml += ` • ${formatSize(task.size)}`;
          }
          
          progressStats.innerHTML = statsHtml;
        }
        
        // Hide button during download
        const downloadBtn = videoProgressEl.closest('.video-item-details')?.querySelector('.download-video-btn');
        if (downloadBtn && task.status !== 'completed' && task.status !== 'error') {
          downloadBtn.style.display = 'none';
        } else if (downloadBtn && (task.status === 'completed' || task.status === 'error')) {
          downloadBtn.style.display = '';
          
          // Hide progress after completion
          if (task.status === 'completed') {
            setTimeout(() => {
              videoProgressEl.classList.add('hidden');
            }, 3000);
          }
        }
        
        return; // Don't use global progress container
      }
    }
    
    // Fallback to global download tasks container
    const container = document.getElementById('downloadTasks');
    if (!container) return;
    
    let taskEl = document.getElementById(`download-task-${task.id}`);
    
    if (!taskEl) {
      taskEl = document.createElement('div');
      taskEl.id = `download-task-${task.id}`;
      taskEl.className = 'download-task';
      container.appendChild(taskEl);
      
      // Show downloads section
      document.getElementById('downloadsSection').classList.remove('hidden');
    }
    
    // Status icon and color
    let statusIcon = '⏳';
    let statusClass = 'status-downloading';
    
    if (task.status === 'completed') {
      statusIcon = '✓';
      statusClass = 'status-completed';
    } else if (task.status === 'error' || task.status === 'cancelled') {
      statusIcon = '✗';
      statusClass = 'status-error';
    } else if (task.status === 'preparing' || task.status === 'starting') {
      statusIcon = '⏳';
      statusClass = 'status-preparing';
    }
    
    taskEl.className = `download-task ${statusClass}`;
    
    // Build status text based on task type
    let statusText = '';
    if (task.type === 'segmented') {
      if (task.status === 'completed') {
        statusText = `Completed (${formatSize(task.size || 0)})`;
      } else if (task.status === 'error') {
        statusText = `Error: ${task.error}`;
      } else if (task.status === 'parsing') {
        statusText = 'Parsing manifest...';
      } else if (task.status === 'selecting') {
        statusText = task.message || 'Selecting quality...';
      } else if (task.status === 'downloading') {
        statusText = `Segment ${task.segment}/${task.totalSegments} (${task.progress}%)`;
      } else if (task.status === 'merging') {
        statusText = 'Merging segments...';
      } else if (task.status === 'saving') {
        statusText = 'Saving file...';
      } else {
        statusText = task.message || `${task.progress}%`;
      }
    } else {
      if (task.status === 'completed') {
        statusText = 'Completed';
      } else if (task.status === 'error') {
        statusText = `Error: ${task.error}`;
      } else if (task.status === 'cancelled') {
        statusText = 'Cancelled';
      } else if (task.status === 'preparing') {
        statusText = 'Preparing...';
      } else if (task.status === 'starting') {
        statusText = 'Starting...';
      } else {
        statusText = `${task.progress}%`;
      }
    }
    
    taskEl.innerHTML = `
      <div class="download-task-header">
        <span class="download-icon">${statusIcon}</span>
        <span class="download-filename">${task.filename || 'Recording...'}</span>
        ${task.status === 'downloading' && task.type !== 'segmented' ? `
          <button class="download-cancel-btn" data-task-id="${task.id}" title="Cancel">✕</button>
        ` : ''}
      </div>
      <div class="download-progress-bar">
        <div class="download-progress-fill" style="width: ${task.progress}%"></div>
      </div>
      <div class="download-info">
        <span class="download-status">${statusText}</span>
        ${task.speed > 0 ? `
          <span class="download-speed">${formatSpeed(task.speed)}</span>
        ` : ''}
        ${task.totalBytes > 0 ? `
          <span class="download-size">${formatSize(task.bytesReceived)} / ${formatSize(task.totalBytes)}</span>
        ` : ''}
      </div>
    `;
    
    // Add cancel button handler
    const cancelBtn = taskEl.querySelector('.download-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = () => this.cancelDownload(task.id);
    }
  }
  
  removeTaskUI(taskId) {
    const taskEl = document.getElementById(`download-task-${taskId}`);
    if (taskEl) {
      taskEl.style.opacity = '0';
      setTimeout(() => taskEl.remove(), 300);
    }
    
    // Hide section if no tasks
    if (this.tasks.size === 0) {
      setTimeout(() => {
        document.getElementById('downloadsSection').classList.add('hidden');
      }, 500);
    }
  }
  
  getTasks() {
    return Array.from(this.tasks.values());
  }
}

