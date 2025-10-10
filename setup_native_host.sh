#!/bin/bash
# Quick setup script for Nano Page Saver Native Host

set -e

echo "🚀 Nano Page Saver - Native Host Setup"
echo "======================================="
echo ""

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg not found!"
    echo ""
    echo "Installing FFmpeg..."
    echo "This requires your password (sudo):"
    sudo apt update
    sudo apt install -y ffmpeg
    echo ""
    echo "✅ FFmpeg installed!"
else
    echo "✅ FFmpeg already installed: $(ffmpeg -version | head -1)"
fi

echo ""
echo "======================================="
echo "📋 Next steps:"
echo "======================================="
echo ""
echo "1. Install the extension in Chrome"
echo "   - Go to chrome://extensions/"
echo "   - Enable 'Developer mode'"
echo "   - Click 'Load unpacked'"
echo "   - Select: $(pwd)"
echo ""
echo "2. Copy the Extension ID"
echo "   - Find 'Nano Page Saver' in chrome://extensions/"
echo "   - Copy the ID (long string like: abcdefghijklmnopqrstuvwxyz123456)"
echo ""
echo "3. Update the Native Host manifest:"
echo "   nano ~/.local/share/chrome-native-messaging/com.nanopagesaver.videomerger.json"
echo ""
echo "   Replace 'EXTENSION_ID_WILL_BE_ADDED' with your Extension ID"
echo ""
echo "4. Restart Chrome COMPLETELY"
echo "   - Close all Chrome windows"
echo "   - Start Chrome again"
echo ""
echo "5. Test it!"
echo "   - Open a page with HLS video (e.g. Vimeo)"
echo "   - Click extension icon"
echo "   - Click 'Download HLS'"
echo "   - Check console (right-click popup → Inspect)"
echo ""
echo "✅ Setup script completed!"
echo ""
echo "📖 For detailed instructions, see: NATIVE_HOST_SETUP.md"

