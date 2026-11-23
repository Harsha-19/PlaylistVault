export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      playlists: {
        Row: {
          id: string;
          user_id: string;
          spotify_playlist_id: string | null;
          name: string;
          description: string | null;
          image_url: string | null;
          owner_name: string | null;
          external_url: string | null;
          total_tracks: number;
          snapshot_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          spotify_playlist_id?: string | null;
          name: string;
          description?: string | null;
          image_url?: string | null;
          owner_name?: string | null;
          external_url?: string | null;
          total_tracks?: number;
          snapshot_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          spotify_playlist_id?: string | null;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          owner_name?: string | null;
          external_url?: string | null;
          total_tracks?: number;
          snapshot_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tracks: {
        Row: {
          id: string;
          playlist_id: string;
          spotify_track_id: string | null;
          title: string;
          artist: string;
          album: string | null;
          duration_ms: number;
          track_number: number;
          disc_number: number;
          isrc: string | null;
          preview_url: string | null;
          cover_art_url: string | null;
          genres: string[];
          explicit: boolean;
          release_date: string | null;
          is_local: boolean;
          added_at: string;
        };
        Insert: {
          id?: string;
          playlist_id: string;
          spotify_track_id?: string | null;
          title: string;
          artist: string;
          album?: string | null;
          duration_ms?: number;
          track_number?: number;
          disc_number?: number;
          isrc?: string | null;
          preview_url?: string | null;
          cover_art_url?: string | null;
          genres?: string[];
          explicit?: boolean;
          release_date?: string | null;
          is_local?: boolean;
          added_at?: string;
        };
        Update: {
          id?: string;
          playlist_id?: string;
          spotify_track_id?: string | null;
          title?: string;
          artist?: string;
          album?: string | null;
          duration_ms?: number;
          track_number?: number;
          disc_number?: number;
          isrc?: string | null;
          preview_url?: string | null;
          cover_art_url?: string | null;
          genres?: string[];
          explicit?: boolean;
          release_date?: string | null;
          is_local?: boolean;
          added_at?: string;
        };
        Relationships: [];
      };
      audio_files: {
        Row: {
          id: string;
          user_id: string;
          filename: string;
          original_name: string;
          file_size_bytes: number;
          mime_type: string;
          file_hash: string | null;
          duration_ms: number | null;
          title: string | null;
          artist: string | null;
          album: string | null;
          genre: string | null;
          year: string | null;
          bitrate_kbps: number | null;
          sample_rate_hz: number | null;
          channels: number | null;
          storage_path: string | null;
          is_cloud_stored: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          filename: string;
          original_name: string;
          file_size_bytes: number;
          mime_type: string;
          file_hash?: string | null;
          duration_ms?: number | null;
          title?: string | null;
          artist?: string | null;
          album?: string | null;
          genre?: string | null;
          year?: string | null;
          bitrate_kbps?: number | null;
          sample_rate_hz?: number | null;
          channels?: number | null;
          storage_path?: string | null;
          is_cloud_stored?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          filename?: string;
          original_name?: string;
          file_size_bytes?: number;
          mime_type?: string;
          file_hash?: string | null;
          duration_ms?: number | null;
          title?: string | null;
          artist?: string | null;
          album?: string | null;
          genre?: string | null;
          year?: string | null;
          bitrate_kbps?: number | null;
          sample_rate_hz?: number | null;
          channels?: number | null;
          storage_path?: string | null;
          is_cloud_stored?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      track_matches: {
        Row: {
          id: string;
          user_id: string;
          playlist_id: string;
          track_id: string;
          audio_file_id: string;
          match_type: 'auto' | 'manual';
          confidence_score: number;
          status: 'confirmed' | 'pending' | 'rejected';
          matched_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          playlist_id: string;
          track_id: string;
          audio_file_id: string;
          match_type?: 'auto' | 'manual';
          confidence_score?: number;
          status?: 'confirmed' | 'pending' | 'rejected';
          matched_at?: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          playlist_id?: string;
          track_id?: string;
          audio_file_id?: string;
          match_type?: 'auto' | 'manual';
          confidence_score?: number;
          status?: 'confirmed' | 'pending' | 'rejected';
          matched_at?: string;
          notes?: string | null;
        };
        Relationships: [];
      };
      export_archives: {
        Row: {
          id: string;
          user_id: string;
          playlist_id: string | null;
          archive_name: string;
          total_tracks: number;
          total_matched_audio: number;
          total_size_bytes: number;
          formats_included: string[];
          storage_path: string | null;
          download_count: number;
          status: 'completed' | 'failed' | 'in_progress';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          playlist_id?: string | null;
          archive_name: string;
          total_tracks?: number;
          total_matched_audio?: number;
          total_size_bytes?: number;
          formats_included?: string[];
          storage_path?: string | null;
          download_count?: number;
          status?: 'completed' | 'failed' | 'in_progress';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          playlist_id?: string | null;
          archive_name?: string;
          total_tracks?: number;
          total_matched_audio?: number;
          total_size_bytes?: number;
          formats_included?: string[];
          storage_path?: string | null;
          download_count?: number;
          status?: 'completed' | 'failed' | 'in_progress';
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
