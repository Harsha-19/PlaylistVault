import { PlaylistParseError } from './errors';

export interface PlaylistParseResult {
  success: boolean;
  playlistId?: string;
  error?: string;
}

const SPOTIFY_ID_REGEX = /^[0-9A-Za-z]{15,35}$/;
const VALID_HOSTNAMES = new Set(['open.spotify.com', 'play.spotify.com']);

/**
 * Validates and extracts a Spotify playlist ID from a URL, URI, or raw ID string.
 *
 * Supported formats:
 * - https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
 * - https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=123456
 * - spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
 * - 37i9dQZF1DXcBWIGoYBM5M (raw ID)
 */
export function parseSpotifyPlaylistUrl(input: string): PlaylistParseResult {
  if (!input || typeof input !== 'string') {
    return {
      success: false,
      error: 'Please enter a Spotify playlist link or playlist ID.',
    };
  }

  const trimmed = input.trim();

  if (!trimmed) {
    return {
      success: false,
      error: 'Input cannot be empty.',
    };
  }

  // 1. Spotify URI format: spotify:playlist:PLAYLIST_ID
  if (trimmed.startsWith('spotify:')) {
    const parts = trimmed.split(':');
    if (parts.length === 3 && parts[1] === 'playlist') {
      const id = parts[2];
      if (SPOTIFY_ID_REGEX.test(id)) {
        return { success: true, playlistId: id };
      }
      return {
        success: false,
        error: `Invalid Spotify playlist ID in URI: "${id}". Expected 15-35 alphanumeric characters.`,
      };
    }
    return {
      success: false,
      error: `Invalid Spotify URI resource. Expected "spotify:playlist:<id>", got "${trimmed}".`,
    };
  }

  // 2. HTTP/HTTPS URL format
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');

      if (!VALID_HOSTNAMES.has(host)) {
        return {
          success: false,
          error: `Unrecognized hostname "${url.hostname}". Must be a valid "open.spotify.com" link.`,
        };
      }

      // Check pathname: /playlist/<id> or /user/<userId>/playlist/<id>
      const segments = url.pathname.split('/').filter(Boolean);

      let extractedId: string | null = null;

      if (segments.length >= 2 && segments[0] === 'playlist') {
        extractedId = segments[1];
      } else if (segments.length >= 4 && segments[0] === 'user' && segments[2] === 'playlist') {
        extractedId = segments[3];
      } else {
        const resourceType = segments[0] || 'unknown';
        return {
          success: false,
          error: `Not a Spotify playlist link. Detected resource type: "${resourceType}". Only playlists are supported.`,
        };
      }

      if (extractedId && SPOTIFY_ID_REGEX.test(extractedId)) {
        return { success: true, playlistId: extractedId };
      }

      return {
        success: false,
        error: `Malformed Spotify playlist ID "${extractedId || ''}" in URL.`,
      };
    } catch {
      return {
        success: false,
        error: 'Invalid URL format.',
      };
    }
  }

  // 3. Raw Playlist ID
  if (SPOTIFY_ID_REGEX.test(trimmed)) {
    return { success: true, playlistId: trimmed };
  }

  // Distinguish common mistakes
  if (trimmed.includes('/') || trimmed.includes('.') || trimmed.includes(':')) {
    return {
      success: false,
      error: 'Unrecognized Spotify playlist format. Please provide a full open.spotify.com playlist URL, a spotify:playlist: URI, or a valid alphanumeric playlist ID.',
    };
  }

  return {
    success: false,
    error: `Invalid playlist ID length or characters (${trimmed.length} chars). Expected 15-35 alphanumeric characters.`,
  };
}

/**
 * Throwing wrapper for parseSpotifyPlaylistUrl.
 */
export function extractSpotifyPlaylistId(input: string): string {
  const result = parseSpotifyPlaylistUrl(input);
  if (!result.success || !result.playlistId) {
    throw new PlaylistParseError(result.error || 'Failed to extract Spotify playlist ID.');
  }
  return result.playlistId;
}
