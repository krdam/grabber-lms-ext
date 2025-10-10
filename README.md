# 📄 Nano Page Saver

A powerful Chrome extension for saving web pages as HTML or PDF, with advanced video downloader featuring HLS segment merging - similar to Video DownloadHelper but built-in!

## ✨ Features

### 📥 Dual Format Support
- **HTML Export**: Save complete web pages with embedded resources
- **PDF Export**: Generate structured, readable PDFs with smart content processing

### 🎯 HTML Save Options
- Include images (converted to base64 inline)
- Include CSS styles for visual preservation
- Minify HTML for smaller file sizes

### 📑 PDF Intelligence
- **Extract Hidden Content**: Automatically discovers and includes:
  - Modal dialogs and popups
  - Tooltips and hover text
  - Dropdown menus
  - Collapsed/expandable sections
- **Remove Clutter**: Strips away interactive elements:
  - Buttons and form controls
  - Navigation menus
  - Ads and social media widgets
- **Structure Content**: Maintains original document structure with images in correct positions
- **Clean Format**: All text converted to black for optimal readability

### 🎥 Advanced Video Detection & Download
- **Network Monitoring**: Captures video URLs from network requests
- **Multiple Formats**: Direct files (MP4, WebM), Adaptive streams (HLS, DASH), YouTube, Vimeo
- **HLS Intelligent Processing**: Automatically downloads segments OR records playback based on audio configuration
- **Separate Audio Handling**: Detects separate audio tracks and uses browser's native HLS player + MediaRecorder
- **Direct Download**: One-click download for direct video files with progress tracking
- **Quality Detection**: Automatically detects and selects highest quality (720p, 1080p, 4K, etc.)
- **Manifest Parsing**: Handles master and variant HLS playlists with audio track detection
- **Real-time Progress**: Live download progress with segment counter and recording status
- **MediaRecorder Integration**: Browser-native recording ensures perfect audio+video sync
- **Parallel Downloads**: Download multiple videos simultaneously with individual progress bars
- **Smart Categorization**: Distinguishes between direct files, HLS streams, and other formats
- **Audio Guaranteed**: MediaRecorder captures browser's muxed stream with audio

### 🎨 Additional Features
- **Beautiful UI**: Modern, gradient-themed interface
- **Statistics Tracking**: Keep track of how many pages you've saved
- **Cross-Platform**: Works on any operating system that supports Chrome

## 🚀 Installation

### From Source

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked"
5. Select the `grabber-ext` directory
6. When prompted, grant permissions to access web pages

**Note**: The extension requires permission to access http and https pages to extract and save content. This is normal for page saving extensions.

## 📖 Usage

### HTML Export
1. **Open the Extension**: Click on the Nano Page Saver icon in your browser toolbar
2. **Select Format**: Click the "HTML" button (selected by default)
3. **Configure Options**: Choose your save preferences:
   - ✓ Include images - Embeds images as base64 data URLs
   - ✓ Include CSS styles - Preserves page styling
   - ☐ Keep JavaScript - Enables interactive elements (buttons, animations, etc.)
   - ☐ Minify HTML - Reduces file size by removing whitespace
4. **Save**: Click the "Save as HTML" button
5. **Choose Location**: Select where to save the HTML file

### PDF Export
1. **Open the Extension**: Click on the Nano Page Saver icon in your browser toolbar
2. **Select Format**: Click the "PDF" button
3. **Configure Options**: Choose processing preferences:
   - ✓ Extract hidden content - Discovers popups, tooltips, and dropdowns
   - ✓ Remove interactive controls - Strips buttons, inputs, and navigation
   - ☐ Preserve original text and background colors - Keep page's original color scheme
4. **Save**: Click the "Save as PDF" button
5. **Print Dialog**: Chrome's print dialog will open automatically
   - Select **"Save as PDF"** as Destination
   - Click **Save** button
   - Tab will close automatically after saving

## 🎨 Features in Detail

### HTML Export Features

#### Accordion & Hidden Content Support
The extension automatically expands all collapsed accordion panels and hidden sections before extraction:
- Bootstrap accordions (`.collapse` class)
- E-learning platform accordions (`.accordion__body` class)
- Elements with `aria-hidden="true"` or `aria-expanded="false"`
- Hidden `<details>` elements
- Generic hidden content with `display:none` or `.hidden` class

This ensures that all page content is captured, including content that's collapsed or hidden by default.

#### Image Handling
When "Include images" is enabled, the extension attempts to convert all images to base64 data URLs, making the saved HTML file completely self-contained. Images that can't be converted (due to CORS restrictions) will retain their original URLs.

#### Style Preservation
The extension can inline both external stylesheets and computed styles, ensuring that the saved page looks as close as possible to the original. This includes:
- External CSS files
- Inline styles
- Computed styles for important elements

#### JavaScript Preservation
By default, all JavaScript is removed for security reasons. However, you can enable "Keep JavaScript" to:
- Preserve interactive elements (dropdowns, accordions, modals)
- Keep animations and dynamic content
- Maintain form functionality
- **Warning**: Only enable for trusted pages, as scripts can pose security risks

#### HTML Minification
Enable this option to remove unnecessary whitespace from the HTML, reducing file size without affecting appearance.

### Video Download Features

#### Automatic Video Detection
When you open the extension, it automatically scans the current page for videos:
- **HTML5 Videos**: `<video>` tags with source URLs
- **YouTube**: Embedded YouTube videos (iframe embeds)
- **Vimeo**: Embedded Vimeo videos

#### Video Download Options
- **HTML5 Videos & Network Captures**: Records video playback and saves to disk
  - Uses MediaRecorder API to capture video stream
  - Saves as .webm format
  - Records current playback in real-time
- **YouTube/Vimeo**: Opens video page in new tab (use external tools like yt-dlp)

Videos are displayed in a dedicated "🎥 Videos Found on Page" section at the bottom of the popup.

**Video Detection Methods:**
1. **Network Monitoring**: Captures video URLs from HTTP requests (MP4, WebM, HLS manifests, DASH)
2. **DOM Scanning**: Finds `<video>` elements with their sources
3. **Embed Detection**: Identifies YouTube and Vimeo players

**Video Types and Actions:**

🟢 **Direct Download (Green badge)**
- File types: MP4, WebM, OGG, MOV
- Action: Click "Download [FORMAT]" to start immediate download
- Features:
  - Real-time progress bar with download speed
  - Displays file size and remaining time
  - Can cancel download mid-progress
  - Multiple simultaneous downloads supported

🔵 **HLS Streams (Blue/Green badge)**
- Format: HLS (.m3u8)
- Action: Click "Download HLS" to process the stream
- **Intelligent Audio Handling:**
  - 🟢 Simple HLS (audio in video): Downloads and merges segments → Single MP4 file
  - 🔊 Separate audio tracks (Vimeo, etc.): **You choose the method**
- Features:
  - Automatic manifest parsing (master and variant playlists)
  - Detects separate audio tracks automatically
  - Selects highest quality by default
  - User-friendly choice dialog
  - No external tools required!
  
**🔊 Two methods for separate audio tracks:**

1. **📥 Download as 2 files (FAST ~30 sec)**
   - Downloads: `video_VIDEO.mp4` + `video_AUDIO.m4a`
   - Need to merge: Online tools, FFmpeg, or VLC
   - Merge instructions shown automatically
   - Best for: Batch processing, offline merging
   
2. **🎥 Record playback (SLOW ~video length)**
   - Downloads: Single `video.webm` file
   - Ready to play immediately
   - MediaRecorder captures browser's muxed stream
   - Best for: One video, immediate playback

🟡 **DASH Streams (Yellow badge)**
- Format: DASH (.mpd)
- Action: Click "Open URL" to access stream URL
- Note: Requires external tools (Video DownloadHelper, yt-dlp) for processing

🔵 **HTML5 Video Recording (Blue badge)**
- Source: `<video>` elements on page
- Action: Click "Start Recording"
- Process:
  1. Video plays automatically
  2. Records using MediaRecorder API (2.5Mbps, WebM format)
  3. Downloads when complete
  4. Recording time = Video duration (max 5 minutes)

🔴 **Vimeo iframe**
- Action: Click "Open Vimeo Player"
- Opens player in new tab where video can be recorded

**Download Progress Section:**
- Appears when downloads are active
- Shows for each download:
  - Status icon (⏳ downloading, ✓ completed, ✗ error)
  - Filename
  - Progress bar
  - Download speed (MB/s)
  - Downloaded/Total size
  - Cancel button (while downloading)
- Completed downloads auto-remove after 5 seconds

### PDF Export Features

#### Hidden Content Extraction
The PDF processor intelligently searches for and extracts hidden content that users might miss:
- **Modal Dialogs**: Popup windows and overlays that appear on user interaction
- **Tooltips**: Hover text and aria-labels that provide additional information
- **Dropdown Menus**: All options in select elements and menu lists
- **Expandable Sections**: Content hidden in accordions and collapsible elements
- **Accordion Panels**: Automatically expands Bootstrap, e-learning platform, and custom accordion content
  - Handles `aria-hidden="true"`, `aria-expanded="false"` attributes
  - Expands `.collapse`, `.accordion__body` classes
  - Forces visibility of all hidden content before extraction

All extracted content is clearly labeled and organized in dedicated sections.

#### Interactive Element Removal
To create a clean, readable PDF, the extension removes:
- Form inputs (buttons, text fields, checkboxes)
- Navigation menus and toolbars
- Social media sharing buttons
- Advertisement containers
- JavaScript and other non-content elements

#### Content Structuring
The processor maintains the original page structure:
- Preserves document order and hierarchy
- Keeps images in their original positions with correct sizes
- Maintains logical reading order
- Smart image sizing: uses container size if smaller than intrinsic size
- Optional: Convert all text to black for better readability (default)
- Optional: Preserve original text and background colors

## 🔧 Technical Details

### Manifest Version
This extension uses Manifest V3, the latest Chrome extension standard.

### Permissions
- `activeTab`: Temporary access to the current tab when extension is clicked
- `downloads`: Ability to save files and track download progress
- `storage`: Store extension settings, statistics, and download history
- `scripting`: Execute content processing scripts for PDF generation and video detection
- `webRequest`: Monitor network requests to capture video URLs
- `optional_host_permissions`: Access to http and https pages for content extraction (requested on first use)

### File Structure
```
grabber-ext/
├── manifest.json       # Extension configuration
├── popup.html         # Extension popup interface
├── popup.css          # Popup styling
├── popup.js           # Popup functionality with PDF processor
├── content.js         # Content script for page access
├── background.js      # Background service worker
├── icons/             # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md          # This file
```

## 🛠️ Development

### Requirements
- Chrome/Chromium browser (version 88 or later)
- Basic knowledge of HTML, CSS, and JavaScript

### Making Changes
1. Edit the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Nano Page Saver card
4. Test your changes

## 📝 Notes

- **Security**: The extension removes all `<script>` tags from saved pages for security reasons
- **CORS**: Some external resources may not be accessible due to Cross-Origin Resource Sharing (CORS) policies
- **File Size**: Embedding images as base64 can significantly increase file size

## 🐛 Troubleshooting

### HTML Export Issues

**Problem**: Images don't appear in saved pages
- **Solution**: Make sure "Include images" is checked. Some images may be blocked by CORS policies.

**Problem**: Styling looks different
- **Solution**: Enable "Include CSS styles" option. Some dynamically loaded styles may not be captured.

### PDF Export Issues

**Problem**: PDF doesn't include all content
- **Solution**: Make sure "Extract hidden content" and "Structure content" are both enabled.

**Problem**: PDF has too much clutter
- **Solution**: Enable "Remove interactive controls" to clean up the output.

**Problem**: Some content still missing from PDF
- **Solution**: Some dynamically loaded content may not be captured if it hasn't been loaded in the page yet. Make sure to:
  - Scroll through the entire page before saving
  - Wait for any lazy-loaded content to appear
  - Interact with dropdowns and tabs to trigger content loading
  - Note: Version 1.5.7+ automatically expands all accordion panels and `aria-hidden` content

**Problem**: PDF formatting looks wrong
- **Solution**: The PDF uses a clean, readable format by default. The original page styling is intentionally simplified for better readability.

### General Issues

**Problem**: Extension doesn't appear in toolbar
- **Solution**: Pin the extension by clicking the puzzle icon in Chrome's toolbar and selecting the pin icon next to Nano Page Saver.

**Problem**: Print dialog closes immediately
- **Solution**: This is normal. The print dialog will open automatically. Use "Save as PDF" in the destination dropdown.

### Video Download Issues

**Problem**: No videos detected
- **Solution**: The page might use custom video players or lazy-loading. Try scrolling through the page first.

**Problem**: Can't download YouTube/Vimeo videos
- **Solution**: These platforms use DRM. The extension opens the video page - use external tools like yt-dlp, youtube-dl, or specialized browser extensions.

**Problem**: HTML5 video download fails
- **Solution**: Some videos are protected by CORS policies. The extension can only download publicly accessible videos.

## 📄 License

This project is open source and available for personal and commercial use.

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## 📮 Support

If you encounter any issues or have suggestions, please create an issue in the repository.

---

## 📋 Changelog

### Version 1.5.7 (Latest)
**Bug Fix**: Fixed accordion content not being saved
- ✅ Automatically expands all collapsed accordion panels before extraction
- ✅ Handles Bootstrap `.collapse` and e-learning `.accordion__body` classes
- ✅ Expands all `aria-hidden="true"` and `aria-expanded="false"` elements
- ✅ Forces visibility of hidden `<details>` elements
- ✅ Works for both HTML and PDF exports
- 🎯 Critical fix for e-learning platforms and accordion-based layouts

### Version 1.5.6
- PDF export with intelligent content extraction
- Hidden content detection (modals, tooltips, collapsed sections)
- Video detection and recording
- HTML export with inline resources

---

Made with ❤️ for preserving web content

