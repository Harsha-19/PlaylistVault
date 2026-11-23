import { Database } from './database';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Playlist = Database['public']['Tables']['playlists']['Row'];
export type Track = Database['public']['Tables']['tracks']['Row'];
export type AudioFile = Database['public']['Tables']['audio_files']['Row'];
export type TrackMatch = Database['public']['Tables']['track_matches']['Row'];
export type ExportArchive = Database['public']['Tables']['export_archives']['Row'];

export interface MatchedTrackItem {
  track: Track;
  match?: TrackMatch;
  audioFile?: AudioFile;
}

export interface PlaylistWithStats extends Playlist {
  matched_count: number;
  total_duration_ms: number;
  match_percentage: number;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayableTrackItem {
  id: string;
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  durationMs: number;
  audioUrl?: string; // Blob object URL or remote URL
  blob?: Blob; // Raw audio binary Blob if local
  audioFileId?: string;
  trackId?: string;
  codec?: string;
}

export interface AudioPlaybackState {
  currentTrackId: string | null;
  currentAudioFileId: string | null;
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  codec?: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  audioUrl: string | null;
  repeatMode: RepeatMode;
  shuffle: boolean;
  queue: PlayableTrackItem[];
  queueIndex: number;
}

export interface CustomCollection {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  audio_file_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface MatchFilterOptions {
  status?: 'all' | 'confirmed' | 'pending' | 'unmatched';
  searchQuery?: string;
  genre?: string;
  minConfidence?: number;
}

export interface ExportOptions {
  includeAudioFiles: boolean;
  includeCsvMetadata: boolean;
  includeJsonMetadata: boolean;
  includeCoverArt: boolean;
  includeReadme: boolean;
  saveToCloud: boolean;
}
