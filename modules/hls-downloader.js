// HLS Segment Downloader Module

export class HLSDownloader {
  constructor(nativeMerger = null) {
    this.segments = [];
    this.audioSegments = [];
    this.downloadedSegments = [];
    this.downloadedAudioSegments = [];
    this.taskId = null;
    this.nativeMerger = nativeMerger; // Native Merger for FFmpeg integration
  }
  
  setNativeMerger(merger) {
    this.nativeMerger = merger;
  }
  
  // Parse m3u8 manifest
  async parseM3U8(url) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      
      const lines = text.split('\n').filter(line => line.trim());
      const segments = [];
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip comments and tags (except segment info)
        if (line.startsWith('#')) {
          // Check for variant playlists (master m3u8)
          if (line.includes('RESOLUTION=')) {
            const nextLine = lines[i + 1];
            if (nextLine && !nextLine.startsWith('#')) {
              // This is a master playlist with variants
              return {
                isMaster: true,
                variants: this.parseVariants(text, baseUrl)
              };
            }
          }
          continue;
        }
        
        // This is a segment URL
        if (line && !line.startsWith('#')) {
          const segmentUrl = line.startsWith('http') ? line : baseUrl + line;
          segments.push({
            url: segmentUrl,
            index: segments.length
          });
        }
      }
      
      return {
        isMaster: false,
        segments: segments,
        totalSegments: segments.length
      };
    } catch (error) {
      console.error('Error parsing m3u8:', error);
      throw new Error('Failed to parse HLS manifest: ' + error.message);
    }
  }
  
  parseVariants(manifestText, baseUrl) {
    const lines = manifestText.split('\n');
    const variants = [];
    const audioTracks = [];
    
    // First, find audio tracks
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('#EXT-X-MEDIA:TYPE=AUDIO')) {
        const uriMatch = line.match(/URI="([^"]+)"/);
        const groupIdMatch = line.match(/GROUP-ID="([^"]+)"/);
        const nameMatch = line.match(/NAME="([^"]+)"/);
        
        if (uriMatch) {
          const audioUrl = uriMatch[1].startsWith('http') ? 
            uriMatch[1] : 
            baseUrl + uriMatch[1];
          
          audioTracks.push({
            url: audioUrl,
            groupId: groupIdMatch ? groupIdMatch[1] : null,
            name: nameMatch ? nameMatch[1] : 'Audio'
          });
        }
      }
    }
    
    // Then find video variants
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('#EXT-X-STREAM-INF:')) {
        const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
        const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
        const audioMatch = line.match(/AUDIO="([^"]+)"/);
        
        const nextLine = lines[i + 1];
        if (nextLine && !nextLine.startsWith('#')) {
          const variantUrl = nextLine.trim().startsWith('http') ? 
            nextLine.trim() : 
            baseUrl + nextLine.trim();
          
          // Find matching audio track
          let audioTrack = null;
          if (audioMatch && audioTracks.length > 0) {
            audioTrack = audioTracks.find(track => track.groupId === audioMatch[1]) || audioTracks[0];
          }
          
          variants.push({
            url: variantUrl,
            resolution: resolutionMatch ? `${resolutionMatch[2]}p` : 'Unknown',
            width: resolutionMatch ? parseInt(resolutionMatch[1]) : 0,
            height: resolutionMatch ? parseInt(resolutionMatch[2]) : 0,
            bandwidth: bandwidthMatch ? parseInt(bandwidthMatch[1]) : 0,
            audioTrack: audioTrack
          });
        }
      }
    }
    
    // Sort by quality (highest first)
    variants.sort((a, b) => b.height - a.height);
    
    return {
      variants: variants,
      hasAudioTracks: audioTracks.length > 0,
      audioTracks: audioTracks
    };
  }
  
  async downloadSegmentedVideo(manifestUrl, filename, videoInfo, onProgress) {
    this.taskId = `hls_${Date.now()}`;
    this.segments = [];
    this.audioSegments = [];
    this.downloadedSegments = [];
    this.downloadedAudioSegments = [];
    
    try {
      // Parse manifest
      onProgress({ stage: 'parsing', progress: 0, message: 'Parsing manifest...' });
      const manifest = await this.parseM3U8(manifestUrl);
      
      // Handle master playlist (multiple qualities)
      if (manifest.isMaster) {
        const variantsData = manifest.variants;
        
        if (!variantsData || variantsData.variants.length === 0) {
          throw new Error('No video variants found in master playlist');
        }
        
        // Use highest quality by default
        const bestVariant = variantsData.variants[0];
        console.log(`Selected quality: ${bestVariant.resolution} (${bestVariant.bandwidth} bps)`);
        console.log(`Has separate audio tracks: ${variantsData.hasAudioTracks}`);
        
        onProgress({ 
          stage: 'selecting', 
          progress: 0, 
          message: `Selected: ${bestVariant.resolution}${variantsData.hasAudioTracks ? ' + Audio' : ''}` 
        });
        
        // Parse the video variant playlist
        const variantManifest = await this.parseM3U8(bestVariant.url);
        if (variantManifest.isMaster) {
          throw new Error('Nested master playlists not supported');
        }
        this.segments = variantManifest.segments;
        
        // If there's a separate audio track, download it too
        if (bestVariant.audioTrack) {
          console.log(`Downloading audio track: ${bestVariant.audioTrack.name}`);
          onProgress({ 
            stage: 'parsing', 
            progress: 5, 
            message: 'Parsing audio track...' 
          });
          
          const audioManifest = await this.parseM3U8(bestVariant.audioTrack.url);
          this.audioSegments = audioManifest.segments || [];
          console.log(`Found ${this.audioSegments.length} audio segments`);
        } else {
          this.audioSegments = [];
        }
      } else {
        this.segments = manifest.segments;
        this.audioSegments = [];
      }
      
      if (this.segments.length === 0) {
        throw new Error('No segments found in manifest');
      }
      
      const totalSegments = this.segments.length + this.audioSegments.length;
      console.log(`Found ${this.segments.length} video segments and ${this.audioSegments.length} audio segments`);
      
      if (this.audioSegments.length > 0) {
        console.log('⚠️ Separate audio track detected - merging may not work perfectly');
        onProgress({ 
          stage: 'downloading', 
          progress: 0, 
          message: `Downloading ${this.segments.length} video + ${this.audioSegments.length} audio segments...` 
        });
      } else {
        onProgress({ 
          stage: 'downloading', 
          progress: 0, 
          message: `Downloading ${this.segments.length} segments...` 
        });
      }
      
      let completedSegments = 0;
      
      // Download all video segments
      for (let i = 0; i < this.segments.length; i++) {
        const segment = this.segments[i];
        
        try {
          const response = await fetch(segment.url);
          if (!response.ok) {
            throw new Error(`Video segment ${i + 1} failed: ${response.status}`);
          }
          
          const blob = await response.blob();
          this.downloadedSegments.push(blob);
          
          completedSegments++;
          const progress = (completedSegments / totalSegments) * 100;
          onProgress({ 
            stage: 'downloading', 
            progress: progress, 
            message: `Video: ${i + 1}/${this.segments.length}${this.audioSegments.length > 0 ? `, Audio: 0/${this.audioSegments.length}` : ''}`,
            segment: completedSegments,
            totalSegments: totalSegments
          });
        } catch (error) {
          console.error(`Error downloading video segment ${i + 1}:`, error);
          throw new Error(`Failed to download video segment ${i + 1}: ${error.message}`);
        }
      }
      
      // Download all audio segments if present
      if (this.audioSegments.length > 0) {
        for (let i = 0; i < this.audioSegments.length; i++) {
          const segment = this.audioSegments[i];
          
          try {
            const response = await fetch(segment.url);
            if (!response.ok) {
              throw new Error(`Audio segment ${i + 1} failed: ${response.status}`);
            }
            
            const blob = await response.blob();
            this.downloadedAudioSegments.push(blob);
            
            completedSegments++;
            const progress = (completedSegments / totalSegments) * 100;
            onProgress({ 
              stage: 'downloading', 
              progress: progress, 
              message: `Video: ${this.segments.length}/${this.segments.length}, Audio: ${i + 1}/${this.audioSegments.length}`,
              segment: completedSegments,
              totalSegments: totalSegments
            });
          } catch (error) {
            console.error(`Error downloading audio segment ${i + 1}:`, error);
            throw new Error(`Failed to download audio segment ${i + 1}: ${error.message}`);
          }
        }
      }
      
      // Merge segments
      onProgress({ stage: 'merging', progress: 95, message: 'Merging segments...' });
      
      // Create video blob
      const videoBlob = new Blob(this.downloadedSegments, { type: 'video/mp4' });
      
      // Simple HLS (audio already in video segments) - just merge
      if (this.downloadedAudioSegments.length === 0) {
        console.log('Simple HLS: audio already included in video segments');
        
        const mergedBlob = videoBlob;
      
        // Create download URL
        const url = URL.createObjectURL(mergedBlob);
        
        onProgress({ stage: 'saving', progress: 100, message: 'Saving file...' });
        
        // Trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Cleanup
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        
        onProgress({ 
          stage: 'completed', 
          progress: 100, 
          message: 'Download completed!',
          size: mergedBlob.size
        });
        
        return { 
          success: true, 
          size: mergedBlob.size,
          hadSeparateAudio: false
        };
        
      } else {
        // Separate audio tracks - try Native Merger first, then fallback to 2 files
        const audioBlob = new Blob(this.downloadedAudioSegments, { type: 'audio/mp4' });
        
        console.log(`📹 Video size: ${Math.round(videoBlob.size / 1024 / 1024)}MB`);
        console.log(`🔊 Audio size: ${Math.round(audioBlob.size / 1024 / 1024)}MB`);
        
        // Try Native Merger if available
        if (this.nativeMerger) {
          console.log('Attempting automatic merge with Native Host + FFmpeg...');
          onProgress({ stage: 'checking', progress: 93, message: 'Checking Native Host...' });
          
          try {
            const isAvailable = await this.nativeMerger.isAvailable();
            
            if (isAvailable) {
              console.log('✓ Native Host available! Using FFmpeg for fast merge...');
              onProgress({ stage: 'merging', progress: 95, message: 'Merging with FFmpeg (fast!)...' });
              
              const mergeResult = await this.nativeMerger.mergeVideoAudio(
                videoBlob,
                audioBlob,
                filename,
                onProgress
              );
              
              if (mergeResult.success) {
                console.log(`✅ Successfully merged with Native Host!`);
                console.log(`Output: ${mergeResult.path}`);
                
                onProgress({ 
                  stage: 'completed', 
                  progress: 100, 
                  message: `✅ Video with audio saved to Downloads!`,
                  size: mergeResult.size
                });
                
                return { 
                  success: true, 
                  size: mergeResult.size,
                  hadSeparateAudio: true,
                  merged: true,
                  output_path: mergeResult.path
                };
              } else {
                console.warn('Native Host merge failed, falling back to 2 files...');
              }
            } else {
              console.warn('Native Host not available, falling back to 2 files...');
            }
          } catch (error) {
            console.warn('Error with Native Host:', error);
            console.log('Falling back to 2-file download...');
          }
        }
        
        // Fallback: Native Host not available
        console.error('❌ Native Host not available - cannot merge video and audio');
        
        onProgress({ 
          stage: 'error', 
          progress: 0, 
          message: '❌ FFmpeg not configured. Run ./update_extension_id.sh to enable auto-merge'
        });
        
        return { 
          success: false,
          error: 'Native Host (FFmpeg) not available. Please configure it using ./update_extension_id.sh'
        };
      }
      
    } catch (error) {
      console.error('Error downloading segmented video:', error);
      onProgress({ 
        stage: 'error', 
        progress: 0, 
        message: error.message 
      });
      return { success: false, error: error.message };
    }
  }
}

