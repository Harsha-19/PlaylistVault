import { describe, it, expect } from 'vitest';
import { MatchingEngine } from '../lib/matching/engine';
import { Track } from '../types';
import { StoredAudioFile } from '../lib/audio/types';

describe('Intelligent Track Matching Scoring Engine', () => {
  const sampleSpotifyTrack: Track = {
    id: 'track-sp-1',
    playlist_id: 'playlist-1',
    spotify_track_id: 'spotify:track:123',
    title: 'One More Time',
    artist: 'Daft Punk',
    album: 'Discovery',
    duration_ms: 320000,
    track_number: 1,
    disc_number: 1,
    isrc: 'FR0140000001',
    preview_url: null,
    cover_art_url: 'https://img.example.com/art.jpg',
    genres: ['Electronic'],
    explicit: false,
    release_date: '2001-03-12',
    is_local: false,
    added_at: new Date().toISOString(),
  };

  const sampleAudioFile: StoredAudioFile = {
    id: 'audio-local-1',
    user_id: 'user-1',
    filename: '01 - Daft Punk - One More Time.flac',
    original_name: '01 - Daft Punk - One More Time.flac',
    file_size_bytes: 35000000,
    mime_type: 'audio/flac',
    file_hash: 'hash123',
    duration_ms: 320800, // Delta: 800ms
    title: 'One More Time',
    artist: 'Daft Punk',
    album: 'Discovery',
    genre: 'Electronic',
    genres: ['Electronic', 'House'],
    track_number: 1,
    disc_number: 1,
    year: '2001',
    bitrate_kbps: 900,
    sample_rate_hz: 44100,
    channels: 2,
    codec: 'FLAC',
    artwork_data_url: null,
    blob: new Blob([]),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('awards near 100% confidence for exact title, artist, and duration match', () => {
    const result = MatchingEngine.evaluateMatch(sampleSpotifyTrack, sampleAudioFile);

    expect(result.confidenceScore).toBeGreaterThanOrEqual(95);
    expect(result.classification).toBe('exact');
    expect(result.isVersionMismatch).toBe(false);
    expect(result.durationDeltaMs).toBeLessThanOrEqual(1000);
    expect(result.breakdown.length).toBeGreaterThanOrEqual(3);
  });

  it('handles fuzzy string differences and slight variations', () => {
    const fuzzyAudio: StoredAudioFile = {
      ...sampleAudioFile,
      id: 'audio-fuzzy',
      title: 'One More Time (Radio Edit)',
      duration_ms: 318000, // Delta: 2s
    };

    const result = MatchingEngine.evaluateMatch(sampleSpotifyTrack, fuzzyAudio);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(80);
    expect(result.classification).toBe('high');
  });

  it('applies duration penalty when duration delta is large (>45 seconds)', () => {
    const wrongDurationAudio: StoredAudioFile = {
      ...sampleAudioFile,
      id: 'audio-wrong-duration',
      duration_ms: 180000, // 3 minutes vs 5m20s (delta > 2 mins)
    };

    const result = MatchingEngine.evaluateMatch(sampleSpotifyTrack, wrongDurationAudio);
    expect(result.confidenceScore).toBeLessThan(70);
    const durationPenalty = result.breakdown.find((b) => b.category === 'duration' && b.points < 0);
    expect(durationPenalty).toBeDefined();
    expect(durationPenalty?.description).toContain('Major duration mismatch');
  });

  it('applies version conflict penalty for live vs studio mismatches', () => {
    const liveSpotifyTrack: Track = {
      ...sampleSpotifyTrack,
      title: 'One More Time - Live at Bercy',
    };

    const result = MatchingEngine.evaluateMatch(liveSpotifyTrack, sampleAudioFile);
    expect(result.isVersionMismatch).toBe(true);
    const versionPenalty = result.breakdown.find((b) => b.category === 'version_penalty');
    expect(versionPenalty).toBeDefined();
    expect(versionPenalty?.points).toBeLessThan(0);
  });

  it('ranks multiple candidates accurately, picking the best match first', () => {
    const candidateA: StoredAudioFile = {
      ...sampleAudioFile,
      id: 'cand-a',
      title: 'Harder Better Faster Stronger', // completely different track
      duration_ms: 224000,
    };

    const candidateB: StoredAudioFile = {
      ...sampleAudioFile,
      id: 'cand-b',
      title: 'One More Time (Extended Club Mix)',
      duration_ms: 480000,
    };

    const candidateC: StoredAudioFile = {
      ...sampleAudioFile,
      id: 'cand-c', // Exact target
    };

    const ranked = MatchingEngine.rankAllCandidates(sampleSpotifyTrack, [candidateA, candidateB, candidateC]);
    expect(ranked[0].audioFile.id).toBe('cand-c');
    expect(ranked[0].score.confidenceScore).toBeGreaterThan(ranked[1].score.confidenceScore);
  });

  it('handles missing metadata without crashing', () => {
    const untaggedAudio: StoredAudioFile = {
      ...sampleAudioFile,
      title: '',
      artist: '',
      album: '',
      duration_ms: 0,
      filename: '01 - Daft Punk - One More Time.mp3',
    };

    const result = MatchingEngine.evaluateMatch(sampleSpotifyTrack, untaggedAudio);
    expect(result).toBeDefined();
    expect(result.confidenceScore).toBeGreaterThan(0);
  });
});
