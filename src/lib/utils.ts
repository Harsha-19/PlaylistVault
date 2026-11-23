import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats milliseconds into mm:ss format (e.g., 215000 -> 3:35)
 */
export function formatDuration(ms: number): string {
  if (!ms || isNaN(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Formats bytes into human readable format (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  if (!bytes || isNaN(bytes)) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Formats ISO date string to localized readable format
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Sanitizes a filename to prevent ZIP Slip / directory traversal vulnerabilities
 * and illegal OS characters.
 */
export function sanitizeFilename(name: string): string {
  if (!name) return 'unnamed';
  
  // Strip null bytes and control chars
  let clean = name.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  
  // Strip path traversal indicators
  clean = clean.replace(/\.\.+/g, '.');
  clean = clean.replace(/[/\\]/g, '-');
  
  // Replace illegal filename characters on Windows/Linux/Mac: < > : " / \ | ? *
  clean = clean.replace(/[<>:"/\\|?*]/g, '_');
  
  // Trim whitespace and leading/trailing dots/dashes
  clean = clean.trim().replace(/^[.-]+|[.-]+$/g, '');
  
  return clean || 'track';
}

/**
 * Truncates text with ellipsis if exceeding max length
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
