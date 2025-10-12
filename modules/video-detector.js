// Video Detector Module
// Detects videos on page and displays them in UI

// Detect videos on page (injected function)
export async function detectVideos() {
  // Helper: Format duration in MM:SS
  function formatDuration(seconds) {
    if (!isFinite(seconds) || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  // Helper: Try to generate thumbnail from video (async)
  async function generateThumbnail(video, index) {
    try {
      // If video has poster, use it immediately
      if (video.poster) {
        console.log(`✓ Using poster as thumbnail for video ${index + 1}`);
        return video.poster;
      }
      
      // Try to load video metadata if not loaded
      if (video.readyState < 2) {
        console.log(`Waiting for video ${index + 1} metadata to load...`);
        
        // Try to load metadata with timeout
        await Promise.race([
          new Promise((resolve, reject) => {
            const onLoadedMetadata = () => {
              video.removeEventListener('loadedmetadata', onLoadedMetadata);
              resolve();
            };
            video.addEventListener('loadedmetadata', onLoadedMetadata);
            video.load();
          }),
          new Promise((_, reject) => setTimeout(() => reject('timeout'), 2000))
        ]).catch(() => {
          console.log(`Timeout waiting for video ${index + 1} metadata`);
        });
      }
      
      // Check if we now have video dimensions
      if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
        const canvas = document.createElement('canvas');
        const aspectRatio = video.videoWidth / video.videoHeight;
        canvas.width = 120;
        canvas.height = Math.round(120 / aspectRatio);
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        console.log(`✓ Generated thumbnail for video ${index + 1} (${video.videoWidth}x${video.videoHeight})`);
        return thumbnail;
      }
      
      console.log(`Could not generate thumbnail for video ${index + 1} (readyState: ${video.readyState})`);
      return null;
    } catch (error) {
      console.log(`Error generating thumbnail for video ${index + 1}:`, error);
      return null;
    }
  }
  
  const videos = [];
  
  // First, temporarily show all hidden content to detect videos and iframes
  const hiddenElements = [];
  
  // Expand all potentially hidden containers (modals, popups, collapses, accordions)
  const hiddenSelectors = [
    '.modal', '.popup', '[role="dialog"]', '[aria-modal="true"]',
    '.collapse', '.accordion__body', 
    '[aria-hidden="true"]', '[hidden]', '.hidden',
    '[style*="display: none"]', '[style*="display:none"]'
  ];
  
  document.querySelectorAll(hiddenSelectors.join(', ')).forEach(elem => {
    // Check if element or its children contain video or iframe
    if (elem.matches('video, iframe') || elem.querySelector('video, iframe[src*="vimeo"], iframe[src*="youtube"]')) {
      hiddenElements.push({
        element: elem,
        originalDisplay: elem.style.display,
        originalVisibility: elem.style.visibility,
        originalHeight: elem.style.height,
        originalAriaHidden: elem.getAttribute('aria-hidden'),
        hadHiddenAttr: elem.hasAttribute('hidden'),
        classes: Array.from(elem.classList)
      });
      
      // Force show
      elem.style.display = 'block';
      elem.style.visibility = 'visible';
      elem.style.height = 'auto';
      elem.removeAttribute('aria-hidden');
      elem.removeAttribute('hidden');
      elem.classList.remove('hidden', 'collapse');
      elem.classList.add('show');
    }
  });
  
  if (hiddenElements.length > 0) {
    console.log(`Temporarily expanded ${hiddenElements.length} hidden elements to detect videos`);
  }
  
  // PRIORITY 1: Find <video> elements (now including those that were hidden!)
  const videoElements = document.querySelectorAll('video');
  console.log('Found', videoElements.length, 'video elements (including from hidden modals/popups)');
  
  // Process videos asynchronously to generate thumbnails
  const videoPromises = Array.from(videoElements).map(async (video, index) => {
    const sources = [];
    
    // Get video src
    if (video.src) {
      sources.push(video.src);
    }
    
    // Get source elements
    video.querySelectorAll('source').forEach(source => {
      if (source.src) {
        sources.push(source.src);
      }
    });
    
    // Generate thumbnail from video (async)
    const thumbnail = await generateThumbnail(video, index);
    const posterImage = video.poster || '';
    
    // Get valid duration
    const duration = (isFinite(video.duration) && video.duration > 0) ? video.duration : 0;
    
    // Generate video title from page title or video attributes
    const pageTitle = document.title;
    const videoTitle = video.getAttribute('title') || 
                      video.getAttribute('aria-label') || 
                      pageTitle || 
                      `Video ${index + 1}`;
    
    console.log(`Video ${index + 1}:`, 
      duration ? `${Math.round(duration)}s` : 'unknown duration', 
      sources.length > 0 ? sources[0].substring(0, 50) + '...' : 'blob/streaming');
    
    // Return video object
    return {
      type: 'HTML5 Video',
      title: videoTitle,
      sources: sources.length > 0 ? sources : ['blob or streaming'],
      duration: duration,
      poster: posterImage,
      thumbnail: thumbnail || posterImage, // Use poster if no thumbnail generated
      hasVideoElement: true,
      index: index
    };
  });
  
  // Wait for all video processing to complete
  const detectedVideos = await Promise.all(videoPromises);
  videos.push(...detectedVideos);
  
  // PRIORITY 2: Find Vimeo/YouTube iframes (with deduplication)
  // Note: Hidden content already expanded above, so this will find all iframes
  const vimeoIds = new Set();
  
  const vimeoSelectors = 'iframe[src*="vimeo.com"], iframe[data-src*="vimeo.com"], [data-media*="vimeo"], iframe[src*="player.vimeo"]';
  const vimeoIframes = document.querySelectorAll(vimeoSelectors);
  console.log(`Found ${vimeoIframes.length} Vimeo iframes in DOM`);
  
  vimeoIframes.forEach((elem, idx) => {
    const src = elem.src || elem.getAttribute('data-src') || elem.getAttribute('data-media') || '';
    console.log(`  Vimeo iframe ${idx + 1}: ${src.substring(0, 80)}...`);
    
    const videoIdMatch = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    
    if (videoIdMatch) {
      const videoId = videoIdMatch[1];
      
      // Skip duplicates
      if (vimeoIds.has(videoId)) {
        console.log(`  → Skipping duplicate Vimeo ID: ${videoId}`);
        return;
      }
      
      vimeoIds.add(videoId);
      
      // Extract title from iframe or parent
      const pageTitle = document.title;
      const iframeTitle = elem.getAttribute('title') || 
                         elem.getAttribute('aria-label') ||
                         elem.closest('[data-title]')?.getAttribute('data-title') ||
                         pageTitle;
      
      videos.push({
        type: 'Vimeo Player',
        title: iframeTitle || `Vimeo Video ${videoId}`,
        videoId: videoId,
        iframeUrl: src.includes('player.vimeo.com') ? src : `https://player.vimeo.com/video/${videoId}`,
        vimeoUrl: `https://vimeo.com/${videoId}`,
        embedUrl: src,
        hasIframe: true,
        canRecordFromIframe: true
      });
      
      console.log(`  ✓ Added Vimeo video ID ${videoId}: "${iframeTitle}"`);
    } else {
      console.log(`  ✗ Could not extract video ID from: ${src.substring(0, 50)}`);
    }
  });
  
  // Find YouTube embeds
  document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]').forEach(iframe => {
    const src = iframe.src;
    const videoIdMatch = src.match(/(?:embed\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (videoIdMatch) {
      const videoId = videoIdMatch[1];
      
      // Extract title from iframe or parent
      const pageTitle = document.title;
      const iframeTitle = iframe.getAttribute('title') || 
                         iframe.getAttribute('aria-label') ||
                         iframe.closest('[data-title]')?.getAttribute('data-title') ||
                         pageTitle;
      
      videos.push({
        type: 'YouTube',
        title: iframeTitle || `YouTube Video ${videoId}`,
        videoId: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: src,
        hasVideoElement: false,
        canExtractFromIframe: true
      });
      
      console.log(`✓ Added YouTube video ID ${videoId}: "${iframeTitle}"`);
    }
  });
  
  console.log('Total videos detected:', videos.length);
  
  // Restore original state of hidden elements
  hiddenElements.forEach(({ element, originalDisplay, originalVisibility, originalHeight, originalAriaHidden, hadHiddenAttr, classes }) => {
    element.style.display = originalDisplay;
    element.style.visibility = originalVisibility;
    element.style.height = originalHeight;
    
    if (originalAriaHidden) {
      element.setAttribute('aria-hidden', originalAriaHidden);
    }
    
    if (hadHiddenAttr) {
      element.setAttribute('hidden', '');
    }
    
    // Restore original classes
    element.classList.remove('show');
    if (classes.includes('hidden')) element.classList.add('hidden');
    if (classes.includes('collapse')) element.classList.add('collapse');
  });
  
  if (hiddenElements.length > 0) {
    console.log(`Restored ${hiddenElements.length} hidden elements to original state`);
  }
  
  return videos;
}

// Display detected videos in popup
export function displayVideos(videos, tabId) {
  // Helper: Format duration in MM:SS
  function formatDuration(seconds) {
    if (!isFinite(seconds) || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }
  
  const videoSection = document.getElementById('videoSection');
  const videoList = document.getElementById('videoList');
  
  videoList.innerHTML = '';
  
  videos.forEach((video, index) => {
    const videoItem = document.createElement('div');
    videoItem.className = 'video-item';
    
    const canRecord = video.hasVideoElement !== false;
    const canDirectDownload = video.canDirectDownload === true;
    const requiresProcessing = video.requiresProcessing === true;
    
    // Determine info box content and color
    let infoBox = '';
    if (canDirectDownload) {
      infoBox = `
        <div style="font-size: 11px; color: #666; margin-bottom: 8px; padding: 8px; background: #e8f5e9; border-radius: 4px; border-left: 3px solid #4CAF50;">
          ⚡ <strong>Direct download:</strong> ${video.format} file<br>
          📊 Quality: ${video.quality || 'Unknown'}
        </div>
      `;
    } else if (requiresProcessing) {
      const isHLS = video.format === 'HLS' || (video.url && video.url.includes('.m3u8'));
      const hasAudioWarning = video.hasSeparateAudio;
      infoBox = `
        <div style="font-size: 11px; color: #666; margin-bottom: 8px; padding: 8px; background: #e8f5e9; border-radius: 4px; border-left: 3px solid #4CAF50;">
          ⚡ <strong>HLS Stream:</strong> ${video.format}<br>
          🔊 Auto-merge with FFmpeg (~35 seconds total)
        </div>
      `;
    } else if (video.canRecordFromIframe) {
      infoBox = `
        <div style="font-size: 11px; color: #666; margin-bottom: 8px; padding: 8px; background: #e3f2fd; border-radius: 4px; border-left: 3px solid #2196F3;">
          🎬 <strong>Vimeo iframe:</strong> Auto-extract HLS (~5s)<br>
          ⚡ Opens in background → captures stream → downloads
        </div>
      `;
    } else if (video.canExtractFromIframe) {
      infoBox = `
        <div style="font-size: 11px; color: #666; margin-bottom: 8px; padding: 8px; background: #fff3cd; border-radius: 4px; border-left: 3px solid #FF9800;">
          📺 <strong>YouTube iframe:</strong> Will try auto-extract (~3s)<br>
          ⚠️ May need yt-dlp for full quality download
        </div>
      `;
    } else if (video.url) {
      infoBox = `
        <div style="font-size: 11px; color: #666; margin-bottom: 8px; padding: 8px; background: #e8f5e9; border-radius: 4px; border-left: 3px solid #4CAF50;">
          📥 <strong>Direct URL available</strong><br>
          Will attempt direct download
        </div>
      `;
    } else {
      infoBox = `
        <div style="font-size: 11px; color: #666; margin-bottom: 8px; padding: 8px; background: #fff3cd; border-radius: 4px; border-left: 3px solid #ffc107;">
          ⚠️ No direct download available
        </div>
      `;
    }
    
    // Determine button text
    let buttonText = 'Download';
    if (canDirectDownload) {
      buttonText = `Download ${video.format}`;
    } else if (requiresProcessing) {
      const isHLS = video.format === 'HLS' || (video.url && video.url.includes('.m3u8'));
      if (isHLS) {
        buttonText = 'Download HLS';
      } else {
        buttonText = 'Open URL';
      }
    } else if (video.canRecordFromIframe) {
      buttonText = '📥 Extract & Download';
    } else if (video.canExtractFromIframe) {
      buttonText = '📺 Try Extract';
    } else if (video.url) {
      buttonText = '📥 Download Video';
    } else {
      buttonText = 'Open Video Page';
    }
    
    // Generate thumbnail HTML (only for HTML5 Video, not for Network resources)
    let thumbnailHtml = '';
    const isHTML5Video = video.type === 'HTML5 Video';
    
    if (isHTML5Video && video.thumbnail) {
      const durationText = formatDuration(video.duration);
      thumbnailHtml = `
        <div class="video-thumbnail">
          <img src="${video.thumbnail}" alt="Video preview">
          ${durationText ? `<span class="thumbnail-duration">${durationText}</span>` : ''}
        </div>
      `;
    }
    
    // Generate video title (always show)
    const videoTitle = video.title || `Video ${index + 1}`;
    const videoSubtitle = video.format ? 
      `${video.format}${video.quality && video.quality !== 'Unknown' ? ` - ${video.quality}` : ''}` : 
      video.type;
    
    videoItem.innerHTML = `
      <div class="video-item-header-title">
        <div class="video-title">${videoTitle}</div>
        <div class="video-subtitle">${videoSubtitle}</div>
      </div>
      <div class="video-item-content">
        ${thumbnailHtml}
        <div class="video-item-details">
          <div class="video-item-meta">
            <span class="video-icon">🎥</span>
            <span class="video-type">${video.type}</span>
            ${!video.thumbnail && formatDuration(video.duration) ? `<span class="video-duration">${formatDuration(video.duration)}</span>` : ''}
          </div>
          ${infoBox}
          
          <!-- Individual progress bar for this video -->
          <div class="video-progress hidden" id="video-progress-${index}">
            <div class="progress-label" id="video-progress-label-${index}">Preparing...</div>
            <div class="progress-bar">
              <div class="progress-bar-fill" id="video-progress-fill-${index}" style="width: 0%"></div>
            </div>
            <div class="progress-stats" id="video-progress-stats-${index}"></div>
          </div>
          
          <button class="download-video-btn ${canDirectDownload ? 'btn-direct' : requiresProcessing && (video.format === 'HLS' || video.url.includes('.m3u8')) ? 'btn-hls' : ''}" data-index="${index}">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 3V13M10 13L6 9M10 13L14 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3 17H17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            ${buttonText}
          </button>
        </div>
      </div>
    `;
    
    videoList.appendChild(videoItem);
    
    // Add click handler
    const downloadBtn = videoItem.querySelector('.download-video-btn');
    downloadBtn.addEventListener('click', () => {
      // Call global downloadVideo handler
      if (window.downloadVideoHandler) {
        window.downloadVideoHandler(video, index, tabId);
      }
    });
  });
  
  videoSection.classList.remove('hidden');
}
