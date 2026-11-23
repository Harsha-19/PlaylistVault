import { getSpotifySession, clearSpotifySession } from './auth';
import { SpotifyApiError, SpotifyAuthError, RateLimitError } from './errors';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export interface SpotifyFetchOptions extends RequestInit {
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Executes an authenticated request to the Spotify Web API with error handling,
 * token verification, and bounded rate-limit retry support.
 */
export async function spotifyFetch<T>(
  endpoint: string,
  options: SpotifyFetchOptions = {}
): Promise<T> {
  const session = await getSpotifySession();
  if (!session || !session.accessToken) {
    throw new SpotifyAuthError(
      'Spotify authentication required. Please connect your Spotify account in Settings or during import.',
      'not_authenticated'
    );
  }

  const url = endpoint.startsWith('http') ? endpoint : `${SPOTIFY_API_BASE}${endpoint}`;
  const retryCount = options.retryCount || 0;
  const maxRetries = options.maxRetries ?? 2;

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${session.accessToken}`);
  headers.set('Accept', 'application/json');

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new SpotifyApiError(
      `Network failure connecting to Spotify API: ${err instanceof Error ? err.message : 'Unknown error'}`,
      0
    );
  }

  // Handle Rate Limiting (HTTP 429)
  if (response.status === 429) {
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 5;

    // Retry if within reasonable bounded wait time (< 5 seconds) and under max retries
    if (retryAfterSeconds <= 5 && retryCount < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
      return spotifyFetch<T>(endpoint, {
        ...options,
        retryCount: retryCount + 1,
      });
    }

    throw new RateLimitError(retryAfterSeconds);
  }

  // Handle Token Expiration (HTTP 401)
  if (response.status === 401) {
    clearSpotifySession();
    throw new SpotifyAuthError('Spotify access token expired or revoked. Please re-authenticate.', 'token_expired');
  }

  // Handle Permissions / Forbidden (HTTP 403)
  if (response.status === 403) {
    throw new SpotifyApiError(
      'Insufficient Spotify permissions or restricted playlist access. Ensure you have access to this playlist.',
      403
    );
  }

  // Handle Not Found (HTTP 404)
  if (response.status === 404) {
    throw new SpotifyApiError(
      'Spotify playlist or resource not found. Verify the playlist ID and ensure it is public or shared with you.',
      404
    );
  }

  // Handle Other HTTP Errors (400, 5xx)
  if (!response.ok) {
    let errorMessage = `Spotify API returned error HTTP ${response.status}.`;
    try {
      const errorJson = await response.json();
      if (errorJson.error?.message) {
        errorMessage = errorJson.error.message;
      }
    } catch {
      // Keep status code message
    }
    throw new SpotifyApiError(errorMessage, response.status);
  }

  return response.json();
}
