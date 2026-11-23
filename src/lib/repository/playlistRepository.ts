import { supabase, isSupabaseConfigured } from '../supabase';
import { Playlist, Track } from '../../types';
import {
  NormalizedPlaylistMetadata,
  NormalizedTrackMetadata,
} from '../spotify/types';

const LOCAL_STORAGE_PLAYLISTS = 'pv_local_playlists';
const LOCAL_STORAGE_TRACKS = 'pv_local_tracks';

function getLocalPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PLAYLISTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPlaylists(playlists: Playlist[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_PLAYLISTS, JSON.stringify(playlists));
  } catch (err) {
    console.error('Failed to save playlists to localStorage:', err);
  }
}

function getLocalTracks(): Track[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TRACKS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTracks(tracks: Track[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_TRACKS, JSON.stringify(tracks));
  } catch (err) {
    console.error('Failed to save tracks to localStorage:', err);
  }
}

/**
 * Idempotently saves or updates an imported Spotify playlist and its tracks into Supabase
 * or local resilient storage.
 */
export async function saveImportedPlaylist(
  userId: string,
  playlistMeta: NormalizedPlaylistMetadata,
  tracksMeta: NormalizedTrackMetadata[]
): Promise<{ playlist: Playlist; tracks: Track[] }> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured) {
    // 1. Supabase Persistence: Upsert playlist
    const { data: savedPlaylist, error: playlistError } = await supabase
      .from('playlists')
      .upsert(
        {
          user_id: userId,
          spotify_playlist_id: playlistMeta.spotifyPlaylistId,
          name: playlistMeta.name,
          description: playlistMeta.description,
          image_url: playlistMeta.imageUrl,
          owner_name: playlistMeta.ownerName,
          external_url: playlistMeta.externalUrl,
          total_tracks: tracksMeta.length,
          snapshot_id: playlistMeta.snapshotId,
          updated_at: now,
        },
        { onConflict: 'user_id,spotify_playlist_id' }
      )
      .select()
      .single();

    if (playlistError || !savedPlaylist) {
      throw new Error(`Failed to persist playlist in Supabase: ${playlistError?.message || 'Unknown error'}`);
    }

    const playlistId = savedPlaylist.id;

    // 2. Clear previous tracks for this playlist to ensure snapshot synchronization
    // and prevent orphaned deleted tracks
    await supabase.from('tracks').delete().eq('playlist_id', playlistId);

    // 3. Batch insert tracks
    const tracksToInsert = tracksMeta.map((t) => ({
      playlist_id: playlistId,
      spotify_track_id: t.spotifyTrackId,
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration_ms: t.durationMs,
      track_number: t.trackNumber,
      disc_number: t.discNumber,
      isrc: t.isrc,
      preview_url: t.previewUrl,
      cover_art_url: t.coverArtUrl,
      genres: [],
      explicit: t.explicit,
      release_date: t.releaseDate,
      is_local: t.isLocal,
      added_at: t.addedAt,
    }));

    // Insert in chunks of 200 to stay well within Supabase payload limits
    const chunkSize = 200;
    const insertedTracks: Track[] = [];

    for (let i = 0; i < tracksToInsert.length; i += chunkSize) {
      const chunk = tracksToInsert.slice(i, i + chunkSize);
      const { data: insertedChunk, error: tracksError } = await supabase
        .from('tracks')
        .insert(chunk)
        .select();

      if (tracksError) {
        throw new Error(`Failed to insert tracks chunk: ${tracksError.message}`);
      }
      if (insertedChunk) {
        insertedTracks.push(...(insertedChunk as Track[]));
      }
    }

    return {
      playlist: savedPlaylist as Playlist,
      tracks: insertedTracks,
    };
  }

  // -------------------------------------------------------------
  // Local Resilient Mode (Indexed / localStorage fallback)
  // -------------------------------------------------------------
  const existingPlaylists = getLocalPlaylists();
  let existingIndex = existingPlaylists.findIndex(
    (p) => p.user_id === userId && p.spotify_playlist_id === playlistMeta.spotifyPlaylistId
  );

  let targetId = existingIndex >= 0 ? existingPlaylists[existingIndex].id : `local-pl-${Date.now()}`;

  const playlistRecord: Playlist = {
    id: targetId,
    user_id: userId,
    spotify_playlist_id: playlistMeta.spotifyPlaylistId,
    name: playlistMeta.name,
    description: playlistMeta.description,
    image_url: playlistMeta.imageUrl,
    owner_name: playlistMeta.ownerName,
    external_url: playlistMeta.externalUrl,
    total_tracks: tracksMeta.length,
    snapshot_id: playlistMeta.snapshotId,
    created_at: existingIndex >= 0 ? existingPlaylists[existingIndex].created_at : now,
    updated_at: now,
  };

  if (existingIndex >= 0) {
    existingPlaylists[existingIndex] = playlistRecord;
  } else {
    existingPlaylists.unshift(playlistRecord);
  }
  saveLocalPlaylists(existingPlaylists);

  // Update tracks for this playlist
  const allTracks = getLocalTracks().filter((t) => t.playlist_id !== targetId);
  const newTracks: Track[] = tracksMeta.map((t, idx) => ({
    id: `local-trk-${targetId}-${idx + 1}`,
    playlist_id: targetId,
    spotify_track_id: t.spotifyTrackId,
    title: t.title,
    artist: t.artist,
    album: t.album,
    duration_ms: t.durationMs,
    track_number: t.trackNumber,
    disc_number: t.discNumber,
    isrc: t.isrc,
    preview_url: t.previewUrl,
    cover_art_url: t.coverArtUrl,
    genres: [],
    explicit: t.explicit,
    release_date: t.releaseDate,
    is_local: t.isLocal,
    added_at: t.addedAt,
  }));

  saveLocalTracks([...allTracks, ...newTracks]);

  return {
    playlist: playlistRecord,
    tracks: newTracks,
  };
}

/**
 * Fetches all playlists owned by the authenticated user.
 */
export async function getUserPlaylists(userId: string): Promise<Playlist[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching playlists from Supabase:', error);
      throw error;
    }
    return (data as Playlist[]) || [];
  }

  return getLocalPlaylists().filter((p) => p.user_id === userId);
}

/**
 * Fetches playlist details and its tracks.
 */
export async function getPlaylistDetails(
  playlistId: string
): Promise<{ playlist: Playlist; tracks: Track[] } | null> {
  if (isSupabaseConfigured) {
    const { data: playlist, error: plError } = await supabase
      .from('playlists')
      .select('*')
      .eq('id', playlistId)
      .single();

    if (plError || !playlist) {
      return null;
    }

    const { data: tracks, error: trkError } = await supabase
      .from('tracks')
      .select('*')
      .eq('playlist_id', playlistId)
      .order('track_number', { ascending: true });

    if (trkError) {
      throw trkError;
    }

    return {
      playlist: playlist as Playlist,
      tracks: (tracks as Track[]) || [],
    };
  }

  const playlist = getLocalPlaylists().find((p) => p.id === playlistId);
  if (!playlist) return null;

  const tracks = getLocalTracks()
    .filter((t) => t.playlist_id === playlistId)
    .sort((a, b) => a.track_number - b.track_number);

  return { playlist, tracks };
}

/**
 * Deletes a playlist and its cascaded tracks.
 */
export async function deletePlaylist(playlistId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('playlists').delete().eq('id', playlistId);
    if (error) throw error;
    return;
  }

  saveLocalPlaylists(getLocalPlaylists().filter((p) => p.id !== playlistId));
  saveLocalTracks(getLocalTracks().filter((t) => t.playlist_id !== playlistId));
}
