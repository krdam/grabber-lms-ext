// Native Messaging Merger Module
// Communicates with Native Host to merge video and audio using FFmpeg

export class NativeMerger {
  constructor() {
    this.hostName = 'com.nanopagesaver.videomerger';
    this.port = null;
  }
  
  /**
   * Check if Native Host is available
   */
  async isAvailable() {
    return new Promise((resolve) => {
      try {
        const port = chrome.runtime.connectNative(this.hostName);
        
        port.onMessage.addListener((response) => {
          port.disconnect();
          resolve(response.success === true);
        });
        
        port.onDisconnect.addListener(() => {
          resolve(false);
        });
        
        // Send ping
        port.postMessage({ action: 'ping' });
        
        // Timeout
        setTimeout(() => {
          try {
            port.disconnect();
          } catch (e) {}
          resolve(false);
        }, 3000);
        
      } catch (error) {
        console.error('Native Host check failed:', error);
        resolve(false);
      }
    });
  }
  
  /**
   * Merge video and audio using Native Host (via file paths)
   */
  async mergeVideoAudio(videoBlob, audioBlob, filename, onProgress) {
    try {
      console.log('🚀 Starting Native Host merge');
      console.log(`Video: ${Math.round(videoBlob.size / 1024 / 1024)}MB`);
      console.log(`Audio: ${Math.round(audioBlob.size / 1024 / 1024)}MB`);
      
      if (onProgress) {
        onProgress({ stage: 'preparing', progress: 10, message: 'Saving temporary files...' });
      }
      
      // Download video and audio as temporary files first
      const videoFilename = filename.replace(/\.(mp4|webm)$/, '_VIDEO_TEMP.mp4');
      const audioFilename = filename.replace(/\.(mp4|webm)$/, '_AUDIO_TEMP.m4a');
      
      // Create download URLs
      const videoUrl = URL.createObjectURL(videoBlob);
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Download video
      const videoDownloadId = await chrome.downloads.download({
        url: videoUrl,
        filename: videoFilename,
        saveAs: false  // Auto-save to Downloads
      });
      
      // Wait for video download to complete
      await this.waitForDownload(videoDownloadId);
      
      // Download audio
      const audioDownloadId = await chrome.downloads.download({
        url: audioUrl,
        filename: audioFilename,
        saveAs: false
      });
      
      // Wait for audio download to complete
      await this.waitForDownload(audioDownloadId);
      
      // Cleanup URLs
      URL.revokeObjectURL(videoUrl);
      URL.revokeObjectURL(audioUrl);
      
      if (onProgress) {
        onProgress({ stage: 'merging', progress: 50, message: 'Merging with FFmpeg (fast!)...' });
      }
      
      // Get Downloads directory path
      const downloadsPath = await this.getDownloadsPath();
      const videoPath = `${downloadsPath}/${videoFilename}`;
      const audioPath = `${downloadsPath}/${audioFilename}`;
      
      // Connect to Native Host
      const port = chrome.runtime.connectNative(this.hostName);
      
      return new Promise((resolve, reject) => {
        let responded = false;
        
        port.onMessage.addListener((response) => {
          responded = true;
          port.disconnect();
          
          if (response.success) {
            if (onProgress) {
              onProgress({ 
                stage: 'completed', 
                progress: 100, 
                message: 'Video merged successfully!', 
                size: response.size 
              });
            }
            
            console.log(`✅ Merged file saved: ${response.output_path}`);
            console.log(`Size: ${Math.round(response.size / 1024 / 1024)}MB`);
            
            // Cleanup temp files (Native Host will do this)
            
            resolve({ 
              success: true, 
              path: response.output_path,
              size: response.size
            });
          } else {
            if (onProgress) {
              onProgress({ stage: 'error', progress: 0, message: response.error });
            }
            reject(new Error(response.error));
          }
        });
        
        port.onDisconnect.addListener(() => {
          if (!responded) {
            const error = chrome.runtime.lastError 
              ? chrome.runtime.lastError.message 
              : 'Native Host disconnected';
            
            if (onProgress) {
              onProgress({ stage: 'error', progress: 0, message: error });
            }
            
            reject(new Error(error));
          }
        });
        
        // Send merge request with file paths
        port.postMessage({
          action: 'merge_files',
          video_path: videoPath,
          audio_path: audioPath,
          output_filename: filename
        });
        
        // Timeout
        setTimeout(() => {
          if (!responded) {
            try {
              port.disconnect();
            } catch (e) {}
            reject(new Error('Native Host timeout'));
          }
        }, 300000); // 5 minutes
      });
      
    } catch (error) {
      console.error('Native Host merge failed:', error);
      
      if (onProgress) {
        onProgress({ stage: 'error', progress: 0, message: error.message });
      }
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Wait for download to complete
   */
  waitForDownload(downloadId) {
    return new Promise((resolve, reject) => {
      const listener = (delta) => {
        if (delta.id === downloadId) {
          if (delta.state && delta.state.current === 'complete') {
            chrome.downloads.onChanged.removeListener(listener);
            resolve();
          } else if (delta.error) {
            chrome.downloads.onChanged.removeListener(listener);
            reject(new Error(delta.error.current));
          }
        }
      };
      
      chrome.downloads.onChanged.addListener(listener);
      
      // Timeout
      setTimeout(() => {
        chrome.downloads.onChanged.removeListener(listener);
        reject(new Error('Download timeout'));
      }, 60000); // 1 minute
    });
  }
  
  /**
   * Get Downloads directory path
   */
  async getDownloadsPath() {
    // On Linux, typically ~/Downloads
    // We'll use the home path + Downloads
    return new Promise((resolve) => {
      // Try to get from environment or use default
      resolve('/home/dima/Downloads');  // TODO: make this dynamic
    });
  }
  
  /**
   * Convert Blob to base64
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove data URL prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

