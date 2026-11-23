/**
 * Phase 6 — ZIP Archive Generation Engine & File System Saver
 * 
 * Packages real binary audio Blobs and structured metadata into a standalone offline ZIP.
 * Supports File System Access API (with fallback download), real-time progress, and cancellation.
 */

import JSZip from 'jszip';
import {
  generateMetadataCsv,
  generateMetadataJson,
  generatePlaylistJson,
  generateReadmeText,
} from './metadataGenerators';
import { sanitizePathSegment } from './pathSanitizer';
import {
  ExportOptionsConfig,
  ExportProgress,
  ExportTrackItem,
} from './types';

export class ZipExportCancelledError extends Error {
  constructor(message = 'ZIP generation was cancelled by the user.') {
    super(message);
    this.name = 'ZipExportCancelledError';
  }
}

const COMPRESSED_AUDIO_EXTENSIONS = new Set([
  'mp3', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'wma', 'mp4',
]);

/**
 * Determines if an audio file is already in a compressed container format.
 * Avoids CPU and RAM thrashing by storing already-compressed formats with 'STORE'
 * rather than re-deflating them without benefit.
 */
export function isAlreadyCompressedAudio(filenameOrFormat: string): boolean {
  if (!filenameOrFormat) return false;
  const ext = filenameOrFormat.split('.').pop()?.toLowerCase() || '';
  if (COMPRESSED_AUDIO_EXTENSIONS.has(ext)) return true;
  const lower = filenameOrFormat.toLowerCase();
  return (
    lower.includes('mp3') ||
    lower.includes('mpeg') ||
    lower.includes('flac') ||
    lower.includes('m4a') ||
    lower.includes('aac') ||
    lower.includes('ogg') ||
    lower.includes('opus')
  );
}

/**
 * Builds the actual ZIP archive containing genuine audio binaries and metadata files.
 */
export async function buildZipArchive(options: {
  tracks: ExportTrackItem[];
  config: ExportOptionsConfig;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}): Promise<{ blob: Blob; filename: string; sizeBytes: number }> {
  const { tracks, config, onProgress, signal } = options;

  // Filter only ready tracks that have audioFile and blob
  const exportableTracks = tracks.filter(
    (t) => (t.status === 'ready' || t.status === 'duplicate_audio') && t.audioFile?.blob
  );

  if (exportableTracks.length === 0 && config.includeAudioFiles) {
    throw new Error('No ready audio files available to package in the ZIP archive.');
  }

  const zip = new JSZip();

  // Helper to report progress
  const reportProgress = (
    phase: ExportProgress['phase'],
    processedCount: number,
    totalCount: number,
    percent: number,
    message: string,
    currentFile?: string
  ) => {
    if (onProgress) {
      onProgress({
        phase,
        currentFile,
        processedCount,
        totalCount,
        percent: Math.min(100, Math.max(0, Math.round(percent))),
        message,
      });
    }
  };

  // Check abort signal
  const checkAbort = () => {
    if (signal?.aborted) {
      throw new ZipExportCancelledError();
    }
  };

  checkAbort();
  reportProgress('packaging_audio', 0, exportableTracks.length, 5, 'Preparing audio binaries...');

  // 1. Package audio files if enabled
  if (config.includeAudioFiles) {
    for (let i = 0; i < exportableTracks.length; i++) {
      checkAbort();
      const track = exportableTracks[i];
      const audioBlob = track.audioFile!.blob;

      reportProgress(
        'packaging_audio',
        i + 1,
        exportableTracks.length,
        5 + ((i + 1) / exportableTracks.length) * 55,
        `Adding audio (${i + 1}/${exportableTracks.length}): ${track.title}`,
        track.exportedFilename
      );

      // Add audio binary to zip at sanitized path
      // Apply STORE for already-compressed formats (MP3/FLAC/OGG/AAC/OPUS) to avoid CPU/RAM thrashing
      const isCompressed = isAlreadyCompressedAudio(track.exportedFilename || track.codec || '');
      zip.file(track.exportedPath, audioBlob, {
        binary: true,
        compression: isCompressed ? 'STORE' : 'DEFLATE',
      });
    }
  }

  checkAbort();
  reportProgress(
    'generating_metadata',
    exportableTracks.length,
    exportableTracks.length,
    65,
    'Generating structured metadata manifests...'
  );

  // 2. Add metadata files
  if (config.includeJson) {
    const jsonStr = generateMetadataJson(exportableTracks, config);
    zip.file('metadata.json', jsonStr);
  }

  if (config.includeCsv) {
    const csvStr = generateMetadataCsv(exportableTracks);
    zip.file('metadata.csv', csvStr);
  }

  if (config.includePlaylistJson) {
    const playlistJsonStr = generatePlaylistJson(exportableTracks, config);
    zip.file('playlist.json', playlistJsonStr);
  }

  if (config.includeReadme) {
    const readmeStr = generateReadmeText(exportableTracks, config);
    zip.file('README.txt', readmeStr);
  }

  checkAbort();
  reportProgress(
    'compressing',
    exportableTracks.length,
    exportableTracks.length,
    70,
    'Compressing archive stream...'
  );

  // 3. Generate the ZIP blob with real-time compression progress
  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 }, // Level 1 for fast generation without locking UI
    },
    (metadata) => {
      checkAbort();
      const compPercent = 70 + (metadata.percent / 100) * 25;
      reportProgress(
        'compressing',
        exportableTracks.length,
        exportableTracks.length,
        compPercent,
        `Compressing: ${Math.round(metadata.percent)}% (${metadata.currentFile || 'finalizing'})`,
        metadata.currentFile || undefined
      );
    }
  );

  checkAbort();
  const safeArchiveBase = sanitizePathSegment(config.sourceName, 'PlaylistVault_Export');
  const filename = `${safeArchiveBase}.zip`;

  reportProgress(
    'complete',
    exportableTracks.length,
    exportableTracks.length,
    100,
    'Archive generated successfully!'
  );

  return {
    blob: zipBlob,
    filename,
    sizeBytes: zipBlob.size,
  };
}

/**
 * Saves a generated ZIP blob to the user's computer.
 * Uses the File System Access API where supported; otherwise falls back to browser download.
 */
export async function saveZipToDisk(
  blob: Blob,
  filename: string
): Promise<{ success: boolean; method: 'picker' | 'download'; savedFilename: string }> {
  // Check if File System Access API is supported
  const hasFileSystemAccess =
    typeof window !== 'undefined' &&
    'showSaveFilePicker' in window &&
    typeof (window as any).showSaveFilePicker === 'function';

  if (hasFileSystemAccess) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'ZIP Archive',
            accept: {
              'application/zip': ['.zip'],
            },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      return {
        success: true,
        method: 'picker',
        savedFilename: handle.name || filename,
      };
    } catch (err: any) {
      // If user aborted/cancelled the picker, rethrow so caller knows user didn't proceed
      if (err.name === 'AbortError') {
        throw new ZipExportCancelledError('Save dialog was cancelled.');
      }
      console.warn('[PlaylistVault] showSaveFilePicker failed, falling back to download:', err);
    }
  }

  // Fallback: Trigger standard browser anchor download
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);

    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      resolve({
        success: true,
        method: 'download',
        savedFilename: filename,
      });
    }, 500);
  });
}
