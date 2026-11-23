/**
 * Phase 6 — Pre-Export Validation Engine
 * 
 * Inspects track selections, verifies audio binaries in IndexedDB, detects unmatched tracks,
 * missing binaries, duplicate assignments, calculates estimated archive sizes,
 * and generates sanitized collision-free archive paths.
 */

import { StoredAudioFile } from '../audio/types';
import { Track, TrackMatch } from '../../types';
import { generateSafeTrackFilename, resolveArchivePath } from './pathSanitizer';
import {
  ExportOptionsConfig,
  ExportTrackItem,
  ExportValidationSummary,
} from './types';

export function validateExportSelection(options: {
  config: ExportOptionsConfig;
  tracks?: Track[];
  matches?: TrackMatch[];
  audioFiles: StoredAudioFile[];
  collectionAudioFileIds?: string[];
}): ExportValidationSummary {
  const { config, tracks = [], matches = [], audioFiles, collectionAudioFileIds = [] } = options;

  const audioMap = new Map<string, StoredAudioFile>();
  audioFiles.forEach((file) => {
    audioMap.set(file.id, file);
  });

  const allocatedPaths = new Set<string>();
  const items: ExportTrackItem[] = [];

  // Track occurrences of audio_file_id to detect duplicate assignments
  const audioFileUsageCount = new Map<string, number>();

  if (config.sourceType === 'spotify_playlist') {
    // Build map of track_id -> TrackMatch
    const matchMap = new Map<string, TrackMatch>();
    matches.forEach((m) => {
      matchMap.set(m.track_id, m);
    });

    // Filter tracks if selectedTrackIds provided
    const filteredTracks = config.selectedTrackIds && config.selectedTrackIds.length > 0
      ? tracks.filter((t) => config.selectedTrackIds!.includes(t.id))
      : tracks;

    // Count audio file usages
    filteredTracks.forEach((t) => {
      const match = matchMap.get(t.id);
      if (match?.audio_file_id) {
        audioFileUsageCount.set(
          match.audio_file_id,
          (audioFileUsageCount.get(match.audio_file_id) || 0) + 1
        );
      }
    });

    filteredTracks.forEach((track, index) => {
      const match = matchMap.get(track.id);
      const audioFileId = match?.audio_file_id;
      const audioFile = audioFileId ? audioMap.get(audioFileId) : undefined;
      const issues: string[] = [];

      let status: ExportTrackItem['status'] = 'ready';

      if (!audioFileId) {
        status = 'unmatched';
        issues.push('No local audio file matched to this track.');
      } else if (!audioFile || !audioFile.blob) {
        status = 'missing_binary';
        issues.push('Audio file record or binary blob missing from local IndexedDB.');
      } else if ((audioFileUsageCount.get(audioFileId) || 0) > 1) {
        status = 'duplicate_audio';
        issues.push('This audio file is assigned to multiple tracks in this playlist.');
      }

      // Use edited metadata from Phase 5 if available, otherwise track metadata
      const effectiveTitle = audioFile?.title || track.title;
      const effectiveArtist = audioFile?.artist || track.artist;
      const effectiveAlbum = audioFile?.album || track.album || 'Unknown Album';
      const effectiveGenre = audioFile?.genre || 'Other';
      const effectiveYear = audioFile?.year || '';
      const effectiveTrackNum = audioFile?.track_number || track.track_number || index + 1;
      const effectiveDiscNum = audioFile?.disc_number || track.disc_number || 1;
      const effectiveDuration = audioFile?.duration_ms || track.duration_ms;

      const safeFilename = generateSafeTrackFilename(
        {
          title: effectiveTitle,
          artist: effectiveArtist,
          trackNumber: effectiveTrackNum,
          originalFilename: audioFile?.filename,
          codec: audioFile?.codec,
        },
        config.filenamePattern
      );

      const exportedPath = resolveArchivePath(
        {
          playlistName: config.sourceName,
          artist: effectiveArtist,
          album: effectiveAlbum,
          genre: effectiveGenre,
          filename: safeFilename,
          folderStructure: config.folderStructure,
        },
        allocatedPaths
      );

      items.push({
        trackId: track.id,
        title: effectiveTitle,
        artist: effectiveArtist,
        albumArtist: audioFile?.album_artist || undefined,
        album: effectiveAlbum,
        genre: effectiveGenre,
        year: effectiveYear,
        trackNumber: effectiveTrackNum,
        discNumber: effectiveDiscNum,
        durationMs: effectiveDuration,
        spotifyTrackId: track.spotify_track_id || undefined,
        audioFileId,
        audioFile,
        matchConfidence: match?.confidence_score,
        matchStatus: match?.status || 'unmatched',
        status,
        issues,
        originalFilename: audioFile?.filename || undefined,
        exportedFilename: safeFilename,
        exportedPath,
        fileSizeBytes: audioFile?.file_size_bytes || 0,
        codec: audioFile?.codec,
        fileHash: audioFile?.file_hash || undefined,
      });
    });
  } else {
    // Custom Collection export
    const targetFileIds = config.selectedTrackIds && config.selectedTrackIds.length > 0
      ? collectionAudioFileIds.filter((id) => config.selectedTrackIds!.includes(id))
      : collectionAudioFileIds;

    targetFileIds.forEach((id) => {
      audioFileUsageCount.set(id, (audioFileUsageCount.get(id) || 0) + 1);
    });

    targetFileIds.forEach((fileId, index) => {
      const audioFile = audioMap.get(fileId);
      const issues: string[] = [];
      let status: ExportTrackItem['status'] = 'ready';

      if (!audioFile || !audioFile.blob) {
        status = 'missing_binary';
        issues.push('Audio file record or binary blob missing from local IndexedDB.');
      }

      const effectiveTitle = audioFile?.title || 'Unknown Title';
      const effectiveArtist = audioFile?.artist || 'Unknown Artist';
      const effectiveAlbum = audioFile?.album || 'Unknown Album';
      const effectiveGenre = audioFile?.genre || 'Other';
      const effectiveYear = audioFile?.year || '';
      const effectiveTrackNum = audioFile?.track_number || index + 1;
      const effectiveDiscNum = audioFile?.disc_number || 1;
      const effectiveDuration = audioFile?.duration_ms || 0;

      const safeFilename = generateSafeTrackFilename(
        {
          title: effectiveTitle,
          artist: effectiveArtist,
          trackNumber: effectiveTrackNum,
          originalFilename: audioFile?.filename,
          codec: audioFile?.codec,
        },
        config.filenamePattern
      );

      const exportedPath = resolveArchivePath(
        {
          playlistName: config.sourceName,
          artist: effectiveArtist,
          album: effectiveAlbum,
          genre: effectiveGenre,
          filename: safeFilename,
          folderStructure: config.folderStructure,
        },
        allocatedPaths
      );

      items.push({
        trackId: fileId,
        title: effectiveTitle,
        artist: effectiveArtist,
        albumArtist: audioFile?.album_artist || undefined,
        album: effectiveAlbum,
        genre: effectiveGenre,
        year: effectiveYear,
        trackNumber: effectiveTrackNum,
        discNumber: effectiveDiscNum,
        durationMs: effectiveDuration,
        audioFileId: fileId,
        audioFile,
        matchStatus: 'confirmed',
        status,
        issues,
        originalFilename: audioFile?.filename || undefined,
        exportedFilename: safeFilename,
        exportedPath,
        fileSizeBytes: audioFile?.file_size_bytes || 0,
        codec: audioFile?.codec,
        fileHash: audioFile?.file_hash || undefined,
      });
    });
  }

  const readyTracks = items.filter((i) => i.status === 'ready' || i.status === 'duplicate_audio').length;
  const unmatchedTracks = items.filter((i) => i.status === 'unmatched').length;
  const missingBinaryTracks = items.filter((i) => i.status === 'missing_binary').length;
  const duplicateAssignments = items.filter((i) => i.status === 'duplicate_audio').length;

  const estimatedAudioBytes = items
    .filter((i) => (i.status === 'ready' || i.status === 'duplicate_audio') && i.audioFile)
    .reduce((sum, i) => sum + i.fileSizeBytes, 0);

  // Metadata overhead estimate (~40KB)
  const estimatedBytes = estimatedAudioBytes + 40960;

  return {
    totalTracks: items.length,
    readyTracks,
    unmatchedTracks,
    missingBinaryTracks,
    duplicateAssignments,
    estimatedBytes,
    items,
    canExport: readyTracks > 0,
    requiresPartialConfirmation:
      unmatchedTracks > 0 || missingBinaryTracks > 0 || duplicateAssignments > 0,
  };
}
