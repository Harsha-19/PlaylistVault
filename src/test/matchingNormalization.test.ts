import { describe, it, expect } from 'vitest';
import {
  cleanTitle,
  normalizeString,
  extractArtists,
  detectVersionTokens,
  checkVersionCompatibility,
} from '../lib/matching/normalization';

describe('Matching Normalization & Version Detection', () => {
  it('normalizes diacritics and case across international titles', () => {
    expect(normalizeString('Beyoncé')).toBe('beyonce');
    expect(normalizeString('Sigur Rós - Hoppípolla')).toBe('sigur ros - hoppipolla');
    expect(normalizeString('Mötley Crüe')).toBe('motley crue');
  });

  it('strips track prefixes, audio extensions, and noisy video suffixes from titles', () => {
    expect(cleanTitle('01 - Get Lucky.mp3')).toBe('get lucky');
    expect(cleanTitle('02. Blinding Lights (Official Music Video)')).toBe('blinding lights');
    expect(cleanTitle('03_Starboy [Lyric Video].flac')).toBe('starboy');
    expect(cleanTitle('One More Time (Official Audio) [HD]')).toBe('one more time');
  });

  it('extracts multiple artists from diverse separator conventions', () => {
    const artists1 = extractArtists('David Guetta feat. Sia');
    expect(artists1).toContain('david guetta');
    expect(artists1).toContain('sia');

    const artists2 = extractArtists('Calvin Harris & Dua Lipa');
    expect(artists2).toContain('calvin harris');
    expect(artists2).toContain('dua lipa');

    const artists3 = extractArtists('Daft Punk, Pharrell Williams, Nile Rodgers');
    expect(artists3).toHaveLength(3);
  });

  it('detects version tokens accurately in song titles', () => {
    const tokensLive = detectVersionTokens('Hotel California (Live at the Forum 1976)');
    expect(tokensLive.has('live')).toBe(true);
    expect(tokensLive.has('acoustic')).toBe(false);

    const tokensRemix = detectVersionTokens('Levitating - Don Diablo Remix');
    expect(tokensRemix.has('remix')).toBe(true);

    const tokensAcoustic = detectVersionTokens('Layla - Acoustic Version');
    expect(tokensAcoustic.has('acoustic')).toBe(true);
  });

  it('flags severe version conflicts between incompatible versions', () => {
    // Acoustic vs Remix conflict
    const acousticVsRemix = checkVersionCompatibility('Layla (Acoustic)', 'Layla (Steve Aoki Remix)');
    expect(acousticVsRemix.isCompatible).toBe(false);
    expect(acousticVsRemix.mismatchPenalty).toBeGreaterThanOrEqual(30);

    // Live vs Studio conflict
    const liveVsStudio = checkVersionCompatibility('Comfortably Numb (Live in Pompeii)', 'Comfortably Numb');
    expect(liveVsStudio.isCompatible).toBe(false);
    expect(liveVsStudio.mismatchPenalty).toBeGreaterThanOrEqual(20);

    // Compatible matching
    const compatible = checkVersionCompatibility('Get Lucky', 'Get Lucky');
    expect(compatible.isCompatible).toBe(true);
    expect(compatible.mismatchPenalty).toBe(0);
  });
});
