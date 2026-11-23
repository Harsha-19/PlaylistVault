import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveImportedPlaylist,
  getUserPlaylists,
  getPlaylistDetails,
  deletePlaylist,
} from '../lib/repository/playlistRepository';
import { NormalizedPlaylistMetadata, NormalizedTrackMetadata } from '../lib/spotify/types';

describe('Playlist Repository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const samplePlaylistMeta: NormalizedPlaylistMetadata = {
    spotifyPlaylistId: 'spotify_pl_001',
    name: 'Lo-Fi Chill Beats',
    description: 'Relaxing beats to code/study to.',
    ownerName: 'ChillCurator',
    imageUrl: 'https://images.example.com/cover.jpg',
    externalUrl: 'https://open.spotify.com/playlist/spotify_pl_001',
    totalTracks: 2,
    snapshotId: 'snap_v1',
    isPublic: true,
    collaborative: false,
  };

  const sampleTracksMeta: NormalizedTrackMetadata[] = [
    {
      spotifyTrackId: 't1',
      title: 'Midnight Coffee',
      artist: 'Aesthetic Kid',
      album: 'Late Nights',
      durationMs: 145000,
      trackNumber: 1,
      discNumber: 1,
      isrc: 'US00000001',
      previewUrl: null,
      coverArtUrl: 'https://images.example.com/art1.jpg',
      explicit: false,
      releaseDate: '2026-01-01',
      isLocal: false,
      addedAt: '2026-11-01T00:00:00Z',
    },
    {
      spotifyTrackId: 't2',
      title: 'Neon Rainy Walk',
      artist: 'Tokyo Drift Girl',
      album: 'City Lights',
      durationMs: 180000,
      trackNumber: 2,
      discNumber: 1,
      isrc: 'US00000002',
      previewUrl: null,
      coverArtUrl: 'https://images.example.com/art2.jpg',
      explicit: false,
      releaseDate: '2026-02-01',
      isLocal: false,
      addedAt: '2026-11-01T00:00:00Z',
    },
  ];

  it('saves an imported playlist and its tracks', async () => {
    const userId = 'user_test_1';
    const { playlist, tracks } = await saveImportedPlaylist(
      userId,
      samplePlaylistMeta,
      sampleTracksMeta
    );

    expect(playlist.id).toBeDefined();
    expect(playlist.name).toBe('Lo-Fi Chill Beats');
    expect(playlist.total_tracks).toBe(2);
    expect(tracks).toHaveLength(2);
    expect(tracks[0].title).toBe('Midnight Coffee');
    expect(tracks[1].title).toBe('Neon Rainy Walk');

    const userPlaylists = await getUserPlaylists(userId);
    expect(userPlaylists).toHaveLength(1);
    expect(userPlaylists[0].id).toBe(playlist.id);
  });

  it('prevents duplicates when re-importing the same playlist (idempotent)', async () => {
    const userId = 'user_test_1';

    // First import
    const { playlist: firstSave } = await saveImportedPlaylist(
      userId,
      samplePlaylistMeta,
      sampleTracksMeta
    );

    // Re-import same playlist with updated title and snapshot
    const updatedMeta: NormalizedPlaylistMetadata = {
      ...samplePlaylistMeta,
      name: 'Lo-Fi Chill Beats (Updated 2026)',
      snapshotId: 'snap_v2',
    };

    const { playlist: secondSave, tracks: updatedTracks } = await saveImportedPlaylist(
      userId,
      updatedMeta,
      sampleTracksMeta
    );

    // Must preserve the same playlist database ID
    expect(secondSave.id).toBe(firstSave.id);
    expect(secondSave.name).toBe('Lo-Fi Chill Beats (Updated 2026)');

    // Total playlists count for this user must still be exactly 1
    const userPlaylists = await getUserPlaylists(userId);
    expect(userPlaylists).toHaveLength(1);

    // Tracks count must still be exactly 2 (no duplicate tracks created)
    expect(updatedTracks).toHaveLength(2);
  });

  it('enforces user isolation: users only see their own playlists', async () => {
    await saveImportedPlaylist('user_alice', samplePlaylistMeta, sampleTracksMeta);
    await saveImportedPlaylist('user_bob', {
      ...samplePlaylistMeta,
      spotifyPlaylistId: 'bob_pl_001',
      name: "Bob's Jazz",
    }, sampleTracksMeta);

    const alicePlaylists = await getUserPlaylists('user_alice');
    expect(alicePlaylists).toHaveLength(1);
    expect(alicePlaylists[0].name).toBe('Lo-Fi Chill Beats');

    const bobPlaylists = await getUserPlaylists('user_bob');
    expect(bobPlaylists).toHaveLength(1);
    expect(bobPlaylists[0].name).toBe("Bob's Jazz");
  });

  it('retrieves playlist details and tracks sorted by track_number', async () => {
    const { playlist } = await saveImportedPlaylist(
      'user_test_1',
      samplePlaylistMeta,
      sampleTracksMeta
    );

    const details = await getPlaylistDetails(playlist.id);
    expect(details).not.toBeNull();
    expect(details?.playlist.name).toBe('Lo-Fi Chill Beats');
    expect(details?.tracks).toHaveLength(2);
    expect(details?.tracks[0].track_number).toBe(1);
    expect(details?.tracks[1].track_number).toBe(2);
  });

  it('deletes playlist and all its tracks', async () => {
    const { playlist } = await saveImportedPlaylist(
      'user_test_1',
      samplePlaylistMeta,
      sampleTracksMeta
    );

    await deletePlaylist(playlist.id);

    const details = await getPlaylistDetails(playlist.id);
    expect(details).toBeNull();

    const playlists = await getUserPlaylists('user_test_1');
    expect(playlists).toHaveLength(0);
  });
});
