// Video Detector Module
// Detects videos on page and displays them in UI

// Detect videos on page (injected function)
export function detectVideos() {
  const videos = [];
  
  // PRIORITY 1: Find <video> elements (these are recordable!)
  const videoElements = document.querySelectorAll('video');
  console.log('Found', videoElements.length, 'video elements');
  
  videoElements.forEach((video, index) => {
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
    
    // Generate thumbnail from video
    let thumbnail = null;
    try {
      if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
        const canvas = document.createElement('canvas');
        const aspectRatio = video.videoWidth / video.videoHeight;
        canvas.width = 120; // Thumbnail width
        canvas.height = Math.round(120 / aspectRatio);
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        thumbnail = canvas.toDataURL('image/jpeg', 0.6);
      }
    } catch (error) {
      // Ignore thumbnail generation errors
    }
    
    // Generate video title from page title or video attributes
    const pageTitle = document.title;
    const videoTitle = video.getAttribute('title') || 
                      video.getAttribute('aria-label') || 
                      pageTitle || 
                      `Video ${index + 1}`;
    
    // Even if no sources, still add (might be blob or streaming)
    videos.push({
      type: 'HTML5 Video',
      title: videoTitle,
      sources: sources.length > 0 ? sources : ['blob or streaming'],
      duration: video.duration || 0,
      poster: video.poster || '',
      thumbnail: thumbnail,
      hasVideoElement: true,
      index: index
    });
    
    console.log(`Video ${index + 1}:`, video.duration ? `${Math.round(video.duration)}s` : 'unknown duration', sources.length > 0 ? sources[0] : 'blob/streaming');
  });
  
  // PRIORITY 2: Find Vimeo/YouTube iframes
  document.querySelectorAll('iframe[src*="vimeo.com"], [data-media*="vimeo"]').forEach(elem => {
    const src = elem.src || elem.getAttribute('data-media') || '';
    const videoIdMatch = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (videoIdMatch) {
      videos.push({
        type: 'Vimeo Player',
        videoId: videoIdMatch[1],
        iframeUrl: src.includes('player.vimeo.com') ? src : `https://player.vimeo.com/video/${videoIdMatch[1]}`,
        vimeoUrl: `https://vimeo.com/${videoIdMatch[1]}`,
        embedUrl: src,
        hasIframe: true,
        canRecordFromIframe: true
      });
    }
  });
  
  // Find YouTube embeds
  document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]').forEach(iframe => {
    const src = iframe.src;
    const videoIdMatch = src.match(/(?:embed\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (videoIdMatch) {
      videos.push({
        type: 'YouTube',
        videoId: videoIdMatch[1],
        url: `https://www.youtube.com/watch?v=${videoIdMatch[1]}`,
        embedUrl: src,
        hasVideoElement: false
      });
    }
  });
  
  console.log('Total videos detected:', videos.length);
  return videos;
}

// Display detected videos in popup
export function displayVideos(videos, tabId) {
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
    } else if (video.url) {
      buttonText = '📥 Download Video';
    } else {
      buttonText = 'Open Video Page';
    }
    
    // Generate thumbnail HTML (only for HTML5 Video, not for Network resources)
    let thumbnailHtml = '';
    const isHTML5Video = video.type === 'HTML5 Video';
    
    if (isHTML5Video && video.thumbnail) {
      thumbnailHtml = `
        <div class="video-thumbnail">
          <img src="${video.thumbnail}" alt="Video preview">
          ${video.duration ? `<span class="thumbnail-duration">${Math.floor(video.duration / 60)}:${String(Math.floor(video.duration % 60)).padStart(2, '0')}</span>` : ''}
        </div>
      `;
    }
    
    // Generate video title
    const videoTitle = video.title || `Video ${index + 1}`;
    const videoSubtitle = video.format ? `${video.format}${video.quality && video.quality !== 'Unknown' ? ` - ${video.quality}` : ''}` : '';
    
    videoItem.innerHTML = `
      <div class="video-item-header-title">
        <div class="video-title">${videoTitle}</div>
        ${videoSubtitle ? `<div class="video-subtitle">${videoSubtitle}</div>` : ''}
      </div>
      <div class="video-item-content">
        ${thumbnailHtml}
        <div class="video-item-details">
          <div class="video-item-meta">
            <span class="video-icon">🎥</span>
            <span class="video-type">${video.type}</span>
            ${!video.thumbnail && video.duration ? `<span class="video-duration">${Math.floor(video.duration / 60)}:${String(Math.floor(video.duration % 60)).padStart(2, '0')}</span>` : ''}
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
