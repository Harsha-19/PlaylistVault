import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  normalizePlaylistMetadata,
  normalizeTrackItems,
  fetchFullPlaylist,
} from '../lib/spotify/playlists';
import {
  SpotifyPlaylistObject,
  SpotifyPlaylistTrackItem,
  SpotifyPaginated,
} from '../lib/spotify/types';
import { saveSpotifySession } from '../lib/spotify/auth';

describe('Spotify Playlists Service', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizePlaylistMetadata', () => {
    it('normalizes complete Spotify playlist object', () => {
      const raw: SpotifyPlaylistObject = {
        id: '37i9dQZF1DXcBWIGoYBM5M',
        name: "Today's Top Hits",
        description: 'The biggest songs right now.',
        images: [{ url: 'https://i.scdn.co/image/ab67706f000000021' }],
        owner: { id: 'spotify', display_name: 'Spotify' },
        external_urls: { spotify: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' },
        public: true,
        collaborative: false,
        snapshot_id: 'snapshot-1234',
        tracks: {
          href: '',
          items: [],
          limit: 100,
          next: null,
          offset: 0,
          previous: null,
          total: 50,
        },
      };

      const result = normalizePlaylistMetadata(raw);
      expect(result.spotifyPlaylistId).toBe('37i9dQZF1DXcBWIGoYBM5M');
      expect(result.name).toBe("Today's Top Hits");
      expect(result.ownerName).toBe('Spotify');
      expect(result.imageUrl).toBe('https://i.scdn.co/image/ab67706f000000021');
      expect(result.totalTracks).toBe(50);
      expect(result.snapshotId).toBe('snapshot-1234');
    });

    it('handles missing images and owner gracefully', () => {
      const raw: SpotifyPlaylistObject = {
        id: 'sample_id',
        name: '',
        description: null,
        images: [],
        owner: { id: 'user_1' },
        external_urls: {},
        public: null,
        collaborative: false,
        snapshot_id: '',
        tracks: {
          href: '',
          items: [],
          limit: 100,
          next: null,
          offset: 0,
          previous: null,
          total: 0,
        },
      };

      const result = normalizePlaylistMetadata(raw);
      expect(result.name).toBe('Untitled Playlist');
      expect(result.ownerName).toBe('user_1');
      expect(result.imageUrl).toBe('');
      expect(result.description).toBe('');
    });
  });

  describe('normalizeTrackItems', () => {
    it('normalizes tracks and assigns sequential 1-based track numbers', () => {
      const items: SpotifyPlaylistTrackItem[] = [
        {
          added_at: '2026-11-01T12:00:00Z',
          is_local: false,
          track: {
            id: 'track_1',
            name: 'Song One',
            artists: [{ id: 'a1', name: 'Artist A' }],
            album: {
              id: 'al1',
              name: 'Album One',
              images: [{ url: 'https://cover1.jpg' }],
              release_date: '2026-05-15',
            },
            duration_ms: 210000,
            explicit: true,
            disc_number: 1,
            track_number: 3,
            external_ids: { isrc: 'US123456789' },
            preview_url: null,
          },
        },
        {
          added_at: '2026-11-02T12:00:00Z',
          is_local: false,
          track: {
            id: 'track_2',
            name: 'Song Two',
            artists: [
              { id: 'a1', name: 'Artist A' },
              { id: 'a2', name: 'Artist B' },
            ],
            album: {
              id: 'al2',
              name: 'Album Two',
              images: [],
            },
            duration_ms: 180000,
            explicit: false,
          },
        },
      ];

      const tracks = normalizeTrackItems(items);
      expect(tracks).toHaveLength(2);
      expect(tracks[0].trackNumber).toBe(1);
      expect(tracks[0].title).toBe('Song One');
      expect(tracks[0].artist).toBe('Artist A');
      expect(tracks[0].isrc).toBe('US123456789');
      expect(tracks[0].explicit).toBe(true);

      expect(tracks[1].trackNumber).toBe(2);
      expect(tracks[1].artist).toBe('Artist A, Artist B');
      expect(tracks[1].coverArtUrl).toBeNull();
    });

    it('skips removed or region-restricted null tracks safely', () => {
      const items: SpotifyPlaylistTrackItem[] = [
        {
          added_at: '2026-11-01T12:00:00Z',
          is_local: false,
          track: null, // deleted track
        },
        {
          added_at: '2026-11-01T12:00:00Z',
          is_local: false,
          track: {
            id: 'valid_track',
            name: 'Available Track',
            artists: [{ id: 'a1', name: 'Artist' }],
            album: { id: 'al', name: 'Al', images: [] },
            duration_ms: 200000,
            explicit: false,
          },
        },
      ];

      const tracks = normalizeTrackItems(items);
      expect(tracks).toHaveLength(1);
      expect(tracks[0].title).toBe('Available Track');
      expect(tracks[0].trackNumber).toBe(1);
    });
  });

  describe('fetchFullPlaylist with Pagination', () => {
    it('fetches multi-page playlists completely and fires progress callbacks', async () => {
      saveSpotifySession({
        accessToken: 'valid-test-token',
        expiresAt: Date.now() + 3600 * 1000,
        scope: 'playlist-read-private',
      });

      const rootPlaylist: SpotifyPlaylistObject = {
        id: 'multi_page_playlist',
        name: 'Big Playlist',
        description: 'Multi-page test',
        images: [],
        owner: { id: 'curator', display_name: 'Curator' },
        external_urls: {},
        public: true,
        collaborative: false,
        snapshot_id: 'snap1',
        tracks: {
          href: 'https://api.spotify.com/v1/playlists/multi_page_playlist/tracks?offset=0&limit=2',
          items: [
            {
              added_at: '2026-11-01T00:00:00Z',
              is_local: false,
              track: {
                id: 'track_1',
                name: 'Track 1',
                artists: [{ id: 'a1', name: 'A' }],
                album: { id: 'al1', name: 'Al1', images: [] },
                duration_ms: 180000,
                explicit: false,
              },
            },
          ],
          limit: 1,
          next: 'https://api.spotify.com/v1/playlists/multi_page_playlist/tracks?offset=1&limit=1',
          offset: 0,
          previous: null,
          total: 2,
        },
      };

      const page2: SpotifyPaginated<SpotifyPlaylistTrackItem> = {
        href: 'https://api.spotify.com/v1/playlists/multi_page_playlist/tracks?offset=1&limit=1',
        items: [
          {
            added_at: '2026-11-01T00:01:00Z',
            is_local: false,
            track: {
              id: 'track_2',
              name: 'Track 2',
              artists: [{ id: 'a2', name: 'B' }],
              album: { id: 'al2', name: 'Al2', images: [] },
              duration_ms: 220000,
              explicit: false,
            },
          },
        ],
        limit: 1,
        next: null,
        offset: 1,
        previous: null,
        total: 2,
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = url.toString();
        if (urlStr.includes('/playlists/multi_page_playlist?')) {
          return {
            ok: true,
            status: 200,
            json: async () => rootPlaylist,
          } as Response;
        }
        if (urlStr.includes('offset=1')) {
          return {
            ok: true,
            status: 200,
            json: async () => page2,
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const progressUpdates: Array<{ loaded: number; total: number }> = [];

      const result = await fetchFullPlaylist('multi_page_playlist', {
        onProgress: (loaded, total) => {
          progressUpdates.push({ loaded, total });
        },
      });

      expect(result.playlist.name).toBe('Big Playlist');
      expect(result.tracks).toHaveLength(2);
      expect(result.tracks[0].title).toBe('Track 1');
      expect(result.tracks[1].title).toBe('Track 2');
      expect(progressUpdates.length).toBeGreaterThan(0);
    });
  });
});
