import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  getSpotifySession,
  clearSpotifySession,
  buildAuthorizeUrl,
  getSpotifyClientId,
} from '../lib/spotify/auth';
import { SpotifyUser } from '../lib/spotify/types';
import { extractSpotifyPlaylistId } from '../lib/spotify/playlistParser';
import { fetchFullPlaylist } from '../lib/spotify/playlists';
import { saveImportedPlaylist, getPlaylistDetails } from '../lib/repository/playlistRepository';
import { useAuth } from './AuthContext';
import { Playlist } from '../types';

export interface ImportProgressUpdate {
  status: 'idle' | 'validating' | 'fetching_metadata' | 'fetching_tracks' | 'saving' | 'completed' | 'error';
  message: string;
  loadedTracks?: number;
  totalTracks?: number;
  preview?: {
    name: string;
    owner: string;
    imageUrl: string;
    totalTracks: number;
  };
}

interface SpotifyContextType {
  isConnected: boolean;
  spotifyUser: SpotifyUser | null;
  isLoading: boolean;
  hasClientId: boolean;
  connectSpotify: (returnPath?: string) => Promise<void>;
  disconnectSpotify: () => void;
  importPlaylist: (
    urlOrId: string,
    onProgress?: (update: ImportProgressUpdate) => void
  ) => Promise<Playlist>;
  refreshPlaylistData: (
    playlistId: string,
    onProgress?: (update: ImportProgressUpdate) => void
  ) => Promise<Playlist>;
}

const SpotifyContext = createContext<SpotifyContextType | undefined>(undefined);

export function SpotifyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      const session = await getSpotifySession();
      if (session && session.accessToken) {
        setIsConnected(true);
        setSpotifyUser(session.user || null);
      } else {
        setIsConnected(false);
        setSpotifyUser(null);
      }
    } catch {
      setIsConnected(false);
      setSpotifyUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connectSpotify = async (returnPath = '/playlists') => {
    const authUrl = await buildAuthorizeUrl(returnPath);
    window.location.href = authUrl;
  };

  const disconnectSpotify = () => {
    clearSpotifySession();
    setIsConnected(false);
    setSpotifyUser(null);
  };

  const importPlaylist = async (
    urlOrId: string,
    onProgress?: (update: ImportProgressUpdate) => void
  ): Promise<Playlist> => {
    const notify = (update: ImportProgressUpdate) => {
      if (onProgress) onProgress(update);
    };

    // 1. Validate Input
    notify({
      status: 'validating',
      message: 'Validating Spotify playlist link...',
    });

    const playlistId = extractSpotifyPlaylistId(urlOrId);

    // 2. Fetch Playlist Details & Tracks from Spotify
    notify({
      status: 'fetching_metadata',
      message: 'Connecting to Spotify Web API & retrieving metadata...',
    });

    const { playlist: playlistMeta, tracks: tracksMeta } = await fetchFullPlaylist(
      playlistId,
      {
        onProgress: (loaded, total) => {
          notify({
            status: 'fetching_tracks',
            message: `Fetching tracks from Spotify (${loaded} of ${total})...`,
            loadedTracks: loaded,
            totalTracks: total,
            preview: {
              name: playlistMeta.name,
              owner: playlistMeta.ownerName,
              imageUrl: playlistMeta.imageUrl,
              totalTracks: total,
            },
          });
        },
      }
    );

    // 3. Persist to Database (Supabase / Local Resilient)
    notify({
      status: 'saving',
      message: `Persisting playlist and ${tracksMeta.length} tracks to database...`,
      loadedTracks: tracksMeta.length,
      totalTracks: tracksMeta.length,
      preview: {
        name: playlistMeta.name,
        owner: playlistMeta.ownerName,
        imageUrl: playlistMeta.imageUrl,
        totalTracks: tracksMeta.length,
      },
    });

    const targetUserId = user?.id || '00000000-0000-0000-0000-000000000001';
    const { playlist: savedPlaylist } = await saveImportedPlaylist(
      targetUserId,
      playlistMeta,
      tracksMeta
    );

    notify({
      status: 'completed',
      message: `Successfully imported "${playlistMeta.name}" with ${tracksMeta.length} tracks!`,
      loadedTracks: tracksMeta.length,
      totalTracks: tracksMeta.length,
      preview: {
        name: playlistMeta.name,
        owner: playlistMeta.ownerName,
        imageUrl: playlistMeta.imageUrl,
        totalTracks: tracksMeta.length,
      },
    });

    return savedPlaylist;
  };

  const refreshPlaylistData = async (
    internalPlaylistId: string,
    onProgress?: (update: ImportProgressUpdate) => void
  ): Promise<Playlist> => {
    const current = await getPlaylistDetails(internalPlaylistId);
    if (!current || !current.playlist.spotify_playlist_id) {
      throw new Error('Playlist has no valid Spotify ID to synchronize.');
    }

    return importPlaylist(current.playlist.spotify_playlist_id, onProgress);
  };

  const hasClientId = Boolean(getSpotifyClientId());

  return (
    <SpotifyContext.Provider
      value={{
        isConnected,
        spotifyUser,
        isLoading,
        hasClientId,
        connectSpotify,
        disconnectSpotify,
        importPlaylist,
        refreshPlaylistData,
      }}
    >
      {children}
    </SpotifyContext.Provider>
  );
}

export function useSpotify() {
  const context = useContext(SpotifyContext);
  if (!context) {
    throw new Error('useSpotify must be used within a SpotifyProvider');
  }
  return context;
}
