/**
 * Phase 4 — Intelligent Track Matching Scoring Engine
 * 
 * Computes multi-factor match confidence scores with fully explainable breakdown reasons,
 * version compatibility verification, and conflict detection.
 */

import { Track } from '../../types';
import { StoredAudioFile } from '../audio/types';
import { checkVersionCompatibility, cleanTitle } from './normalization';
import {
  computeTitleSimilarity,
  computeArtistSimilarity,
  computeDurationSimilarity,
} from './similarity';
import { MatchScoreResult, ScoreBreakdownItem, TrackMatchCandidate } from './types';

export class MatchingEngine {
  /**
   * Computes an explainable match score between a Spotify track and a local audio file.
   */
  static evaluateMatch(track: Track, audioFile: StoredAudioFile): MatchScoreResult {
    const breakdown: ScoreBreakdownItem[] = [];
    let totalScore = 0;

    // 1. Title Similarity (Max: 45 pts)
    const titleSim = computeTitleSimilarity(track.title, audioFile.title);
    const titlePoints = parseFloat((titleSim * 45).toFixed(1));
    totalScore += titlePoints;

    if (titleSim >= 0.98) {
      breakdown.push({
        category: 'title',
        points: titlePoints,
        description: `Exact title match: "${audioFile.title}" (+${titlePoints}%)`,
      });
    } else if (titleSim >= 0.8) {
      breakdown.push({
        category: 'title',
        points: titlePoints,
        description: `High title similarity: ${Math.round(titleSim * 100)}% (+${titlePoints}%)`,
      });
    } else if (titlePoints > 0) {
      breakdown.push({
        category: 'title',
        points: titlePoints,
        description: `Partial title match: ${Math.round(titleSim * 100)}% (+${titlePoints}%)`,
      });
    }

    // Also check if filename has strong title match if tags were empty
    if (titleSim < 0.8 && audioFile.filename) {
      const filenameSim = computeTitleSimilarity(track.title, audioFile.filename);
      if (filenameSim > titleSim) {
        const bonus = parseFloat(((filenameSim - titleSim) * 20).toFixed(1));
        totalScore += bonus;
        breakdown.push({
          category: 'title',
          points: bonus,
          description: `Filename bonus match: "${audioFile.filename}" (+${bonus}%)`,
        });
      }
    }

    // 2. Artist Similarity (Max: 30 pts)
    const artistSim = computeArtistSimilarity(track.artist, audioFile.artist);
    const artistPoints = parseFloat((artistSim * 30).toFixed(1));
    totalScore += artistPoints;

    if (artistSim >= 0.98) {
      breakdown.push({
        category: 'artist',
        points: artistPoints,
        description: `Exact artist match: "${audioFile.artist}" (+${artistPoints}%)`,
      });
    } else if (artistSim >= 0.8) {
      breakdown.push({
        category: 'artist',
        points: artistPoints,
        description: `Artist token match: "${audioFile.artist}" (+${artistPoints}%)`,
      });
    } else if (artistPoints > 0) {
      breakdown.push({
        category: 'artist',
        points: artistPoints,
        description: `Partial artist similarity: ${Math.round(artistSim * 100)}% (+${artistPoints}%)`,
      });
    }

    // 3. Duration Compatibility (Max: 20 pts)
    const { score: durationSim, deltaMs, deltaSeconds } = computeDurationSimilarity(
      track.duration_ms,
      audioFile.duration_ms
    );
    const durationPoints = parseFloat((durationSim * 20).toFixed(1));
    totalScore += durationPoints;

    if (deltaSeconds <= 2.0 && track.duration_ms > 0 && audioFile.duration_ms > 0) {
      breakdown.push({
        category: 'duration',
        points: durationPoints,
        description: `Precise duration match (delta: ${deltaSeconds}s) (+${durationPoints}%)`,
      });
    } else if (deltaSeconds <= 10.0 && track.duration_ms > 0 && audioFile.duration_ms > 0) {
      breakdown.push({
        category: 'duration',
        points: durationPoints,
        description: `Close duration match (delta: ${deltaSeconds}s) (+${durationPoints}%)`,
      });
    } else if (deltaSeconds > 45.0 && track.duration_ms > 0 && audioFile.duration_ms > 0) {
      // Significant duration disparity penalty
      const penalty = -25;
      totalScore += penalty;
      breakdown.push({
        category: 'duration',
        points: penalty,
        description: `Major duration mismatch: delta is ${deltaSeconds}s (${penalty}%)`,
      });
    }

    // 4. Album Similarity (Max: 5 pts)
    if (track.album && audioFile.album && audioFile.album !== 'Unknown Album') {
      const albumA = cleanTitle(track.album);
      const albumB = cleanTitle(audioFile.album);
      if (albumA === albumB) {
        totalScore += 5;
        breakdown.push({
          category: 'album',
          points: 5,
          description: `Exact album match: "${audioFile.album}" (+5%)`,
        });
      } else if (albumA.includes(albumB) || albumB.includes(albumA)) {
        totalScore += 3;
        breakdown.push({
          category: 'album',
          points: 3,
          description: `Album name overlap (+3%)`,
        });
      }
    }

    // 5. Version Compatibility Check (Penalties if mismatched)
    const versionCheck = checkVersionCompatibility(track.title, audioFile.title);
    if (!versionCheck.isCompatible && versionCheck.mismatchPenalty > 0) {
      const penalty = -versionCheck.mismatchPenalty;
      totalScore += penalty;
      breakdown.push({
        category: 'version_penalty',
        points: penalty,
        description: `${versionCheck.reason || 'Version conflict'} (${penalty}%)`,
      });
    }

    // Clamp score between 0.0 and 100.0
    const finalScore = parseFloat(Math.min(100, Math.max(0, totalScore)).toFixed(1));

    // Classification
    let classification: 'exact' | 'high' | 'possible' | 'unmatched';
    if (finalScore >= 95) {
      classification = 'exact';
    } else if (finalScore >= 80) {
      classification = 'high';
    } else if (finalScore >= 50) {
      classification = 'possible';
    } else {
      classification = 'unmatched';
    }

    return {
      confidenceScore: finalScore,
      classification,
      breakdown,
      durationDeltaMs: deltaMs,
      durationDeltaSeconds: deltaSeconds,
      isVersionMismatch: !versionCheck.isCompatible,
      notes: versionCheck.reason,
    };
  }

  /**
   * Finds the best candidate match for a single track from a pool of local audio files.
   */
  static findBestCandidate(
    track: Track,
    audioFiles: StoredAudioFile[],
    minimumThreshold = 50
  ): TrackMatchCandidate | null {
    if (!audioFiles || audioFiles.length === 0) return null;

    let bestCandidate: TrackMatchCandidate | null = null;

    for (const audioFile of audioFiles) {
      const score = this.evaluateMatch(track, audioFile);

      if (score.confidenceScore >= minimumThreshold) {
        if (!bestCandidate || score.confidenceScore > bestCandidate.score.confidenceScore) {
          bestCandidate = { audioFile, score };
        }
      }
    }

    return bestCandidate;
  }

  /**
   * Ranks all audio files as potential candidates for a track, sorted from highest score to lowest.
   */
  static rankAllCandidates(track: Track, audioFiles: StoredAudioFile[]): TrackMatchCandidate[] {
    return audioFiles
      .map((audioFile) => ({
        audioFile,
        score: this.evaluateMatch(track, audioFile),
      }))
      .sort((a, b) => b.score.confidenceScore - a.score.confidenceScore);
  }

  /**
   * Performs automated batch matching across an entire playlist.
   */
  static matchPlaylist(
    tracks: Track[],
    audioFiles: StoredAudioFile[],
    threshold = 50
  ): Map<string, TrackMatchCandidate> {
    const results = new Map<string, TrackMatchCandidate>();

    // Sort tracks to match highest confidence items first
    for (const track of tracks) {
      const best = this.findBestCandidate(track, audioFiles, threshold);
      if (best) {
        results.set(track.id, best);
      }
    }

    return results;
  }
}
