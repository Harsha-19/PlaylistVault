/**
 * Phase 3 — Local Audio Library & Metadata Extraction Types
 */

export interface SupportedAudioFormat {
  extension: string;
  mimeType: string;
  name: string;
  description: string;
}

export interface ExtractedAudioMetadata {
  title: string;
  artist: string;
  albumArtist?: string;
  album: string;
  genre: string;
  genres: string[];
  trackNumber: number | null;
  discNumber: number | null;
  year: string | null;
  durationMs: number;
  bitrateKbps: number | null;
  sampleRateHz: number | null;
  channels: number | null;
  codec: string;
  fileSizeBytes: number;
  artworkDataUrl: string | null;
}

export interface StoredAudioFile {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  file_size_bytes: number;
  mime_type: string;
  file_hash: string;
  duration_ms: number;
  title: string;
  artist: string;
  album: string;
  genre: string;
  genres: string[];
  track_number: number | null;
  disc_number: number | null;
  year: string | null;
  bitrate_kbps: number | null;
  sample_rate_hz: number | null;
  channels: number | null;
  codec: string;
  artwork_data_url?: string | null;
  album_artist?: string | null;
  comments?: string | null;
  original_metadata?: {
    title: string;
    artist: string;
    album: string;
    genre: string;
    year: string | null;
    track_number?: number | null;
  };
  blob: Blob;
  created_at: string;
  updated_at: string;
}

export type UploadItemStatus =
  | 'queued'
  | 'validating'
  | 'hashing'
  | 'extracting'
  | 'saving'
  | 'completed'
  | 'duplicate'
  | 'error';

export interface UploadQueueItem {
  id: string;
  file: File;
  status: UploadItemStatus;
  progress: number; // 0 - 100
  error?: string;
  result?: StoredAudioFile;
}

export interface AudioFilterOptions {
  searchQuery: string;
  genre: string; // 'all' or specific genre
  format: string; // 'all' or 'mp3', 'flac', etc.
  sortBy: 'title' | 'artist' | 'album' | 'duration' | 'date' | 'size';
  sortOrder: 'asc' | 'desc';
}

export interface AudioStorageStats {
  totalFiles: number;
  totalBytes: number;
  uniqueArtists: number;
  uniqueGenres: number;
  formatsBreakdown: Record<string, number>;
}
