/**
 * Phase 4 — Intelligent Track Matching Types
 */

import { Track, TrackMatch } from '../../types';
import { StoredAudioFile } from '../audio/types';

export type MatchClassification =
  | 'exact' // 95 - 100%
  | 'high' // 80 - 94%
  | 'possible' // 50 - 79%
  | 'unmatched'; // 0 - 49%

export type MatchStatus = 'confirmed' | 'pending' | 'rejected';
export type MatchType = 'auto' | 'manual';

export interface ScoreBreakdownItem {
  category: 'title' | 'artist' | 'duration' | 'album' | 'isrc' | 'version_penalty' | 'manual_override';
  points: number; // e.g. +45, +30, -20
  description: string; // e.g. "Exact normalized title match", "Duration delta within 1.5s"
}

export interface MatchScoreResult {
  confidenceScore: number; // 0.0 - 100.0
  classification: MatchClassification;
  breakdown: ScoreBreakdownItem[];
  durationDeltaMs: number;
  durationDeltaSeconds: number;
  isVersionMismatch: boolean;
  notes?: string;
}

export interface TrackMatchCandidate {
  audioFile: StoredAudioFile;
  score: MatchScoreResult;
}

export interface CompleteTrackMatchItem {
  track: Track;
  match?: TrackMatch;
  audioFile?: StoredAudioFile;
  score?: MatchScoreResult;
  isDuplicateAssignment?: boolean;
  duplicateTrackTitles?: string[];
}

export interface MatchStudioStats {
  totalTracks: number;
  confirmedCount: number;
  pendingCount: number;
  unmatchedCount: number;
  rejectedCount: number;
  duplicateAssignmentsCount: number;
  matchPercentage: number;
}
