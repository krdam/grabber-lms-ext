// Utility functions for Nano Page Saver

// Sanitize filename for safe download
export function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

// Show status message in popup
export function showStatus(message, type, statusDiv) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = 'status';
    }, 3000);
  }
}

// Show progress bar
export function showProgress(label, percent, progressContainer, progressLabel, progressFill) {
  if (percent === null) {
    progressLabel.textContent = label;
    progressFill.style.width = '100%';
    progressFill.classList.add('indeterminate');
  } else {
    progressLabel.textContent = `${label} (${percent}%)`;
    progressFill.style.width = `${percent}%`;
    progressFill.classList.remove('indeterminate');
  }
  progressContainer.classList.remove('hidden');
}

// Hide progress bar
export function hideProgress(progressContainer, progressFill, progressLabel) {
  progressContainer.classList.add('hidden');
  progressFill.style.width = '0%';
  progressFill.classList.remove('indeterminate');
  progressLabel.textContent = 'Preparing...';
}

// Format file size
export function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// Format download speed
export function formatSpeed(bytesPerSec) {
  return `${formatSize(bytesPerSec)}/s`;
}

