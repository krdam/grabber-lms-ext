# 📄 Nano Page Saver

A powerful Chrome extension for saving web pages as HTML or PDF, with advanced video downloader featuring automatic HLS merging via FFmpeg Native Host - comparable to Video DownloadHelper!

**Current Version: 3.3.8**

## ✨ Features

### 📥 Dual Format Support
- **HTML Export**: Save complete web pages with embedded resources
- **PDF Export**: Generate structured, readable PDFs with smart content processing

### 🎯 HTML Save Options
- Include images (converted to base64 inline)
- Include CSS styles for visual preservation
- Keep JavaScript for interactive elements
- Minify HTML for smaller file sizes

### 📑 PDF Intelligence
- **Extract Hidden Content**: Automatically discovers and includes:
  - Modal dialogs and popups
  - Tooltips and hover text
  - Dropdown menus
  - Collapsed/expandable sections
  - Accordion panels (including from modals)
- **Remove Clutter**: Strips away interactive elements:
  - Buttons and form controls
  - Navigation menus
  - Video elements (optional)
- **Structure Content**: Maintains original document structure with images in correct positions
- **Smart Formatting**: Optimal font sizes and clean layout
- **Color Options**: Choose between clean black text or preserve original colors

### 🎥 Advanced Video Detection & Download

#### Automatic Detection
- **HTML5 Video**: Detects `<video>` elements with thumbnails and duration
- **Vimeo**: Auto-extracts HLS streams from iframes (~5 seconds)
- **YouTube**: Attempts auto-extraction from iframes (~3 seconds)
- **Network Monitoring**: Captures video URLs from network requests
- **Hidden Content**: Finds videos in closed modals, popups, and accordions
- **Multiple Formats**: Direct files (MP4, WebM), Adaptive streams (HLS, DASH)

#### Smart Features
- **Video Previews**: Thumbnail with duration for HTML5 videos
- **Individual Titles**: Each video shows page title and format
- **Individual Progress**: Separate progress bar for each download
- **Unique Filenames**: Includes video ID to prevent file replacement
- **Quality Detection**: Automatically selects highest quality
- **Parallel Downloads**: Download multiple videos simultaneously

#### Download Methods

**🟢 Direct Download (MP4, WebM, MOV)**
- One-click download with progress tracking
- Real-time speed and size display
- Supports cancellation

**🔵 HLS Streams (Auto-merge with FFmpeg)**
- **Native Host Integration**: Automatic audio+video merging
- **Status Indicator**: Shows FFmpeg availability (✅ ready / ⚠️ not available)
- **Process**: Downloads video → Downloads audio → Merges automatically → Single MP4 file
- **Time**: ~30-35 seconds total (5s video + 5s audio + 25s merge)
- **Fallback**: Manual merge instructions if FFmpeg not available

**🟡 Vimeo Iframe**
- Opens iframe in background tab
- Captures HLS stream automatically
- Downloads via FFmpeg merge
- Closes tab after extraction

**🟡 YouTube Iframe**
- Attempts auto-extraction from iframe
- Detects HTML5 video element
- Shows warning if blob URL detected
- Fallback to page opening with yt-dlp suggestion

### 🎨 Additional Features
- **Beautiful UI**: Modern, gradient-themed interface with icons
- **Statistics Tracking**: Keep track of saved pages
- **Modular Architecture**: Clean, maintainable code structure
- **Cross-Platform**: Works on any OS that supports Chrome

## 🚀 Installation

### Quick Install

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd grabber-ext
   ```

2. **Load Extension**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `grabber-ext` directory
   - Grant permissions when prompted

3. **Optional: Setup FFmpeg Native Host** (for automatic HLS merging)
   ```bash
   chmod +x setup_native_host.sh
   ./setup_native_host.sh
   ```
   
   This installs:
   - FFmpeg (if not present)
   - Python Native Host script
   - Chrome Native Messaging manifest
   
   See [FFmpeg Setup](#-ffmpeg-native-host-setup) for details.

## 📖 Usage

### Save as HTML

1. Click the extension icon
2. Select "HTML" tab (default)
3. Configure options:
   - ✓ Include images
   - ✓ Include CSS styles
   - ☐ Keep JavaScript (for interactive elements)
   - ☐ Minify HTML
4. Click "Save as HTML"
5. Choose save location

### Save as PDF

1. Click the extension icon
2. Select "PDF" tab
3. Configure options:
   - ✓ Extract hidden content
   - ✓ Remove interactive controls
   - ☐ Include videos
   - ☐ Preserve colors
4. Click "Save as PDF"
5. Chrome print dialog opens automatically
6. Select "Save as PDF" → Save

### Download Videos

1. Click the extension icon
2. Videos section appears automatically if videos found
3. Each video shows:
   - **Title**: Page/video title
   - **Format**: HTML5 Video, Vimeo, YouTube, HLS, etc.
   - **Preview**: Thumbnail with duration (HTML5 only)
   - **Info**: Download method and estimated time
4. Click download button for the video you want
5. Monitor progress in individual progress bar
6. Files saved with unique IDs (no replacements)

**Video Types:**

- **HTML5 Video** → Direct download or record playback
- **Vimeo** → Auto-extract HLS → FFmpeg merge
- **YouTube** → Try auto-extract (may need yt-dlp)
- **HLS Network** → FFmpeg auto-merge or manual download
- **Direct MP4/WebM** → Instant download

## 🔧 FFmpeg Native Host Setup

### What is it?

The Native Host is a bridge between the Chrome extension and FFmpeg on your system. It enables **automatic merging** of HLS video+audio files into a single playable MP4.

### Installation

**Automatic Setup:**
```bash
./setup_native_host.sh
```

This script:
1. Checks/installs FFmpeg
2. Creates Python Native Host script (`~/.local/share/chrome-native-messaging/video_merger_host.py`)
3. Installs Chrome manifest (`~/.local/share/chrome-native-messaging/com.nanopagesaver.videomerger.json`)
4. Detects and sets correct Extension ID

**Manual Setup:**

1. **Install FFmpeg:**
   ```bash
   # Ubuntu/Debian
   sudo apt install ffmpeg
   
   # macOS
   brew install ffmpeg
   ```

2. **Get Extension ID:**
   - Go to `chrome://extensions/`
   - Enable Developer mode
   - Find "Nano Page Saver"
   - Copy the ID (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

3. **Update Extension ID:**
   ```bash
   ./update_extension_id.sh YOUR_EXTENSION_ID
   ```

### Verification

Open the extension → If you see:
- ✅ **"FFmpeg ready - auto-merge enabled"** → Working!
- ⚠️ **"Checking FFmpeg..."** → Not available

## 🎯 Features in Detail

### PDF Export

#### Hidden Content Extraction
Automatically finds and includes:
- Modal dialogs with `[role="dialog"]`, `[aria-modal="true"]`
- Accordion panels (`.accordion__body`, `.collapse`)
- Hidden sections with `[aria-hidden="true"]`, `[hidden]`, `.hidden`
- Tooltips and `aria-label` text
- Background images from CSS

#### Accordion Support
Handles accordion headers correctly:
- Extracts headers even from complex IDs
- Searches parent elements for headers
- Matches by index if ID-based search fails
- Prepends headers to accordion bodies

#### Smart Image Processing
- Converts CSS background-images to `<img>` tags
- Filters by container selectors (`.carousel__image`, `.explorer__item`, etc.)
- Preserves text content (no overwriting)
- Deduplicates images

### Video Download

#### Detection Methods
1. **DOM Scanning**: Finds `<video>` elements (even in hidden modals)
2. **Iframe Detection**: Vimeo and YouTube embeds
3. **Network Monitoring**: Captures HLS/DASH manifests and direct files
4. **Temporary Expansion**: Shows hidden modals/accordions briefly to detect all videos

#### Thumbnail Generation
For HTML5 videos:
1. Tries using `video.poster` attribute
2. Loads video metadata (max 2 second wait)
3. Captures first frame to canvas
4. Converts to JPEG thumbnail
5. Displays with duration overlay

#### HLS Processing
1. **Parse Manifest**: Detects master/variant playlists
2. **Check Audio**: Determines if audio is separate
3. **Download Strategy**:
   - **Simple HLS** → Download segments → Merge locally
   - **Separate audio** → Download video + audio → FFmpeg merge
4. **Progress Tracking**: Individual progress for each file

#### Vimeo Auto-Extraction
1. Detects `iframe[src*="vimeo.com"]`
2. Opens iframe in background tab (not visible)
3. Waits 5 seconds for HLS manifest
4. Captures network request
5. Closes tab
6. Downloads HLS via FFmpeg merge

#### YouTube Auto-Extraction
1. Detects `iframe[src*="youtube.com"]`
2. Opens iframe in background tab
3. Tries to find HTML5 video element
4. If blob URL → Shows warning + suggestion to use yt-dlp
5. If direct URL → Attempts download
6. Fallback → Opens YouTube page

### File Naming
All downloads include unique identifiers:
```
PageTitle_VideoID_Index.ext
```
Examples:
- `Module_2_Technology_547840560_1.mp4` (Vimeo ID)
- `Video_Page_playlist_2.mp4` (HLS segment)
- `Tutorial_abc12345_3.webm` (URL hash)
- `Lecture_1760138950_1.mp4` (Timestamp fallback)

## 📁 Project Structure

```
grabber-ext/
├── manifest.json           # Extension configuration (v3.3.8)
├── popup.html             # Extension UI
├── popup.css              # Styling
├── popup.js               # Main logic + orchestration
├── background.js          # Service worker (network monitoring)
├── .gitignore            # Git ignore rules
├── README.md             # This file
├── setup_native_host.sh  # FFmpeg setup script
├── update_extension_id.sh # Extension ID updater
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── modules/              # Modular functionality
    ├── video-detector.js    # Video detection & UI display
    ├── download-manager.js  # Download tracking & progress
    ├── hls-downloader.js    # HLS manifest parsing & download
    ├── native-merger.js     # FFmpeg Native Host integration
    ├── pdf-processor.js     # PDF content extraction
    ├── html-processor.js    # HTML processing & export
    └── utils.js            # Utility functions
```

## 🔒 Permissions

- **activeTab**: Access current tab when extension is opened
- **downloads**: Save files and track download progress
- **storage**: Store settings and statistics
- **scripting**: Execute content processing scripts
- **webRequest**: Monitor network requests for video URLs
- **nativeMessaging**: Communicate with FFmpeg Native Host
- **optional_host_permissions**: Access http/https pages (requested on first use)

## 🐛 Troubleshooting

### PDF Issues

**Content missing?**
- Enable "Extract hidden content"
- Scroll through entire page before saving
- Wait for lazy-loaded content

**Accordion headers missing?**
- Should be automatic in v3.3.8+
- Check console for extraction logs

### Video Issues

**No videos detected?**
- Scroll through page (lazy-loading)
- Open modals/popups manually (extension will detect)
- Check if page uses custom players

**Vimeo download fails?**
- ✅ FFmpeg ready? Check status indicator
- Try reloading page and extension
- Check console for error messages

**YouTube download fails?**
- YouTube often uses blob URLs (cannot download)
- Use `yt-dlp` or `youtube-dl` for YouTube:
  ```bash
  yt-dlp https://youtube.com/watch?v=VIDEO_ID
  ```

**HLS has no audio?**
- If FFmpeg not available, you'll get 2 separate files
- Merge manually with FFmpeg:
  ```bash
  ffmpeg -i video.mp4 -i audio.m4a -c copy output.mp4
  ```
- Or use online tools (search "merge video audio online")

**No thumbnail for video?**
- Normal for network-captured resources (HLS, DASH)
- Thumbnails only for HTML5 `<video>` elements
- Extension tries `poster` attribute first, then captures frame

### FFmpeg Native Host

**Status shows "Checking FFmpeg..."?**
1. Run `./setup_native_host.sh`
2. Check Extension ID matches:
   ```bash
   ./update_extension_id.sh YOUR_EXTENSION_ID
   ```
3. Verify FFmpeg installed:
   ```bash
   ffmpeg -version
   ```
4. Check manifest exists:
   ```bash
   cat ~/.local/share/chrome-native-messaging/com.nanopagesaver.videomerger.json
   ```

**Merge fails?**
- Check downloads folder for temp files (`*_VIDEO.mp4`, `*_AUDIO.m4a`)
- Check system logs: `journalctl -f | grep ffmpeg`
- Run Native Host manually to test:
  ```bash
  python3 ~/.local/share/chrome-native-messaging/video_merger_host.py
  ```

## 🆚 Comparison: Native Host vs Manual

| Feature | With FFmpeg Native Host | Without Native Host |
|---------|------------------------|---------------------|
| HLS Download | ✅ Automatic merge | ⚠️ 2 separate files |
| User Action | Click once | Download + manual merge |
| Time | ~35 seconds | Depends on tool |
| Quality | Original | Original |
| Ease of Use | 🟢 Very Easy | 🟡 Manual work |
| Requirements | FFmpeg + Python | Any merge tool |

## 📝 Development

### Making Changes

1. Edit source files
2. Go to `chrome://extensions/`
3. Click refresh button on extension card
4. Test changes

### Debugging

- **Popup**: Right-click popup → Inspect → Console
- **Background**: `chrome://extensions/` → Inspect views: service worker
- **Content Scripts**: F12 on page → Console

### Module Structure

The extension uses ES6 modules for clean organization:
- `video-detector.js`: Exports `detectVideos()`, `displayVideos()`
- `download-manager.js`: Exports `DownloadManager` class
- `hls-downloader.js`: Exports `HLSDownloader` class
- `native-merger.js`: Exports `NativeMerger` class
- `pdf-processor.js`: Exports PDF processing functions
- `html-processor.js`: Exports HTML processing functions
- `utils.js`: Exports utility functions

## 📄 License

This project is open source and available for personal and commercial use.

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📮 Support

Issues or suggestions? Create an issue in the repository.

---

## 📋 Changelog

### Version 3.3.8 (Current)
- ✨ **YouTube Support**: Auto-extraction from iframes (similar to Vimeo)
- ✨ Attempts to find HTML5 video element in YouTube embed
- ⚠️ Shows warning if blob URL detected (use yt-dlp recommendation)
- 🔄 Fallback to opening YouTube page

### Version 3.3.7
- ✨ **Video Previews**: Thumbnails with duration for HTML5 videos
- 🐛 **Fixed Duration**: Proper validation and formatting (MM:SS)
- ⚡ **Async Thumbnails**: Waits for video metadata (max 2s timeout)
- 📊 Falls back to `poster` attribute if frame capture fails

### Version 3.3.6
- ✨ **Unique Filenames**: Videos include ID to prevent file replacement
- 📝 Format: `PageTitle_VideoID_Index.ext`
- 🎯 Uses Vimeo ID, URL hash, or timestamp

### Version 3.3.5
- 🐛 **Critical Fix**: Vimeo deduplication logic corrected
- ✅ All unique videos now display properly
- 🗑️ Removed obsolete `mux.min.js` reference

### Version 3.3.0
- ✨ **Native Host Integration**: FFmpeg auto-merge for HLS
- ✨ **Vimeo Auto-Extract**: Background tab extraction (~5s)
- ✨ **Individual Progress**: Separate progress bar per video
- ✨ **Video Titles**: Shows page title and format for each video
- 📊 **Status Indicator**: FFmpeg availability shown at top
- 🗑️ Removed recording functionality (replaced by Native Host)

### Version 3.2.0
- ✨ **Modular Architecture**: Split into 7 logical modules
- 📁 Clean project structure
- 🔧 Better maintainability

### Version 3.1.0
- ✨ **Hidden Video Detection**: Finds videos in closed modals/popups
- ⚡ Temporary expansion of hidden containers
- 🔍 Detects videos in accordions, dropdowns, hidden sections

### Version 3.0.0
- ✨ **Advanced Video Detection**: Network monitoring + DOM scanning
- ✨ **HLS Support**: Manifest parsing and segment download
- ✨ **Progress Tracking**: Real-time download progress
- ✨ **Multiple Videos**: Parallel downloads with individual tracking

### Version 1.5.7
- ✅ Accordion content extraction fixed
- ✅ PDF: Automatically expands hidden content

### Version 1.5.6
- 🎉 Initial release
- 📄 HTML and PDF export
- 🎥 Basic video detection

---

**Made with ❤️ for preserving web content**

**Current Version: 3.3.8** | [Report Issues](https://github.com/your-repo/issues) | [Contribute](https://github.com/your-repo/pulls)
