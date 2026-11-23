import { describe, it, expect, beforeEach } from 'vitest';
import { MatchRepository } from '../lib/matching/matchRepository';
import { TrackMatch } from '../types';

describe('Match Repository & Persistence Service', () => {
  const dummyMatch: TrackMatch = {
    id: 'test-match-1',
    user_id: 'test-user',
    playlist_id: 'test-playlist-1',
    track_id: 'test-track-1',
    audio_file_id: 'test-audio-1',
    match_type: 'auto',
    confidence_score: 92.5,
    status: 'pending',
    matched_at: new Date().toISOString(),
    notes: 'Auto-matched by title and duration',
  };

  beforeEach(async () => {
    localStorage.clear();
    await MatchRepository.clearPlaylistMatches('test-playlist-1');
  });

  it('saves and retrieves match records for a playlist', async () => {
    await MatchRepository.saveMatch(dummyMatch);

    const matches = await MatchRepository.getPlaylistMatches('test-playlist-1');
    expect(matches).toHaveLength(1);
    expect(matches[0].track_id).toBe('test-track-1');
    expect(matches[0].confidence_score).toBe(92.5);
  });

  it('updates an existing match when re-matched or manually assigned', async () => {
    await MatchRepository.saveMatch(dummyMatch);

    // Manual override with different audio file
    const updatedMatch: TrackMatch = {
      ...dummyMatch,
      audio_file_id: 'test-audio-new',
      match_type: 'manual',
      confidence_score: 100,
      status: 'confirmed',
      notes: 'Manually chosen by user',
    };

    await MatchRepository.saveMatch(updatedMatch);

    const matches = await MatchRepository.getPlaylistMatches('test-playlist-1');
    expect(matches).toHaveLength(1); // Ensures no duplicate rows for the same track
    expect(matches[0].audio_file_id).toBe('test-audio-new');
    expect(matches[0].match_type).toBe('manual');
    expect(matches[0].status).toBe('confirmed');
  });

  it('updates match status from pending to confirmed or rejected', async () => {
    await MatchRepository.saveMatch(dummyMatch);

    await MatchRepository.updateMatchStatus('test-playlist-1', 'test-track-1', 'confirmed');
    let matches = await MatchRepository.getPlaylistMatches('test-playlist-1');
    expect(matches[0].status).toBe('confirmed');

    await MatchRepository.updateMatchStatus('test-playlist-1', 'test-track-1', 'rejected');
    matches = await MatchRepository.getPlaylistMatches('test-playlist-1');
    expect(matches[0].status).toBe('rejected');
  });

  it('unmatches a track by removing the match record', async () => {
    await MatchRepository.saveMatch(dummyMatch);

    await MatchRepository.unmatchTrack('test-playlist-1', 'test-track-1');
    const matches = await MatchRepository.getPlaylistMatches('test-playlist-1');
    expect(matches).toHaveLength(0);
  });

  it('saves batch matches atomically and clears playlist matches', async () => {
    const match2: TrackMatch = {
      ...dummyMatch,
      id: 'test-match-2',
      track_id: 'test-track-2',
      audio_file_id: 'test-audio-2',
    };

    await MatchRepository.saveBatchMatches([dummyMatch, match2]);
    let matches = await MatchRepository.getPlaylistMatches('test-playlist-1');
    expect(matches).toHaveLength(2);

    await MatchRepository.clearPlaylistMatches('test-playlist-1');
    matches = await MatchRepository.getPlaylistMatches('test-playlist-1');
    expect(matches).toHaveLength(0);
  });
});
