#!/usr/bin/env python3
"""
Native Messaging Host for Nano Page Saver Extension
Merges separate video and audio files using FFmpeg
"""

import sys
import json
import struct
import subprocess
import os
import tempfile
from pathlib import Path

def send_message(message):
    """Send a message to the Chrome extension"""
    encoded_message = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('I', len(encoded_message)))
    sys.stdout.buffer.write(encoded_message)
    sys.stdout.buffer.flush()

def read_message():
    """Read a message from the Chrome extension"""
    text_length_bytes = sys.stdin.buffer.read(4)
    if len(text_length_bytes) == 0:
        return None
    
    text_length = struct.unpack('I', text_length_bytes)[0]
    text = sys.stdin.buffer.read(text_length).decode('utf-8')
    return json.loads(text)

def merge_video_audio(video_data, audio_data, output_filename):
    """Merge video and audio using FFmpeg"""
    try:
        # Create temporary files
        with tempfile.NamedTemporaryFile(delete=False, suffix='_VIDEO.mp4') as video_file:
            video_file.write(video_data)
            video_path = video_file.name
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='_AUDIO.m4a') as audio_file:
            audio_file.write(audio_data)
            audio_path = audio_file.name
        
        # Get download directory
        download_dir = Path.home() / 'Downloads'
        output_path = download_dir / output_filename
        
        # Run FFmpeg
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-i', audio_path,
            '-c', 'copy',  # Copy streams without re-encoding (FAST!)
            '-y',  # Overwrite output file if exists
            str(output_path)
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes timeout
        )
        
        # Cleanup temp files
        os.unlink(video_path)
        os.unlink(audio_path)
        
        if result.returncode == 0:
            file_size = output_path.stat().st_size
            return {
                'success': True,
                'output_path': str(output_path),
                'size': file_size
            }
        else:
            return {
                'success': False,
                'error': f'FFmpeg error: {result.stderr}'
            }
    
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def main():
    """Main loop for Native Messaging Host"""
    while True:
        message = read_message()
        
        if message is None:
            break
        
        action = message.get('action')
        
        if action == 'ping':
            # Health check
            send_message({'success': True, 'message': 'Native Host is running'})
        
        elif action == 'merge':
            # Merge video and audio
            video_data_base64 = message.get('video_data')
            audio_data_base64 = message.get('audio_data')
            output_filename = message.get('output_filename', 'merged_video.mp4')
            
            if not video_data_base64 or not audio_data_base64:
                send_message({
                    'success': False,
                    'error': 'Missing video_data or audio_data'
                })
                continue
            
            # Decode base64
            import base64
            video_data = base64.b64decode(video_data_base64)
            audio_data = base64.b64decode(audio_data_base64)
            
            # Merge
            result = merge_video_audio(video_data, audio_data, output_filename)
            send_message(result)
        
        else:
            send_message({
                'success': False,
                'error': f'Unknown action: {action}'
            })

if __name__ == '__main__':
    main()

