/**
 * Phase 6 — Safe Path Sanitization & Collision Resolution Engine
 * 
 * Protects against ZIP Slip vulnerabilities, path traversal, reserved filesystem names,
 * invalid characters across Windows/macOS/Linux, and filename collisions.
 */

import { FilenamePattern, FolderOrganization } from './types';

// Windows and POSIX forbidden characters
// < > : " / \ | ? * and ASCII control characters 0-31
const INVALID_CHARS_REGEX = /[<>:"/\\|?*\x00-\x1f\x7f]/g;

// Reserved DOS/Windows device names
const RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

const MAX_SEGMENT_LENGTH = 90;

/**
 * Sanitizes a single folder or file segment.
 * Removes traversal sequences, invalid characters, trailing dots/spaces, and reserved words.
 */
export function sanitizePathSegment(segment: string, fallback = 'untitled'): string {
  if (!segment || typeof segment !== 'string') {
    return fallback;
  }

  // 1. Remove dangerous traversal sequences and normalize slashes
  let clean = segment
    .replace(/\\/g, '/')
    .replace(/\.\.+/g, '') // strip ".."
    .replace(/^\/+|\/+$/g, '') // strip leading and trailing slashes
    .replace(INVALID_CHARS_REGEX, '_')
    .replace(/^[.\s_]+|[.\s_]+$/g, '') // remove leading/trailing dots, spaces, and underscores
    .trim();

  // 2. Fallback if empty after sanitization
  if (!clean) {
    clean = fallback;
  }

  // 3. Check for Windows reserved names (e.g. CON, AUX, NUL)
  const upper = clean.toUpperCase();
  const baseName = upper.split('.')[0];
  if (RESERVED_NAMES.has(baseName)) {
    clean = `_${clean}`;
  }

  // 5. Truncate long segments while preserving extension if present
  if (clean.length > MAX_SEGMENT_LENGTH) {
    const dotIndex = clean.lastIndexOf('.');
    if (dotIndex > 0 && clean.length - dotIndex <= 8) {
      const ext = clean.substring(dotIndex);
      const base = clean.substring(0, MAX_SEGMENT_LENGTH - ext.length);
      clean = `${base.trim()}${ext}`;
    } else {
      clean = clean.substring(0, MAX_SEGMENT_LENGTH).trim();
    }
  }

  return clean || fallback;
}

/**
 * Extracts and sanitizes the audio file extension.
 */
export function sanitizeExtension(originalFilename?: string, codec?: string): string {
  if (originalFilename) {
    const parts = originalFilename.split('.');
    if (parts.length > 1) {
      const ext = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (ext.length >= 2 && ext.length <= 5) {
        return ext;
      }
    }
  }
  if (codec) {
    const cleanCodec = codec.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanCodec === 'mpeg' || cleanCodec === 'mp3') return 'mp3';
    if (cleanCodec === 'flac') return 'flac';
    if (cleanCodec === 'wave' || cleanCodec === 'wav') return 'wav';
    if (cleanCodec === 'aac' || cleanCodec === 'm4a') return 'm4a';
    if (cleanCodec === 'ogg' || cleanCodec === 'vorbis') return 'ogg';
    if (cleanCodec === 'opus') return 'opus';
    if (cleanCodec === 'aiff') return 'aiff';
    return cleanCodec;
  }
  return 'mp3';
}

/**
 * Generates a safe filename according to the selected pattern.
 */
export function generateSafeTrackFilename(
  options: {
    title: string;
    artist: string;
    trackNumber?: number;
    originalFilename?: string;
    codec?: string;
  },
  pattern: FilenamePattern = 'track_artist_title'
): string {
  const ext = sanitizeExtension(options.originalFilename, options.codec);
  const safeTitle = sanitizePathSegment(options.title, 'Track');
  const safeArtist = sanitizePathSegment(options.artist, 'Unknown Artist');
  const trackNumStr =
    options.trackNumber !== undefined && options.trackNumber !== null && options.trackNumber > 0
      ? String(options.trackNumber).padStart(2, '0')
      : '01';

  let baseName = '';
  switch (pattern) {
    case 'track_artist_title':
      baseName = `${trackNumStr} - ${safeArtist} - ${safeTitle}`;
      break;
    case 'artist_title':
      baseName = `${safeArtist} - ${safeTitle}`;
      break;
    case 'title_only':
      baseName = safeTitle;
      break;
    case 'original':
      if (options.originalFilename) {
        const parts = options.originalFilename.split('.');
        const origBase = parts.slice(0, -1).join('.') || options.originalFilename;
        baseName = sanitizePathSegment(origBase, safeTitle);
      } else {
        baseName = `${trackNumStr} - ${safeArtist} - ${safeTitle}`;
      }
      break;
    default:
      baseName = `${trackNumStr} - ${safeArtist} - ${safeTitle}`;
  }

  const finalSafe = sanitizePathSegment(baseName, 'audio_track');
  return `${finalSafe}.${ext}`;
}

/**
 * Resolves the full relative path inside the ZIP archive and avoids collisions.
 */
export function resolveArchivePath(
  options: {
    playlistName: string;
    artist: string;
    album: string;
    genre: string;
    filename: string;
    folderStructure: FolderOrganization;
  },
  allocatedPaths: Set<string>
): string {
  const safePlaylist = sanitizePathSegment(options.playlistName, 'Playlist');
  const safeArtist = sanitizePathSegment(options.artist, 'Unknown Artist');
  const safeAlbum = sanitizePathSegment(options.album, 'Unknown Album');
  const safeGenre = sanitizePathSegment(options.genre, 'Other');
  const safeFilename = sanitizePathSegment(options.filename, 'audio.mp3');

  let folder = '';
  switch (options.folderStructure) {
    case 'playlist_track':
      folder = safePlaylist;
      break;
    case 'artist_album_track':
      folder = `${safeArtist}/${safeAlbum}`;
      break;
    case 'genre_artist_track':
      folder = `${safeGenre}/${safeArtist}`;
      break;
    case 'flat':
      folder = '';
      break;
    default:
      folder = safePlaylist;
  }

  // Combine folder and filename
  const dotIndex = safeFilename.lastIndexOf('.');
  const baseName = dotIndex > 0 ? safeFilename.substring(0, dotIndex) : safeFilename;
  const ext = dotIndex > 0 ? safeFilename.substring(dotIndex) : '';

  let candidatePath = folder ? `${folder}/${safeFilename}` : safeFilename;
  let counter = 1;

  // Collision resolution: if candidatePath is already taken, append " (1)", " (2)", etc.
  while (allocatedPaths.has(candidatePath.toLowerCase())) {
    const adjustedFilename = `${baseName} (${counter})${ext}`;
    candidatePath = folder ? `${folder}/${adjustedFilename}` : adjustedFilename;
    counter++;
  }

  // Allocate path in set
  allocatedPaths.add(candidatePath.toLowerCase());
  return candidatePath;
}
