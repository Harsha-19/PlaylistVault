import { describe, it, expect } from 'vitest';
import { validateExportSelection } from '../lib/export/exportValidator';
import { ExportOptionsConfig } from '../lib/export/types';
import { StoredAudioFile } from '../lib/audio/types';
import { Track, TrackMatch } from '../types';

describe('Pre-Export Validation Engine (Phase 6)', () => {
  const mockConfig: ExportOptionsConfig = {
    sourceType: 'spotify_playlist',
    sourceId: 'playlist-1',
    sourceName: 'My Awesome Playlist',
    folderStructure: 'playlist_track',
    filenamePattern: 'track_artist_title',
    includeAudioFiles: true,
    includeCsv: true,
    includeJson: true,
    includePlaylistJson: true,
    includeReadme: true,
  };

  const audioFile1: StoredAudioFile = {
    id: 'audio-1',
    user_id: 'user-1',
    filename: 'track1.mp3',
    original_name: 'track1.mp3',
    file_size_bytes: 5000000,
    mime_type: 'audio/mpeg',
    file_hash: 'hash-1',
    duration_ms: 180000,
    title: 'Song One',
    artist: 'Artist A',
    album: 'Album A',
    genre: 'Rock',
    genres: ['Rock'],
    track_number: 1,
    disc_number: 1,
    year: '2023',
    bitrate_kbps: 320,
    sample_rate_hz: 44100,
    channels: 2,
    codec: 'MP3',
    artwork_data_url: null,
    blob: new Blob(['fake-audio-1']),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const audioFile2: StoredAudioFile = {
    ...audioFile1,
    id: 'audio-2',
    filename: 'track2.flac',
    file_size_bytes: 12000000,
    file_hash: 'hash-2',
    title: 'Song Two',
    artist: 'Artist B',
    codec: 'FLAC',
    blob: new Blob(['fake-audio-2']),
  };

  const tracks: Track[] = [
    {
      id: 'track-1',
      playlist_id: 'playlist-1',
      spotify_track_id: 'sp-1',
      title: 'Song One (Official)',
      artist: 'Artist A',
      album: 'Album A',
      duration_ms: 180000,
      track_number: 1,
      disc_number: 1,
      isrc: null,
      preview_url: null,
      cover_art_url: null,
      genres: ['Rock'],
      is_local: false,
      explicit: false,
      release_date: '2023',
      added_at: new Date().toISOString(),
    },
    {
      id: 'track-2',
      playlist_id: 'playlist-1',
      spotify_track_id: 'sp-2',
      title: 'Song Two',
      artist: 'Artist B',
      album: 'Album B',
      duration_ms: 200000,
      track_number: 2,
      disc_number: 1,
      isrc: null,
      preview_url: null,
      cover_art_url: null,
      genres: ['Rock'],
      is_local: false,
      explicit: false,
      release_date: '2023',
      added_at: new Date().toISOString(),
    },
    {
      id: 'track-3',
      playlist_id: 'playlist-1',
      spotify_track_id: 'sp-3',
      title: 'Unmatched Song',
      artist: 'Artist C',
      album: 'Album C',
      duration_ms: 220000,
      track_number: 3,
      disc_number: 1,
      isrc: null,
      preview_url: null,
      cover_art_url: null,
      genres: ['Rock'],
      is_local: false,
      explicit: false,
      release_date: '2023',
      added_at: new Date().toISOString(),
    },
    {
      id: 'track-4',
      playlist_id: 'playlist-1',
      spotify_track_id: 'sp-4',
      title: 'Missing Binary Song',
      artist: 'Artist D',
      album: 'Album D',
      duration_ms: 210000,
      track_number: 4,
      disc_number: 1,
      isrc: null,
      preview_url: null,
      cover_art_url: null,
      genres: ['Rock'],
      is_local: false,
      explicit: false,
      release_date: '2023',
      added_at: new Date().toISOString(),
    },
    {
      id: 'track-5',
      playlist_id: 'playlist-1',
      spotify_track_id: 'sp-5',
      title: 'Duplicate Track Reference',
      artist: 'Artist A',
      album: 'Album A',
      duration_ms: 180000,
      track_number: 5,
      disc_number: 1,
      isrc: null,
      preview_url: null,
      cover_art_url: null,
      genres: ['Rock'],
      is_local: false,
      explicit: false,
      release_date: '2023',
      added_at: new Date().toISOString(),
    },
  ];

  const matches: TrackMatch[] = [
    {
      id: 'm-1',
      user_id: 'user-1',
      playlist_id: 'playlist-1',
      track_id: 'track-1',
      audio_file_id: 'audio-1',
      match_type: 'auto',
      confidence_score: 95,
      status: 'confirmed',
      matched_at: new Date().toISOString(),
      notes: null,
    },
    {
      id: 'm-2',
      user_id: 'user-1',
      playlist_id: 'playlist-1',
      track_id: 'track-2',
      audio_file_id: 'audio-2',
      match_type: 'auto',
      confidence_score: 90,
      status: 'confirmed',
      matched_at: new Date().toISOString(),
      notes: null,
    },
    // track-3 has no match
    {
      id: 'm-4',
      user_id: 'user-1',
      playlist_id: 'playlist-1',
      track_id: 'track-4',
      audio_file_id: 'non-existent-audio-id',
      match_type: 'manual',
      confidence_score: 80,
      status: 'confirmed',
      matched_at: new Date().toISOString(),
      notes: null,
    },
    {
      id: 'm-5',
      user_id: 'user-1',
      playlist_id: 'playlist-1',
      track_id: 'track-5',
      audio_file_id: 'audio-1', // Duplicate assignment to audio-1!
      match_type: 'manual',
      confidence_score: 75,
      status: 'pending',
      matched_at: new Date().toISOString(),
      notes: null,
    },
  ];

  it('accurately categorizes ready, unmatched, missing binary, and duplicate tracks', () => {
    const summary = validateExportSelection({
      config: mockConfig,
      tracks,
      matches,
      audioFiles: [audioFile1, audioFile2],
    });

    expect(summary.totalTracks).toBe(5);
    expect(summary.unmatchedTracks).toBe(1); // track-3
    expect(summary.missingBinaryTracks).toBe(1); // track-4
    expect(summary.duplicateAssignments).toBe(2); // track-1 and track-5 both use audio-1
    expect(summary.readyTracks).toBe(3); // track-1, track-2, track-5 have audio binaries

    expect(summary.canExport).toBe(true);
    expect(summary.requiresPartialConfirmation).toBe(true);

    const item1 = summary.items.find((i) => i.trackId === 'track-1');
    expect(item1?.status).toBe('duplicate_audio');

    const item2 = summary.items.find((i) => i.trackId === 'track-2');
    expect(item2?.status).toBe('ready');

    const item3 = summary.items.find((i) => i.trackId === 'track-3');
    expect(item3?.status).toBe('unmatched');

    const item4 = summary.items.find((i) => i.trackId === 'track-4');
    expect(item4?.status).toBe('missing_binary');
  });

  it('calculates total estimated archive size including metadata buffer', () => {
    const summary = validateExportSelection({
      config: mockConfig,
      tracks: [tracks[0], tracks[1]],
      matches: [matches[0], matches[1]],
      audioFiles: [audioFile1, audioFile2],
    });

    const expectedAudioBytes = audioFile1.file_size_bytes + audioFile2.file_size_bytes;
    expect(summary.estimatedBytes).toBe(expectedAudioBytes + 40960);
    expect(summary.requiresPartialConfirmation).toBe(false);
  });

  it('validates custom collection exports correctly', () => {
    const collectionConfig: ExportOptionsConfig = {
      ...mockConfig,
      sourceType: 'custom_collection',
      sourceId: 'coll-1',
      sourceName: 'My Local Chill',
    };

    const summary = validateExportSelection({
      config: collectionConfig,
      audioFiles: [audioFile1],
      collectionAudioFileIds: ['audio-1', 'missing-audio-id'],
    });

    expect(summary.totalTracks).toBe(2);
    expect(summary.readyTracks).toBe(1);
    expect(summary.missingBinaryTracks).toBe(1);
    expect(summary.requiresPartialConfirmation).toBe(true);
  });
});
