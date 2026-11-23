/**
 * Phase 4 — Track Matches Persistence Repository
 * 
 * Manages atomic persistence of track-to-audio-file matches in Supabase PostgreSQL
 * with local resilient fallback so matches persist across sessions and offline reloads.
 */

import { supabase, isSupabaseConfigured } from '../supabase';
import { TrackMatch } from '../../types';

const LOCAL_STORAGE_KEY = 'pv_track_matches_data';

function getLocalMatches(): TrackMatch[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalMatches(matches: TrackMatch[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(matches));
  } catch (err) {
    console.warn('[PlaylistVault] Failed to save matches in local storage:', err);
  }
}

export class MatchRepository {
  /**
   * Saves or updates a track match record.
   */
  static async saveMatch(match: TrackMatch): Promise<TrackMatch> {
    // 1. Always update local storage for offline resilience
    const localMatches = getLocalMatches();
    const existingIndex = localMatches.findIndex(
      (m) => m.playlist_id === match.playlist_id && m.track_id === match.track_id
    );

    if (existingIndex >= 0) {
      localMatches[existingIndex] = match;
    } else {
      localMatches.push(match);
    }
    saveLocalMatches(localMatches);

    // 2. Persist to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('track_matches')
          .upsert(
            {
              id: match.id,
              user_id: match.user_id,
              playlist_id: match.playlist_id,
              track_id: match.track_id,
              audio_file_id: match.audio_file_id,
              match_type: match.match_type,
              confidence_score: match.confidence_score,
              status: match.status,
              matched_at: match.matched_at,
              notes: match.notes,
            },
            { onConflict: 'playlist_id,track_id' }
          )
          .select()
          .single();

        if (error) {
          console.warn('[PlaylistVault] Supabase track_matches upsert notice:', error.message);
        } else if (data) {
          return data as TrackMatch;
        }
      } catch (err) {
        console.warn('[PlaylistVault] Supabase match persistence skipped:', err);
      }
    }

    return match;
  }

  /**
   * Saves a batch of matches atomically.
   */
  static async saveBatchMatches(matches: TrackMatch[]): Promise<TrackMatch[]> {
    if (matches.length === 0) return [];

    // Local storage update
    const localMatches = getLocalMatches();
    for (const match of matches) {
      const idx = localMatches.findIndex(
        (m) => m.playlist_id === match.playlist_id && m.track_id === match.track_id
      );
      if (idx >= 0) {
        localMatches[idx] = match;
      } else {
        localMatches.push(match);
      }
    }
    saveLocalMatches(localMatches);

    // Supabase update
    if (isSupabaseConfigured) {
      try {
        const payload = matches.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          playlist_id: m.playlist_id,
          track_id: m.track_id,
          audio_file_id: m.audio_file_id,
          match_type: m.match_type,
          confidence_score: m.confidence_score,
          status: m.status,
          matched_at: m.matched_at,
          notes: m.notes,
        }));

        const { error } = await supabase
          .from('track_matches')
          .upsert(payload, { onConflict: 'playlist_id,track_id' });

        if (error) {
          console.warn('[PlaylistVault] Supabase batch matches upsert notice:', error.message);
        }
      } catch (err) {
        console.warn('[PlaylistVault] Supabase batch match skipped:', err);
      }
    }

    return matches;
  }

  /**
   * Retrieves all matches for a given playlist.
   */
  static async getPlaylistMatches(playlistId: string): Promise<TrackMatch[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('track_matches')
          .select('*')
          .eq('playlist_id', playlistId);

        if (!error && data) {
          return data as TrackMatch[];
        }
      } catch (err) {
        console.warn('[PlaylistVault] Supabase getPlaylistMatches fallback:', err);
      }
    }

    // Local fallback
    const local = getLocalMatches();
    return local.filter((m) => m.playlist_id === playlistId);
  }

  /**
   * Deletes a match for a track in a playlist (Unmatch).
   */
  static async unmatchTrack(playlistId: string, trackId: string): Promise<void> {
    const local = getLocalMatches();
    const filtered = local.filter((m) => !(m.playlist_id === playlistId && m.track_id === trackId));
    saveLocalMatches(filtered);

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('track_matches')
          .delete()
          .eq('playlist_id', playlistId)
          .eq('track_id', trackId);
      } catch (err) {
        console.warn('[PlaylistVault] Supabase unmatchTrack notice:', err);
      }
    }
  }

  /**
   * Updates match status (e.g. from 'pending' to 'confirmed' or 'rejected').
   */
  static async updateMatchStatus(
    playlistId: string,
    trackId: string,
    status: 'confirmed' | 'pending' | 'rejected'
  ): Promise<TrackMatch | null> {
    const local = getLocalMatches();
    const match = local.find((m) => m.playlist_id === playlistId && m.track_id === trackId);
    if (match) {
      match.status = status;
      match.matched_at = new Date().toISOString();
      saveLocalMatches(local);
    }

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('track_matches')
          .update({ status, matched_at: new Date().toISOString() })
          .eq('playlist_id', playlistId)
          .eq('track_id', trackId);
      } catch (err) {
        console.warn('[PlaylistVault] Supabase updateMatchStatus notice:', err);
      }
    }

    return match || null;
  }

  /**
   * Clears all matches for a playlist.
   */
  static async clearPlaylistMatches(playlistId: string): Promise<void> {
    const local = getLocalMatches();
    const remaining = local.filter((m) => m.playlist_id !== playlistId);
    saveLocalMatches(remaining);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('track_matches').delete().eq('playlist_id', playlistId);
      } catch (err) {
        console.warn('[PlaylistVault] Supabase clearPlaylistMatches notice:', err);
      }
    }
  }
}
