// Background service worker for Nano Page Saver
// Handles extension lifecycle and background tasks

// Store video URLs captured from network requests with metadata
const videoUrlCache = new Map(); // Map<tabId, Array<VideoResource>>

// Store active downloads for progress tracking
const activeDownloads = new Map(); // Map<downloadId, DownloadTask>

// Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Nano Page Saver installed');
    
    // Initialize storage
    chrome.storage.local.set({ 
      savedCount: 0,
      installDate: new Date().toISOString(),
      downloadHistory: []
    });
  } else if (details.reason === 'update') {
    console.log('Nano Page Saver updated to version', chrome.runtime.getManifest().version);
  }
});

// Listen for web requests to capture video URLs with metadata
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url;
    
    // Skip video segments/chunks - enhanced filtering
    // Common segment patterns for HLS/DASH/Vimeo
    const segmentPatterns = [
      /segment[-_]?\d+/i,           // segment-123, segment_45
      /chunk[-_]?\d+/i,              // chunk-5, chunk_10
      /\.ts$/i,                      // .ts files (HLS segments)
      /frag[-_]?\d+/i,               // frag-1, frag_2
      /seg[-_]?\d+/i,                // seg-10
      /\d{10,}_\d+\.mp4/i,          // timestamp_123.mp4 (segment pattern)
      /\d+\.m4s$/i,                  // 123.m4s (DASH segment)
      /init[-_]?\d+/i,               // init-0, init_segment
      /range\/\d+-\d+/i,             // range/0-1000 (byte range)
      /bytestart=\d+/i,              // bytestart=12345 (partial content)
      /sq\/\d+/i,                    // sq/0 (Vimeo sequence)
      /sep\/video\/\d+/i,            // sep/video/123 (Vimeo separator)
      /\/(audio|video)\/\d+\.mp4/i  // /video/45.mp4, /audio/12.mp4
    ];
    
    for (const pattern of segmentPatterns) {
      if (url.match(pattern)) {
        return; // Skip segment
      }
    }
    
    // Skip very short URLs that end with just numbers (likely segments)
    if (url.match(/\/\d{1,3}\.(mp4|m4s|webm)(\?|$)/i)) {
      return; // Skip numbered segments like /45.mp4, /123.m4s
    }
    
    // Detect video type and extract metadata
    let videoResource = null;
    
    // Direct video files (MP4, WebM, etc.)
    const directVideoMatch = url.match(/\.(mp4|webm|ogg|ogv|mov|avi|mkv)(\?|$)/i);
    if (directVideoMatch) {
      // Additional check: skip if looks like a segment
      const urlPath = url.split('?')[0]; // Remove query params
      const fileName = urlPath.split('/').pop();
      
      // Skip if filename is just numbers or very generic
      if (fileName.match(/^\d+\.(mp4|webm)$/i)) {
        return; // Skip numbered segments
      }
      
      // Skip if URL has range parameter (byte-range requests = segments!)
      if (url.match(/[?&]range=/i)) {
        return; // Skip range requests
      }
      
      // Skip if URL has pathsig and range together (Vimeo segments)
      if (url.includes('pathsig') && url.includes('range=')) {
        return; // Skip Vimeo segments
      }
      
      videoResource = {
        url: url,
        type: 'direct',
        format: directVideoMatch[1].toUpperCase(),
        quality: extractQualityFromUrl(url),
        timestamp: Date.now()
      };
    }
    
    // HLS streams (.m3u8)
    else if (url.match(/\.m3u8(\?|$)/i) || url.includes('master.m3u8')) {
      videoResource = {
        url: url,
        type: 'hls',
        format: 'HLS',
        quality: url.includes('master') ? 'Adaptive' : extractQualityFromUrl(url),
        timestamp: Date.now()
      };
    }
    
    // DASH streams (.mpd)
    else if (url.match(/\.mpd(\?|$)/i) || url.includes('manifest.mpd')) {
      videoResource = {
        url: url,
        type: 'dash',
        format: 'DASH',
        quality: 'Adaptive',
        timestamp: Date.now()
      };
    }
    
    // YouTube/Google Video
    else if (url.includes('videoplayback') || url.includes('googlevideo.com')) {
      const itag = url.match(/itag=(\d+)/);
      videoResource = {
        url: url,
        type: 'youtube',
        format: 'YouTube',
        quality: itag ? getYouTubeQuality(itag[1]) : 'Unknown',
        timestamp: Date.now()
      };
    }
    
    // Generic streaming manifest
    else if (url.includes('master.json') || url.match(/manifest\.(json|xml)/i)) {
      videoResource = {
        url: url,
        type: 'manifest',
        format: 'Manifest',
        quality: 'Adaptive',
        timestamp: Date.now()
      };
    }
    
    if (videoResource) {
      console.log('Video resource detected:', videoResource);
      
      // Store with tab ID
      if (!videoUrlCache.has(details.tabId)) {
        videoUrlCache.set(details.tabId, []);
      }
      
      const tabVideos = videoUrlCache.get(details.tabId);
      
      // Check for duplicates by URL
      const exists = tabVideos.some(v => v.url === videoResource.url);
      if (!exists) {
        // Limit number of resources per type to avoid clutter
        const sameTypeCount = tabVideos.filter(v => v.type === videoResource.type).length;
        
        // For direct files, limit to 5 per tab (avoid showing hundreds of segments)
        if (videoResource.type === 'direct' && sameTypeCount >= 5) {
          console.log('Skipping additional direct video (limit reached):', videoResource.format);
          return;
        }
        
        // For HLS/DASH, limit to 3 per tab
        if ((videoResource.type === 'hls' || videoResource.type === 'dash') && sameTypeCount >= 3) {
          console.log('Skipping additional stream (limit reached):', videoResource.format);
          return;
        }
        
        tabVideos.push(videoResource);
        console.log(`Stored video resource for tab ${details.tabId}:`, videoResource.format, videoResource.quality);
      }
    }
  },
  { urls: ["<all_urls>"] }
);

// Extract quality from URL (common patterns)
function extractQualityFromUrl(url) {
  // Common quality patterns
  const patterns = [
    /[\/_\-](\d{3,4})p[\/_\-\.]/i,  // 720p, 1080p, etc.
    /[\/_\-](\d{3,4})x(\d{3,4})/i,  // 1920x1080
    /quality[=_](\d+)/i,              // quality=720
    /[\/_\-](4k|2k|hd|sd|fhd|uhd)/i  // Named qualities
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      if (match[1] === '4k') return '2160p';
      if (match[1] === '2k') return '1440p';
      if (match[1] === 'uhd') return '2160p';
      if (match[1] === 'fhd') return '1080p';
      if (match[1] === 'hd') return '720p';
      if (match[1] === 'sd') return '480p';
      if (match[2]) return `${match[2]}p`; // Height from resolution
      return `${match[1]}p`;
    }
  }
  
  return 'Unknown';
}

// YouTube quality mapping (common itags)
function getYouTubeQuality(itag) {
  const qualityMap = {
    '22': '720p',
    '37': '1080p',
    '38': '3072p',
    '43': '360p',
    '44': '480p',
    '45': '720p',
    '46': '1080p',
    '137': '1080p',
    '248': '1080p',
    '399': '1080p',
    '136': '720p',
    '247': '720p',
    '398': '720p'
  };
  
  return qualityMap[itag] || 'Unknown';
}

// Clean up video cache when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (videoUrlCache.has(tabId)) {
    videoUrlCache.delete(tabId);
    console.log(`Cleaned up video cache for tab ${tabId}`);
  }
});

// Download progress monitoring
chrome.downloads.onChanged.addListener((downloadDelta) => {
  const downloadId = downloadDelta.id;
  
  if (activeDownloads.has(downloadId)) {
    const task = activeDownloads.get(downloadId);
    
    // Update state
    if (downloadDelta.state) {
      task.state = downloadDelta.state.current;
      
      if (task.state === 'complete') {
        console.log(`Download ${downloadId} completed`);
        task.endTime = Date.now();
        
        // Notify popup
        chrome.runtime.sendMessage({
          action: 'downloadComplete',
          downloadId: downloadId,
          taskId: task.taskId
        }).catch(() => {});
        
        // Keep in map for a while for status queries
        setTimeout(() => activeDownloads.delete(downloadId), 30000);
      } else if (task.state === 'interrupted') {
        console.log(`Download ${downloadId} interrupted`);
        task.error = downloadDelta.error ? downloadDelta.error.current : 'Unknown error';
        
        chrome.runtime.sendMessage({
          action: 'downloadError',
          downloadId: downloadId,
          taskId: task.taskId,
          error: task.error
        }).catch(() => {});
      }
    }
    
    // Update bytes received
    if (downloadDelta.bytesReceived) {
      task.bytesReceived = downloadDelta.bytesReceived.current;
      
      // Calculate speed and progress
      const elapsed = Date.now() - task.startTime;
      task.speed = task.bytesReceived / (elapsed / 1000); // bytes per second
      
      if (task.totalBytes > 0) {
        task.progress = (task.bytesReceived / task.totalBytes) * 100;
      }
      
      // Notify popup of progress
      chrome.runtime.sendMessage({
        action: 'downloadProgress',
        downloadId: downloadId,
        taskId: task.taskId,
        progress: task.progress,
        bytesReceived: task.bytesReceived,
        totalBytes: task.totalBytes,
        speed: task.speed
      }).catch(() => {});
    }
    
    // Update total bytes
    if (downloadDelta.totalBytes) {
      task.totalBytes = downloadDelta.totalBytes.current;
    }
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVideoUrls') {
    // Return captured video resources for this tab
    const tabId = request.tabId;
    const resources = videoUrlCache.get(tabId) || [];
    sendResponse({ resources: resources });
  } 
  
  else if (request.action === 'startDownload') {
    // Start a new download and track it
    const { url, filename, taskId } = request;
    
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false // Auto-save to default location
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ 
          success: false, 
          error: chrome.runtime.lastError.message 
        });
      } else {
        // Track this download
        activeDownloads.set(downloadId, {
          downloadId: downloadId,
          taskId: taskId,
          url: url,
          filename: filename,
          startTime: Date.now(),
          state: 'in_progress',
          bytesReceived: 0,
          totalBytes: 0,
          progress: 0,
          speed: 0
        });
        
        console.log(`Started download ${downloadId} for task ${taskId}`);
        sendResponse({ 
          success: true, 
          downloadId: downloadId 
        });
      }
    });
    
    return true; // Will respond asynchronously
  }
  
  else if (request.action === 'cancelDownload') {
    const { downloadId } = request;
    
    chrome.downloads.cancel(downloadId, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        activeDownloads.delete(downloadId);
        sendResponse({ success: true });
      }
    });
    
    return true;
  }
  
  else if (request.action === 'getDownloadStatus') {
    const { downloadId } = request;
    const task = activeDownloads.get(downloadId);
    
    if (task) {
      sendResponse({ found: true, task: task });
    } else {
      sendResponse({ found: false });
    }
  }
  
  else if (request.action === 'savePage') {
    sendResponse({ success: true });
  }
  
  return true;
});

// Optional: Add keyboard shortcut support
chrome.commands?.onCommand.addListener((command) => {
  if (command === 'save-page') {
    // Trigger page save
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.action.openPopup();
      }
    });
  }
});

console.log('Nano Page Saver background service worker loaded');

