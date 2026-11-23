/**
 * Phase 6 — ZIP Archive Generation & Metadata Export Types
 */

import { StoredAudioFile } from '../audio/types';

export type FolderOrganization =
  | 'playlist_track'
  | 'artist_album_track'
  | 'genre_artist_track'
  | 'flat';

export type FilenamePattern =
  | 'track_artist_title'
  | 'artist_title'
  | 'title_only'
  | 'original';

export type ExportSourceType = 'spotify_playlist' | 'custom_collection';

export interface ExportOptionsConfig {
  sourceType: ExportSourceType;
  sourceId: string;
  sourceName: string;
  folderStructure: FolderOrganization;
  filenamePattern: FilenamePattern;
  includeAudioFiles: boolean;
  includeCsv: boolean;
  includeJson: boolean;
  includePlaylistJson: boolean;
  includeReadme: boolean;
  selectedTrackIds?: string[];
}

export type ExportTrackStatus = 'ready' | 'unmatched' | 'missing_binary' | 'duplicate_audio';

export interface ExportTrackItem {
  trackId: string;
  title: string;
  artist: string;
  albumArtist?: string;
  album: string;
  genre: string;
  year?: string;
  trackNumber?: number;
  discNumber?: number;
  durationMs: number;
  spotifyTrackId?: string;
  audioFileId?: string;
  audioFile?: StoredAudioFile;
  matchConfidence?: number;
  matchStatus?: 'confirmed' | 'pending' | 'rejected' | 'unmatched' | 'no_audio';
  status: ExportTrackStatus;
  issues: string[];
  originalFilename?: string;
  exportedFilename: string;
  exportedPath: string;
  fileSizeBytes: number;
  codec?: string;
  fileHash?: string;
}

export interface ExportValidationSummary {
  totalTracks: number;
  readyTracks: number;
  unmatchedTracks: number;
  missingBinaryTracks: number;
  duplicateAssignments: number;
  estimatedBytes: number;
  items: ExportTrackItem[];
  canExport: boolean;
  requiresPartialConfirmation: boolean;
}

export type ExportPhase =
  | 'idle'
  | 'validating'
  | 'packaging_audio'
  | 'generating_metadata'
  | 'compressing'
  | 'saving'
  | 'complete'
  | 'cancelled'
  | 'error';

export interface ExportProgress {
  phase: ExportPhase;
  currentFile?: string;
  processedCount: number;
  totalCount: number;
  percent: number;
  message: string;
  error?: string;
}

export interface ExportHistoryRecord {
  id: string;
  userId: string;
  archiveName: string;
  sourceType: ExportSourceType;
  sourceId: string;
  sourceName: string;
  totalTracks: number;
  matchedAudioCount: number;
  totalSizeBytes: number;
  formatsIncluded: string[];
  folderStructure: FolderOrganization;
  status: 'completed' | 'cancelled' | 'failed';
  createdAt: string;
  downloaded: boolean;
  cloudStoragePath?: string;
  cloudSyncedAt?: string;
  cloudSizeBytes?: number;
  manifestSnapshot?: {
    totalTracks: number;
    totalDurationMs?: number;
    formats: string[];
    tracksPreview?: { title: string; artist: string }[];
  };
}

export type HistorySortOption = 'newest' | 'oldest' | 'size_desc' | 'tracks_desc';
export type HistoryStatusFilter = 'all' | 'completed' | 'cloud_backed' | 'cancelled' | 'failed';

export interface HistoryFilterOptions {
  query?: string;
  status?: HistoryStatusFilter;
  sortBy?: HistorySortOption;
  dateRange?: {
    start?: string;
    end?: string;
  };
}
