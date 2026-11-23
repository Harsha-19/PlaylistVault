/**
 * Phase 4 — Audio String Normalization & Version Token Detection
 */

export const VERSION_TOKENS = [
  'remix',
  'live',
  'acoustic',
  'unplugged',
  'instrumental',
  'karaoke',
  'remaster',
  'remastered',
  'extended',
  'radio edit',
  'deluxe',
  'club mix',
  'cover',
  'demo',
  'orchestral',
  'slowed',
  'reverb',
] as const;

export type VersionToken = (typeof VERSION_TOKENS)[number];

const NOISE_PATTERNS = [
  /\b(official\s+(audio|video|music\s+video|lyric\s+video|visualizer))\b/gi,
  /\b(lyric\s+video|music\s+video|visualizer|video)\b/gi,
  /\b(lyrics?|hd|4k|hq|audio)\b/gi,
  /\b(feat\.|ft\.|featuring)\b[^\)\]]+/gi,
];

/**
 * Normalizes a string by converting to lowercase, decomposing Unicode diacritics,
 * and stripping non-alphanumeric noise.
 */
export function normalizeString(str: string): string {
  if (!str) return '';

  return str
    .normalize('NFKD') // Decompose accented characters (e.g. é -> e)
    .replace(/[\u0300-\u036f]/g, '') // Strip diacritic marks
    .toLowerCase()
    .trim();
}

/**
 * Cleans track title by stripping noise words, common video suffixes, and track prefixes.
 */
export function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return '';

  let cleaned = normalizeString(rawTitle);

  // Strip leading track numbers (e.g., "01 - ", "01. ", "01_")
  cleaned = cleaned.replace(/^(\d{1,3}[\s._-]+)/g, '');

  // Strip audio file extensions if present
  cleaned = cleaned.replace(/\.(mp3|flac|wav|m4a|aac|ogg|opus|aiff?)$/i, '');

  // Strip common noisy tags inside brackets or parentheses
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  // Remove leftover punctuation and extra whitespace
  cleaned = cleaned.replace(/[\(\)\[\]\{\}\-_,."':;!?\/\\|]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Normalizes artist string and extracts individual artist names.
 * Splits by comma, slash, ampersand, 'feat.', 'ft.', 'vs.', 'x'.
 */
export function extractArtists(rawArtist: string): string[] {
  if (!rawArtist) return [];

  const normalized = normalizeString(rawArtist);

  const tokens = normalized
    .split(/[,/&x]|(?:\s+(?:feat\.|ft\.|featuring|with|vs\.)\s+)/gi)
    .map((a) => a.replace(/[\(\)\[\]]/g, '').trim())
    .filter((a) => a.length > 0);

  return Array.from(new Set(tokens));
}

/**
 * Identifies version tags (e.g. "Live", "Acoustic", "Remix", "Remastered") in a title or text.
 */
export function detectVersionTokens(text: string): Set<VersionToken> {
  const found = new Set<VersionToken>();
  if (!text) return found;

  const normalized = normalizeString(text);

  for (const token of VERSION_TOKENS) {
    const regex = new RegExp(`\\b${token}\\b`, 'i');
    if (regex.test(normalized)) {
      found.add(token);
    }
  }

  return found;
}

/**
 * Checks whether two tracks have compatible version types.
 * For example:
 * - One is "Live" and the other is not -> mismatch.
 * - One is "Acoustic" and the other is "Remix" -> severe mismatch.
 * - Both are "Remastered" or both have no special version -> compatible.
 */
export function checkVersionCompatibility(
  titleA: string,
  titleB: string
): { isCompatible: boolean; mismatchPenalty: number; reason?: string } {
  const versionsA = detectVersionTokens(titleA);
  const versionsB = detectVersionTokens(titleB);

  // If neither has version tokens, they are completely compatible
  if (versionsA.size === 0 && versionsB.size === 0) {
    return { isCompatible: true, mismatchPenalty: 0 };
  }

  // Check if version tags are identical
  const allTokens = new Set([...versionsA, ...versionsB]);
  let isIdentical = true;
  for (const token of allTokens) {
    if (!versionsA.has(token) || !versionsB.has(token)) {
      isIdentical = false;
      break;
    }
  }

  if (isIdentical) {
    return { isCompatible: true, mismatchPenalty: 0 };
  }

  // Differentiate minor mismatches (e.g. "remastered" vs none) from major (e.g. "live" vs studio, or "acoustic" vs "remix")
  const isAcousticVsRemix =
    (versionsA.has('acoustic') && versionsB.has('remix')) ||
    (versionsA.has('remix') && versionsB.has('acoustic'));

  if (isAcousticVsRemix) {
    return {
      isCompatible: false,
      mismatchPenalty: 35,
      reason: 'Conflict: Acoustic version vs Remix',
    };
  }

  const isLiveVsStudio = versionsA.has('live') !== versionsB.has('live');
  if (isLiveVsStudio) {
    return {
      isCompatible: false,
      mismatchPenalty: 25,
      reason: 'Conflict: Live recording vs Studio track',
    };
  }

  const isInstrumentalVsVocal = versionsA.has('instrumental') !== versionsB.has('instrumental');
  if (isInstrumentalVsVocal) {
    return {
      isCompatible: false,
      mismatchPenalty: 30,
      reason: 'Conflict: Instrumental vs Vocal track',
    };
  }

  // Minor version difference (e.g. "Remastered" vs none)
  return {
    isCompatible: true,
    mismatchPenalty: 5,
    reason: 'Notice: Slight version tag variance',
  };
}
