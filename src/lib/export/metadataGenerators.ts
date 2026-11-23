/**
 * Phase 6 — Structured Metadata Export Generators
 * 
 * Generates metadata.json, metadata.csv (with UTF-8 BOM & RFC 4180 escaping),
 * playlist.json, and human-readable README.txt for self-contained offline ZIP archives.
 */

import { formatDuration, formatBytes } from '../utils';
import { ExportOptionsConfig, ExportTrackItem } from './types';

// Dangerous formula prefixes targeted by CSV / Spreadsheet injection (OWASP CWE-1236)
const DANGEROUS_FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Escapes a single CSV field according to RFC 4180 and protects against formula injection.
 * Neutralizes fields starting with =, +, -, @, \t, or \r by prefixing an apostrophe (').
 * Wraps fields with commas, quotes, or newlines in double quotes, and doubles internal quotes.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Pure numeric literals are safe from formula execution
  if (typeof value === 'number') {
    return String(value);
  }

  let str = String(value);

  // Mitigate CSV / Spreadsheet Formula Injection (OWASP CWE-1236)
  if (DANGEROUS_FORMULA_PREFIXES.some((prefix) => str.startsWith(prefix))) {
    str = `'${str}`;
  }

  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates metadata.json containing detailed records for every exported track.
 */
export function generateMetadataJson(
  tracks: ExportTrackItem[],
  config: ExportOptionsConfig
): string {
  const data = {
    archive_name: config.sourceName,
    source_type: config.sourceType,
    source_id: config.sourceId,
    exported_at: new Date().toISOString(),
    generator: 'PlaylistVault v1.0 (Offline Standalone Export)',
    folder_organization: config.folderStructure,
    total_tracks: tracks.length,
    tracks: tracks.map((t, index) => ({
      track_number: t.trackNumber || index + 1,
      disc_number: t.discNumber || 1,
      title: t.title,
      artist: t.artist,
      album_artist: t.albumArtist || t.artist,
      album: t.album,
      genre: t.genre,
      year: t.year || null,
      duration_ms: t.durationMs,
      duration_formatted: formatDuration(t.durationMs),
      original_filename: t.originalFilename || null,
      exported_path: t.exportedPath,
      format: t.codec || 'unknown',
      file_size_bytes: t.fileSizeBytes,
      file_size_formatted: formatBytes(t.fileSizeBytes),
      spotify_track_id: t.spotifyTrackId || null,
      match_confidence: t.matchConfidence !== undefined ? t.matchConfidence : null,
      match_status: t.matchStatus || null,
      sha256_hash: t.fileHash || null,
    })),
  };

  return JSON.stringify(data, null, 2) + '\n';
}

/**
 * Generates metadata.csv with RFC 4180 quoting and UTF-8 Byte Order Mark (BOM).
 */
export function generateMetadataCsv(tracks: ExportTrackItem[]): string {
  const headers = [
    'Track Number',
    'Disc Number',
    'Title',
    'Artist',
    'Album Artist',
    'Album',
    'Genre',
    'Year',
    'Duration (ms)',
    'Duration Formatted',
    'Format',
    'File Size (Bytes)',
    'Exported Path',
    'Original Filename',
    'Spotify Track ID',
    'Match Confidence (%)',
    'Match Status',
    'SHA-256 Hash',
  ];

  const rows = tracks.map((t, index) => [
    escapeCsvField(t.trackNumber || index + 1),
    escapeCsvField(t.discNumber || 1),
    escapeCsvField(t.title),
    escapeCsvField(t.artist),
    escapeCsvField(t.albumArtist || t.artist),
    escapeCsvField(t.album),
    escapeCsvField(t.genre),
    escapeCsvField(t.year || ''),
    escapeCsvField(t.durationMs),
    escapeCsvField(formatDuration(t.durationMs)),
    escapeCsvField(t.codec || ''),
    escapeCsvField(t.fileSizeBytes),
    escapeCsvField(t.exportedPath),
    escapeCsvField(t.originalFilename || ''),
    escapeCsvField(t.spotifyTrackId || ''),
    escapeCsvField(t.matchConfidence !== undefined ? `${t.matchConfidence}%` : ''),
    escapeCsvField(t.matchStatus || ''),
    escapeCsvField(t.fileHash || ''),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
  return '\uFEFF' + csvContent + '\r\n';
}

/**
 * Generates playlist.json describing the collection manifest.
 */
export function generatePlaylistJson(
  tracks: ExportTrackItem[],
  config: ExportOptionsConfig
): string {
  const totalDurationMs = tracks.reduce((sum, t) => sum + (t.durationMs || 0), 0);

  const playlist = {
    name: config.sourceName,
    source_type: config.sourceType,
    source_id: config.sourceId,
    exported_at: new Date().toISOString(),
    generator: 'PlaylistVault',
    total_tracks: tracks.length,
    total_duration_ms: totalDurationMs,
    total_duration_formatted: formatDuration(totalDurationMs),
    tracks: tracks.map((t, idx) => ({
      position: idx + 1,
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration_formatted: formatDuration(t.durationMs),
      path: t.exportedPath,
    })),
  };

  return JSON.stringify(playlist, null, 2) + '\n';
}

/**
 * Generates human-readable README.txt explaining archive contents and offline usage.
 */
export function generateReadmeText(
  tracks: ExportTrackItem[],
  config: ExportOptionsConfig
): string {
  const totalBytes = tracks.reduce((sum, t) => sum + (t.fileSizeBytes || 0), 0);
  const totalDurationMs = tracks.reduce((sum, t) => sum + (t.durationMs || 0), 0);
  const dateStr = new Date().toLocaleString();

  const lines: string[] = [
    '================================================================================',
    '                    PLAYLISTVAULT — OFFLINE AUDIO ARCHIVE',
    '================================================================================',
    '',
    `Archive Name:    ${config.sourceName}`,
    `Source Type:     ${config.sourceType === 'spotify_playlist' ? 'Spotify Playlist' : 'Custom Collection'}`,
    `Export Date:     ${dateStr}`,
    `Total Tracks:    ${tracks.length}`,
    `Total Audio:     ${formatBytes(totalBytes)}`,
    `Total Duration:  ${formatDuration(totalDurationMs)}`,
    `Folder Layout:   ${config.folderStructure}`,
    '',
    '--------------------------------------------------------------------------------',
    '1. OFFLINE STANDALONE USAGE GUARANTEE',
    '--------------------------------------------------------------------------------',
    'This archive contains genuine local audio files and structured metadata exported',
    'from PlaylistVault. All audio files are complete and preserved in their original',
    'unaltered formats without conversion or recompression.',
    '',
    'This archive is 100% self-contained: NO internet connection, Spotify authorization,',
    'or Supabase backend is required to extract, play, or inspect these files.',
    '',
    '--------------------------------------------------------------------------------',
    '2. INCLUDED FILES',
    '--------------------------------------------------------------------------------',
    config.includeAudioFiles ? '  * Audio Files:  Original binary audio files organized by your chosen layout.' : '',
    config.includeJson ? '  * metadata.json: Comprehensive machine-readable track metadata and hashes.' : '',
    config.includeCsv ? '  * metadata.csv:  Spreadsheet-compatible metadata export (UTF-8 with BOM).' : '',
    config.includePlaylistJson ? '  * playlist.json: Collection manifest with relative track paths.' : '',
    '  * README.txt:    This documentation file.',
    '',
    '--------------------------------------------------------------------------------',
    '3. TRACK LISTING',
    '--------------------------------------------------------------------------------',
  ].filter(Boolean);

  tracks.forEach((t, index) => {
    const num = String(t.trackNumber || index + 1).padStart(2, '0');
    const dur = formatDuration(t.durationMs);
    const size = formatBytes(t.fileSizeBytes);
    lines.push(
      `${num}. ${t.artist} - ${t.title} [${dur}] (${size})`
    );
    lines.push(`    Path: ${t.exportedPath}`);
    if (t.fileHash) {
      lines.push(`    SHA-256: ${t.fileHash}`);
    }
  });

  lines.push('');
  lines.push('================================================================================');
  lines.push('Generated with PlaylistVault — Authorized Audio Management & Offline Vault');
  lines.push('================================================================================');
  lines.push('');

  return lines.join('\r\n');
}
