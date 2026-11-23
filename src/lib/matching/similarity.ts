/**
 * Phase 4 — Similarity Algorithms (Levenshtein, Jaro-Winkler, Token Set)
 */

import { extractArtists, cleanTitle } from './normalization';

/**
 * Computes standard Levenshtein distance between two strings.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Normalized Levenshtein similarity ratio between 0.0 and 1.0.
 */
export function levenshteinRatio(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Computes Jaccard similarity across word tokens (Token Set Ratio).
 */
export function tokenSetRatio(s1: string, s2: string): number {
  if (!s1 || !s2) return 0.0;

  const tokens1 = new Set(s1.split(/\s+/).filter(Boolean));
  const tokens2 = new Set(s2.split(/\s+/).filter(Boolean));

  if (tokens1.size === 0 && tokens2.size === 0) return 1.0;
  if (tokens1.size === 0 || tokens2.size === 0) return 0.0;

  let intersectionCount = 0;
  tokens1.forEach((t) => {
    if (tokens2.has(t)) intersectionCount++;
  });

  const unionSize = new Set([...tokens1, ...tokens2]).size;
  return intersectionCount / unionSize;
}

/**
 * Jaro-Winkler Similarity algorithm between 0.0 and 1.0.
 * Favors common prefixes.
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const m = s1.length;
  const n = s2.length;
  const matchDistance = Math.floor(Math.max(m, n) / 2) - 1;

  const s1Matches = new Array(m).fill(false);
  const s2Matches = new Array(n).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < m; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, n);

    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < m; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / m + matches / n + (matches - transpositions / 2) / matches) / 3;

  // Winkler prefix scale (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(m, n)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Combined high-precision title similarity score (0.0 to 1.0).
 */
export function computeTitleSimilarity(titleA: string, titleB: string): number {
  const cleanA = cleanTitle(titleA);
  const cleanB = cleanTitle(titleB);

  if (cleanA === cleanB) return 1.0;
  if (!cleanA || !cleanB) return 0.0;

  // If one title is a clean substring of the other (e.g. "Numb" in "Numb Encore")
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
    const minLen = Math.min(cleanA.length, cleanB.length);
    const maxLen = Math.max(cleanA.length, cleanB.length);
    if (minLen / maxLen > 0.7) {
      return 0.95;
    }
  }

  const levRatio = levenshteinRatio(cleanA, cleanB);
  const tokenRatio = tokenSetRatio(cleanA, cleanB);
  const jwRatio = jaroWinklerSimilarity(cleanA, cleanB);

  return levRatio * 0.4 + tokenRatio * 0.35 + jwRatio * 0.25;
}

/**
 * Computes artist similarity score (0.0 to 1.0) using artist token sets.
 */
export function computeArtistSimilarity(artistA: string, artistB: string): number {
  const artistsA = extractArtists(artistA);
  const artistsB = extractArtists(artistB);

  if (artistsA.length === 0 || artistsB.length === 0) return 0.0;

  // Check if primary artist matches exactly
  if (artistsA[0] === artistsB[0]) {
    return 1.0;
  }

  // Check if any artist in A matches any artist in B
  let matchCount = 0;
  for (const a of artistsA) {
    if (artistsB.some((b) => b === a || b.includes(a) || a.includes(b))) {
      matchCount++;
    }
  }

  if (matchCount > 0) {
    // If at least one main artist matches
    return 0.85 + 0.15 * (matchCount / Math.max(artistsA.length, artistsB.length));
  }

  // Fallback to fuzzy similarity between artist strings
  const cleanA = cleanTitle(artistA);
  const cleanB = cleanTitle(artistB);
  return jaroWinklerSimilarity(cleanA, cleanB);
}

/**
 * Computes duration similarity score (0.0 to 1.0) based on millisecond difference.
 */
export function computeDurationSimilarity(durationA: number, durationB: number): {
  score: number;
  deltaMs: number;
  deltaSeconds: number;
} {
  const deltaMs = Math.abs(durationA - durationB);
  const deltaSeconds = parseFloat((deltaMs / 1000).toFixed(1));

  if (durationA === 0 || durationB === 0) {
    // Duration missing or unknown
    return { score: 0.5, deltaMs, deltaSeconds };
  }

  if (deltaMs <= 2000) {
    return { score: 1.0, deltaMs, deltaSeconds }; // Within 2 seconds: perfect match
  }
  if (deltaMs <= 5000) {
    return { score: 0.85, deltaMs, deltaSeconds }; // Within 5 seconds
  }
  if (deltaMs <= 10000) {
    return { score: 0.65, deltaMs, deltaSeconds }; // Within 10 seconds
  }
  if (deltaMs <= 20000) {
    return { score: 0.4, deltaMs, deltaSeconds }; // Within 20 seconds
  }
  if (deltaMs <= 35000) {
    return { score: 0.15, deltaMs, deltaSeconds }; // Within 35 seconds
  }

  return { score: 0.0, deltaMs, deltaSeconds }; // Over 35 seconds difference
}
