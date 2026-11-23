/**
 * Phase 4 — Track Matching React Context & State Management
 * 
 * Centralizes matching engine execution, candidate evaluation, manual pairing,
 * confirmation, rejection, unmatching, and statistics calculation.
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Playlist, Track, TrackMatch } from '../types';
import { StoredAudioFile } from '../lib/audio/types';
import { MatchingEngine } from '../lib/matching/engine';
import { MatchRepository } from '../lib/matching/matchRepository';
import { CompleteTrackMatchItem, MatchStudioStats } from '../lib/matching/types';
import { useAudio } from './AudioContext';
import { useAuth } from './AuthContext';
import { getPlaylistDetails, getUserPlaylists } from '../lib/repository/playlistRepository';

interface MatchContextType {
  availablePlaylists: Playlist[];
  selectedPlaylistId: string | null;
  setSelectedPlaylistId: (id: string | null) => void;
  activePlaylist: Playlist | null;
  matchItems: CompleteTrackMatchItem[];
  stats: MatchStudioStats;
  isMatching: boolean;
  runAutoMatch: () => Promise<void>;
  manualPair: (trackId: string, audioFileId: string) => Promise<void>;
  confirmMatch: (trackId: string) => Promise<void>;
  rejectMatch: (trackId: string) => Promise<void>;
  unmatch: (trackId: string) => Promise<void>;
  bulkConfirmHighConfidence: () => Promise<void>;
  resetMatches: () => Promise<void>;
  refreshMatches: () => Promise<void>;
}

const MatchContext = createContext<MatchContextType | undefined>(undefined);

export function MatchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id || 'local-user';
  const { audioFiles } = useAudio();

  const [availablePlaylists, setAvailablePlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [matches, setMatches] = useState<TrackMatch[]>([]);
  const [isMatching, setIsMatching] = useState(false);

  // Load playlists on mount
  useEffect(() => {
    async function loadPlaylists() {
      try {
        const playlists = await getUserPlaylists(userId);
        setAvailablePlaylists(playlists);
        if (playlists.length > 0) {
          setSelectedPlaylistId((prev) => prev || playlists[0].id);
        }
      } catch (err) {
        console.error('[PlaylistVault] Failed to load playlists for Match Studio:', err);
      }
    }
    loadPlaylists();
  }, [userId]);

  // Load playlist details & tracks when selectedPlaylistId changes
  const loadPlaylistTracksAndMatches = useCallback(async () => {
    if (!selectedPlaylistId) {
      setActivePlaylist(null);
      setTracks([]);
      setMatches([]);
      return;
    }

    try {
      const details = await getPlaylistDetails(selectedPlaylistId);
      if (details) {
        setActivePlaylist(details.playlist);
        setTracks(details.tracks);
      }

      const existingMatches = await MatchRepository.getPlaylistMatches(selectedPlaylistId);
      setMatches(existingMatches);
    } catch (err) {
      console.error('[PlaylistVault] Failed to load tracks and matches:', err);
    }
  }, [selectedPlaylistId]);

  useEffect(() => {
    loadPlaylistTracksAndMatches();
  }, [loadPlaylistTracksAndMatches]);

  // Audio files lookup map by ID
  const audioFilesMap = useMemo(() => {
    const map = new Map<string, StoredAudioFile>();
    audioFiles.forEach((file) => map.set(file.id, file));
    return map;
  }, [audioFiles]);

  // Matches lookup map by track_id
  const matchesMap = useMemo(() => {
    const map = new Map<string, TrackMatch>();
    matches.forEach((m) => map.set(m.track_id, m));
    return map;
  }, [matches]);

  // Detect duplicate audio file assignments across tracks in this playlist
  const duplicateUsageMap = useMemo(() => {
    const countMap = new Map<string, string[]>(); // audio_file_id -> array of track titles
    matches.forEach((m) => {
      if (m.status !== 'rejected') {
        const track = tracks.find((t) => t.id === m.track_id);
        const title = track?.title || 'Unknown Track';
        const list = countMap.get(m.audio_file_id) || [];
        list.push(title);
        countMap.set(m.audio_file_id, list);
      }
    });
    return countMap;
  }, [matches, tracks]);

  // Build unified complete match items
  const matchItems = useMemo<CompleteTrackMatchItem[]>(() => {
    return tracks.map((track) => {
      const match = matchesMap.get(track.id);
      const audioFile = match ? audioFilesMap.get(match.audio_file_id) : undefined;

      let scoreResult = undefined;
      if (audioFile) {
        scoreResult = MatchingEngine.evaluateMatch(track, audioFile);
      }

      const assignedTracks = audioFile ? duplicateUsageMap.get(audioFile.id) || [] : [];
      const isDuplicateAssignment = assignedTracks.length > 1;

      return {
        track,
        match,
        audioFile,
        score: scoreResult,
        isDuplicateAssignment,
        duplicateTrackTitles: assignedTracks,
      };
    });
  }, [tracks, matchesMap, audioFilesMap, duplicateUsageMap]);

  // Calculate Match Studio statistics
  const stats = useMemo<MatchStudioStats>(() => {
    const totalTracks = tracks.length;
    let confirmedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;
    let duplicateAssignmentsCount = 0;

    matchItems.forEach((item) => {
      if (item.match) {
        if (item.match.status === 'confirmed') confirmedCount++;
        else if (item.match.status === 'pending') pendingCount++;
        else if (item.match.status === 'rejected') rejectedCount++;
      }
      if (item.isDuplicateAssignment) duplicateAssignmentsCount++;
    });

    const activeMatches = confirmedCount + pendingCount;
    const unmatchedCount = totalTracks - (activeMatches + rejectedCount);
    const matchPercentage = totalTracks > 0 ? Math.round((activeMatches / totalTracks) * 100) : 0;

    return {
      totalTracks,
      confirmedCount,
      pendingCount,
      unmatchedCount: Math.max(0, unmatchedCount),
      rejectedCount,
      duplicateAssignmentsCount,
      matchPercentage,
    };
  }, [tracks.length, matchItems]);

  // Run Automated Matching Algorithm
  const runAutoMatch = useCallback(async () => {
    if (!selectedPlaylistId || tracks.length === 0 || audioFiles.length === 0) return;

    setIsMatching(true);
    try {
      const candidateMap = MatchingEngine.matchPlaylist(tracks, audioFiles, 50);
      const newMatches: TrackMatch[] = [];
      const now = new Date().toISOString();

      candidateMap.forEach((candidate, trackId) => {
        // Only auto-match tracks that don't already have a confirmed match
        const existing = matchesMap.get(trackId);
        if (existing && existing.status === 'confirmed') return;

        const isExact = candidate.score.classification === 'exact';
        const match: TrackMatch = {
          id: existing?.id || `match-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          user_id: userId,
          playlist_id: selectedPlaylistId,
          track_id: trackId,
          audio_file_id: candidate.audioFile.id,
          match_type: 'auto',
          confidence_score: candidate.score.confidenceScore,
          status: isExact ? 'confirmed' : 'pending',
          matched_at: now,
          notes: candidate.score.breakdown.map((b) => b.description).join('; '),
        };
        newMatches.push(match);
      });

      if (newMatches.length > 0) {
        await MatchRepository.saveBatchMatches(newMatches);
        await loadPlaylistTracksAndMatches();
      }
    } catch (err) {
      console.error('[PlaylistVault] Auto-match failed:', err);
    } finally {
      setIsMatching(false);
    }
  }, [selectedPlaylistId, tracks, audioFiles, matchesMap, userId, loadPlaylistTracksAndMatches]);

  // Manual Match Pairing
  const manualPair = useCallback(
    async (trackId: string, audioFileId: string) => {
      if (!selectedPlaylistId) return;

      const track = tracks.find((t) => t.id === trackId);
      const audioFile = audioFiles.find((f) => f.id === audioFileId);
      if (!track || !audioFile) return;

      const score = MatchingEngine.evaluateMatch(track, audioFile);
      const existing = matchesMap.get(trackId);

      const match: TrackMatch = {
        id: existing?.id || `match-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        user_id: userId,
        playlist_id: selectedPlaylistId,
        track_id: trackId,
        audio_file_id: audioFileId,
        match_type: 'manual',
        confidence_score: score.confidenceScore,
        status: 'confirmed',
        matched_at: new Date().toISOString(),
        notes: `Manually confirmed. ${score.breakdown.map((b) => b.description).join('; ')}`,
      };

      await MatchRepository.saveMatch(match);
      await loadPlaylistTracksAndMatches();
    },
    [selectedPlaylistId, tracks, audioFiles, matchesMap, userId, loadPlaylistTracksAndMatches]
  );

  // Confirm match
  const confirmMatch = useCallback(
    async (trackId: string) => {
      if (!selectedPlaylistId) return;
      await MatchRepository.updateMatchStatus(selectedPlaylistId, trackId, 'confirmed');
      await loadPlaylistTracksAndMatches();
    },
    [selectedPlaylistId, loadPlaylistTracksAndMatches]
  );

  // Reject match
  const rejectMatch = useCallback(
    async (trackId: string) => {
      if (!selectedPlaylistId) return;
      await MatchRepository.updateMatchStatus(selectedPlaylistId, trackId, 'rejected');
      await loadPlaylistTracksAndMatches();
    },
    [selectedPlaylistId, loadPlaylistTracksAndMatches]
  );

  // Unmatch track
  const unmatch = useCallback(
    async (trackId: string) => {
      if (!selectedPlaylistId) return;
      await MatchRepository.unmatchTrack(selectedPlaylistId, trackId);
      await loadPlaylistTracksAndMatches();
    },
    [selectedPlaylistId, loadPlaylistTracksAndMatches]
  );

  // Bulk confirm high confidence matches (score >= 80)
  const bulkConfirmHighConfidence = useCallback(async () => {
    if (!selectedPlaylistId) return;

    const pendingHigh = matchItems.filter(
      (item) => item.match && item.match.status === 'pending' && item.match.confidence_score >= 80
    );

    const updates = pendingHigh.map((item) => ({
      ...item.match!,
      status: 'confirmed' as const,
      matched_at: new Date().toISOString(),
    }));

    if (updates.length > 0) {
      await MatchRepository.saveBatchMatches(updates);
      await loadPlaylistTracksAndMatches();
    }
  }, [selectedPlaylistId, matchItems, loadPlaylistTracksAndMatches]);

  // Reset all matches for this playlist
  const resetMatches = useCallback(async () => {
    if (!selectedPlaylistId) return;
    await MatchRepository.clearPlaylistMatches(selectedPlaylistId);
    await loadPlaylistTracksAndMatches();
  }, [selectedPlaylistId, loadPlaylistTracksAndMatches]);

  const value = {
    availablePlaylists,
    selectedPlaylistId,
    setSelectedPlaylistId,
    activePlaylist,
    matchItems,
    stats,
    isMatching,
    runAutoMatch,
    manualPair,
    confirmMatch,
    rejectMatch,
    unmatch,
    bulkConfirmHighConfidence,
    resetMatches,
    refreshMatches: loadPlaylistTracksAndMatches,
  };

  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>;
}

export function useMatch() {
  const context = useContext(MatchContext);
  if (!context) {
    throw new Error('useMatch must be used within a MatchProvider');
  }
  return context;
}
