// Nano Page Saver - Main Popup Script (Modular Version)
// Version 3.3.0 - Individual progress bars for each video, video titles and thumbnails

// ===== IMPORTS =====
import { sanitizeFilename, showStatus, showProgress, hideProgress, formatSize, formatSpeed } from './modules/utils.js';
import { HLSDownloader } from './modules/hls-downloader.js';
import { NativeMerger } from './modules/native-merger.js';
import { DownloadManager } from './modules/download-manager.js';
import { detectVideos, displayVideos } from './modules/video-detector.js';
import { saveAsPdf, extractPageContentForPdfWrapper, generateSimplePdfHtml } from './modules/pdf-processor.js';
import { saveAsHtml, extractPageContent, minifyHtml } from './modules/html-processor.js';

// ===== DOM ELEMENTS =====
const pageTitle = document.getElementById('pageTitle');
const pageUrl = document.getElementById('pageUrl');
const saveBtn = document.getElementById('saveBtn');
const statusDiv = document.getElementById('status');
const savedCount = document.getElementById('savedCount');
const permissionWarning = document.getElementById('permissionWarning');
const grantPermissionBtn = document.getElementById('grantPermissionBtn');
const progressContainer = document.getElementById('progressContainer');
const progressLabel = document.getElementById('progressLabel');
const progressFill = document.getElementById('progressFill');

// HTML options
const includeImagesCheckbox = document.getElementById('includeImages');
const includeStylesCheckbox = document.getElementById('includeStyles');
const includeScriptsCheckbox = document.getElementById('includeScripts');
const minifyHtmlCheckbox = document.getElementById('minifyHtml');

// PDF options
const extractHiddenCheckbox = document.getElementById('extractHidden');
const removeControlsCheckbox = document.getElementById('removeControls');
const preserveColorsCheckbox = document.getElementById('preserveColors');
const includeVideosCheckbox = document.getElementById('includeVideos');

// Format selector
const formatButtons = document.querySelectorAll('.format-btn');
const htmlOptions = document.getElementById('htmlOptions');
const pdfOptions = document.getElementById('pdfOptions');

let selectedFormat = 'html';

// ===== INITIALIZE MANAGERS =====
const statusCallback = (msg, type) => showStatus(msg, type, statusDiv);

// Initialize Native Merger (FFmpeg integration)
const nativeMerger = new NativeMerger();

// Initialize HLS downloader with Native Merger
const hlsDownloader = new HLSDownloader(nativeMerger);

// Initialize download manager
const downloadManager = new DownloadManager(statusCallback);

// Connect HLS downloader to download manager
downloadManager.setHLSDownloader(hlsDownloader);

// Make global for injected functions
window.downloadManager = downloadManager;
window.hlsDownloader = hlsDownloader;
window.sanitizeFilename = sanitizeFilename;
window.showStatus = statusCallback;
window.extractPageContent = extractPageContent;
window.extractPageContentForPdfWrapper = extractPageContentForPdfWrapper;
window.generateSimplePdfHtml = generateSimplePdfHtml;
window.minifyHtml = minifyHtml;

// ===== PERMISSIONS =====
async function checkPermissions() {
  try {
    const hasPermission = await chrome.permissions.contains({
      origins: ['http://*/*', 'https://*/*']
    });
    
    if (!hasPermission) {
      permissionWarning.classList.remove('hidden');
      saveBtn.disabled = true;
      statusCallback('⚠️ Permission required to save pages', 'info');
    } else {
      permissionWarning.classList.add('hidden');
      saveBtn.disabled = false;
    }
  } catch (error) {
    console.error('Error checking permissions:', error);
  }
}

grantPermissionBtn.addEventListener('click', async () => {
  try {
    const granted = await chrome.permissions.request({
      origins: ['http://*/*', 'https://*/*']
    });
    
    if (granted) {
      permissionWarning.classList.add('hidden');
      saveBtn.disabled = false;
      statusCallback('✓ Permission granted! Reloading page...', 'success');
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        await chrome.tabs.reload(tab.id);
        setTimeout(() => window.close(), 500);
      }
    } else {
      statusCallback('✗ Permission denied. Extension cannot function without access.', 'error');
    }
  } catch (error) {
    console.error('Error requesting permission:', error);
    statusCallback('✗ Error requesting permission: ' + error.message, 'error');
  }
});

// ===== FORMAT SELECTOR =====
formatButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    formatButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedFormat = btn.dataset.format;
    
    if (selectedFormat === 'html') {
      htmlOptions.classList.remove('hidden');
      pdfOptions.classList.add('hidden');
      saveBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 3V13M10 13L6 9M10 13L14 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3 17H17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Save as HTML
      `;
    } else {
      htmlOptions.classList.add('hidden');
      pdfOptions.classList.remove('hidden');
      saveBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 2H12L16 6V18H6V2Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <path d="M12 2V6H16" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        Save as PDF
      `;
    }
  });
});

// ===== SAVE BUTTON =====
saveBtn.addEventListener('click', async () => {
  if (selectedFormat === 'html') {
    const options = {
      includeImages: includeImagesCheckbox.checked,
      includeStyles: includeStylesCheckbox.checked,
      includeScripts: includeScriptsCheckbox.checked,
      minifyHtml: minifyHtmlCheckbox.checked
    };
    
    await saveAsHtml(options, {
      saveBtn,
      showStatus: statusCallback,
      sanitizeFilename,
      savedCount,
      includeImagesCheckbox,
      includeStylesCheckbox,
      includeScriptsCheckbox,
      minifyHtmlCheckbox
    });
  } else {
    const options = {
      extractHidden: extractHiddenCheckbox.checked,
      removeControls: removeControlsCheckbox.checked,
      preserveColors: preserveColorsCheckbox.checked,
      includeVideos: includeVideosCheckbox.checked
    };
    
    await saveAsPdf(options, {
      saveBtn,
      showStatus: statusCallback,
      sanitizeFilename,
      savedCount,
      extractHiddenCheckbox,
      removeControlsCheckbox,
      preserveColorsCheckbox,
      includeVideosCheckbox
    });
  }
});

// ===== INITIALIZE =====
checkPermissions();

chrome.storage.local.get(['savedCount'], (result) => {
  savedCount.textContent = result.savedCount || 0;
});

// ===== CHECK NATIVE HOST STATUS =====
const nativeHostStatusEl = document.getElementById('nativeHostStatus');

(async () => {
  nativeHostStatusEl.className = 'native-host-status checking';
  nativeHostStatusEl.querySelector('.status-icon').textContent = '⏳';
  nativeHostStatusEl.querySelector('.status-text').textContent = 'Checking FFmpeg...';
  
  const isAvailable = await nativeMerger.isAvailable();
  
  if (isAvailable) {
    console.log('✅ Native Host: доступен - автоматическое объединение!');
    nativeHostStatusEl.className = 'native-host-status ready';
    nativeHostStatusEl.querySelector('.status-icon').textContent = '✅';
    nativeHostStatusEl.querySelector('.status-text').textContent = 'FFmpeg ready - auto-merge enabled';
  } else {
    console.warn('⚠️ Native Host: недоступен - функционал ограничен');
    console.warn('📖 Настройте Native Host: ./update_extension_id.sh');
    nativeHostStatusEl.className = 'native-host-status not-ready';
    nativeHostStatusEl.querySelector('.status-icon').textContent = '❌';
    nativeHostStatusEl.querySelector('.status-text').textContent = 'FFmpeg not configured - run ./update_extension_id.sh';
  }
})();

// ===== VIDEO DETECTION =====
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  const tab = tabs[0];
  pageTitle.textContent = tab.title;
  pageUrl.textContent = tab.url;
  
  try {
    // Detect page videos
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: detectVideos
    });
    
    // Get network-captured videos
    const response = await chrome.runtime.sendMessage({
      action: 'getVideoUrls',
      tabId: tab.id
    });
    
    const pageVideos = (results && results[0] && results[0].result) || [];
    const networkResources = response.resources || [];
    
    console.log('Page videos detected:', pageVideos.length);
    console.log('Network resources captured:', networkResources.length);
    
    // Merge page videos with network resources
    const allVideos = [...pageVideos];
    
    // Check if we have HLS/DASH manifests - if so, prioritize them over direct files
    const hasManifests = networkResources.some(r => r.type === 'hls' || r.type === 'dash');
    
    // Add network resources as separate entries
    for (const resource of networkResources) {
      const exists = allVideos.some(v => 
        (v.sources && v.sources.includes(resource.url)) || 
        v.iframeUrl === resource.url
      );
      
      if (!exists) {
        // If we have manifests, skip direct MP4s (they're likely segments)
        if (hasManifests && resource.type === 'direct') {
          console.log('Skipping direct file (manifest found):', resource.url.split('/').pop());
          continue;
        }
        // For HLS, check if it has separate audio tracks
        let hasSeparateAudio = false;
        if (resource.type === 'hls') {
          try {
            if (resource.url.includes('master.m3u8') || resource.url.includes('playlist.m3u8')) {
              const manifest = await hlsDownloader.parseM3U8(resource.url);
              if (manifest.isMaster && manifest.variants && manifest.variants.hasAudioTracks) {
                hasSeparateAudio = true;
                console.log(`HLS stream has separate audio tracks: ${resource.url}`);
              }
            }
          } catch (error) {
            console.log('Could not pre-parse HLS manifest:', error);
          }
        }
        
        // Skip HLS without separate audio (not useful without Native Host)
        if (resource.type === 'hls' && !hasSeparateAudio) {
          console.log('Skipping simple HLS (no separate audio):', resource.url.split('/').pop());
          continue;
        }
        
        allVideos.push({
          type: `Network: ${resource.format}`,
          title: `${resource.format} Stream - ${tab.title}`,
          networkResource: resource,
          url: resource.url,
          quality: resource.quality,
          format: resource.format,
          canDirectDownload: resource.type === 'direct',
          requiresProcessing: resource.type === 'hls' || resource.type === 'dash',
          hasSeparateAudio: hasSeparateAudio,
          hasVideoElement: false
        });
      }
    }
    
    console.log('Total videos found (before dedup):', allVideos.length);
    
    // Deduplicate and prioritize
    const uniqueVideos = [];
    const seenUrls = new Set();
    
    // Priority order: HLS/DASH manifests > HTML5 Video > Direct files > Others
    const priorityOrder = ['hls', 'dash', 'HTML5 Video', 'Vimeo Player', 'direct', 'youtube', 'manifest'];
    
    for (const priority of priorityOrder) {
      for (const video of allVideos) {
        const videoKey = video.url || video.iframeUrl || video.sources?.[0] || '';
        
        if (seenUrls.has(videoKey)) continue;
        
        const matchesPriority = 
          (priority === 'HTML5 Video' && video.type === 'HTML5 Video') ||
          (priority === 'Vimeo Player' && video.type === 'Vimeo Player') ||
          (video.format === priority.toUpperCase()) ||
          (video.networkResource?.type === priority);
        
        if (matchesPriority) {
          uniqueVideos.push(video);
          seenUrls.add(videoKey);
        }
      }
    }
    
    // Add any remaining videos not in priority list
    for (const video of allVideos) {
      const videoKey = video.url || video.iframeUrl || video.sources?.[0] || '';
      if (!seenUrls.has(videoKey)) {
        uniqueVideos.push(video);
        seenUrls.add(videoKey);
      }
    }
    
    console.log('Total videos found (after dedup):', uniqueVideos.length);
    
    if (uniqueVideos.length > 0) {
      displayVideos(uniqueVideos, tab.id);
    } else {
      console.log('No videos detected on this page');
    }
  } catch (error) {
    console.log('Could not detect videos:', error);
  }
});

// Video download handler - needs to be global for event listeners
window.downloadVideoHandler = async (video, index, tabId) => {
  try {
    // Handle direct download from network capture
    if (video.canDirectDownload && video.url) {
      statusCallback('Starting direct download...', 'info');
      
      const pageTitle = document.getElementById('pageTitle').textContent || 'video';
      const extension = video.format ? `.${video.format.toLowerCase()}` : '.mp4';
      const filename = sanitizeFilename(pageTitle) + `_${index + 1}` + extension;
      
      const result = await downloadManager.startDirectDownload(video.url, filename, video);
      
      if (result.success) {
        statusCallback('✓ Download started!', 'success');
      } else {
        statusCallback(`✗ Download failed: ${result.error}`, 'error');
      }
      
      return;
    }
    
    // Handle HLS streams
    if (video.requiresProcessing && video.url) {
      if (video.format === 'HLS' || video.url.includes('.m3u8')) {
        // ALWAYS check manifest for separate audio tracks before downloading
        let hasSeparateAudio = video.hasSeparateAudio || false;
        
        console.log('=== HLS Download Started ===');
        console.log('Video URL:', video.url);
        console.log('Pre-parsed hasSeparateAudio:', hasSeparateAudio);
        
        if (!hasSeparateAudio && (video.url.includes('master.m3u8') || video.url.includes('playlist.m3u8'))) {
          try {
            statusCallback('Checking audio configuration...', 'info');
            console.log('Parsing manifest to check for audio tracks...');
            const manifest = await hlsDownloader.parseM3U8(video.url);
            console.log('Manifest parsed:', manifest);
            if (manifest.isMaster && manifest.variants) {
              console.log('Variants found:', manifest.variants.variants?.length || 0);
              console.log('Has audio tracks:', manifest.variants.hasAudioTracks);
              if (manifest.variants.hasAudioTracks) {
                hasSeparateAudio = true;
                console.log('✓ Detected separate audio tracks in manifest');
              }
            }
          } catch (error) {
            console.error('Could not check manifest:', error);
          }
        }
        
        console.log('Final decision - hasSeparateAudio:', hasSeparateAudio);
        
        // For HLS with separate audio - download segments (fast but needs manual merge)
        if (hasSeparateAudio) {
          console.log('→ HLS has separate audio - will download video and audio as 2 files');
          statusCallback('📥 Downloading video and audio (FAST: ~30 sec, then merge with online tool)...', 'info');
        }
        
        // Simple HLS (audio already in segments), download directly
        console.log('→ Using segment download (audio in video)');
        statusCallback('Starting HLS segment download (audio included)...', 'info');
        
        const pageTitle = document.getElementById('pageTitle').textContent || 'video';
        const filename = sanitizeFilename(pageTitle) + `_${index + 1}.mp4`;
        
        const result = await downloadManager.startSegmentedDownload(video.url, filename, video, index);
        
        if (!result.success) {
          statusCallback(`✗ HLS download failed: ${result.error}`, 'error');
        }
        
        console.log('=== HLS Download Completed ===');
        return;
      }
      
      // For DASH or other formats, open URL
      statusCallback('Opening stream URL...', 'info');
      chrome.tabs.create({ url: video.url });
      statusCallback('ℹ Stream URL opened. Use Video DownloadHelper or yt-dlp for download.', 'info');
      return;
    }
    
    // Handle Vimeo iframe - try to extract HLS from iframe
    if (video.type === 'Vimeo Player' && video.iframeUrl) {
      statusCallback('Extracting video from Vimeo iframe...', 'info');
      
      try {
        // Open iframe in background tab to capture network requests
        const newTab = await chrome.tabs.create({ 
          url: video.iframeUrl,
          active: false  // Background tab
        });
        
        // Wait a bit for video to load and HLS to be captured
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if we captured any HLS streams from this tab
        const response = await chrome.runtime.sendMessage({
          action: 'getVideoUrls',
          tabId: newTab.id
        });
        
        const hlsStreams = (response.resources || []).filter(r => r.type === 'hls');
        
        if (hlsStreams.length > 0) {
          statusCallback('✓ Found HLS stream! Starting download...', 'success');
          
          // Close the tab
          chrome.tabs.remove(newTab.id);
          
          // Download the HLS stream
          const hlsVideo = {
            ...video,
            url: hlsStreams[0].url,
            format: 'HLS',
            requiresProcessing: true,
            hasSeparateAudio: true  // Vimeo usually has separate audio
          };
          
          // Recursively call this handler with HLS video
          return window.downloadVideoHandler(hlsVideo, index, tabId);
          
        } else {
          // No HLS found, close tab and show message
          chrome.tabs.remove(newTab.id);
          statusCallback('✗ Could not find HLS stream. Try opening page manually.', 'error');
        }
      } catch (error) {
        statusCallback('✗ Error extracting Vimeo video: ' + error.message, 'error');
      }
      return;
    }
    
    // Handle YouTube - can't download, open page
    if (video.type === 'YouTube') {
      chrome.tabs.create({ url: video.url });
      statusCallback('ℹ YouTube opened. Use yt-dlp for download.', 'info');
      return;
    }
    
    // Handle videos with direct URL
    if (video.url && !video.requiresProcessing) {
      // Try direct download
      statusCallback('Attempting direct download...', 'info');
      
      try {
        await chrome.downloads.download({
          url: video.url,
          filename: sanitizeFilename(document.getElementById('pageTitle').textContent || 'video') + `_${index + 1}.mp4`,
          saveAs: true
        });
        
        statusCallback('✓ Download started!', 'success');
      } catch (error) {
        statusCallback('✗ Download failed: ' + error.message, 'error');
      }
      return;
    }
    
    // Default: Cannot download
    statusCallback('✗ Configure FFmpeg Native Host to download HLS videos with audio', 'error');
    
  } catch (error) {
    console.error('Error downloading video:', error);
    statusCallback('✗ Error: ' + error.message, 'error');
  }
};

console.log('Nano Page Saver (Modular v2.3.0) loaded');

