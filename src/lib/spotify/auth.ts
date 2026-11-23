import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateRandomState,
  storePkceSession,
  validateAndRetrievePkce,
} from './pkce';
import { SpotifySession, SpotifyTokenResponse, SpotifyUser } from './types';
import { SpotifyAuthError } from './errors';

const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

const SESSION_KEY = 'pv_spotify_session';
const CUSTOM_CLIENT_ID_KEY = 'pv_custom_spotify_client_id';

const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-private',
  'user-read-email',
].join(' ');

/**
 * Retrieves the configured Spotify Client ID from environment or user settings.
 */
export function getSpotifyClientId(): string {
  const custom = typeof window !== 'undefined' ? localStorage.getItem(CUSTOM_CLIENT_ID_KEY) : null;
  const envId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
  const finalId = (custom || envId).trim();

  if (finalId.includes('placeholder')) {
    return '';
  }
  return finalId;
}

/**
 * Returns the current redirect URI for the OAuth callback.
 * Prioritizes VITE_SPOTIFY_REDIRECT_URI if explicitly configured,
 * otherwise derives the callback URI dynamically from window.location.origin.
 */
export function getSpotifyRedirectUri(): string {
  const envRedirect = import.meta.env.VITE_SPOTIFY_REDIRECT_URI?.trim();
  if (envRedirect && !envRedirect.includes('placeholder')) {
    return envRedirect;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/callback`;
  }
  return 'http://localhost:5173/callback';
}

/**
 * Builds the Spotify Authorization Code with PKCE URL and prepares session storage.
 */
export async function buildAuthorizeUrl(returnPath = '/playlists'): Promise<string> {
  const clientId = getSpotifyClientId();
  if (!clientId) {
    throw new SpotifyAuthError(
      'Spotify Client ID is not configured. Please add your Client ID in Settings.',
      'missing_client_id'
    );
  }

  const verifier = generateCodeVerifier(64);
  const challenge = await generateCodeChallenge(verifier);
  const state = generateRandomState(32);
  const redirectUri = getSpotifyRedirectUri();

  storePkceSession(state, verifier, returnPath);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
    scope: SPOTIFY_SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  return `${SPOTIFY_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Handles the OAuth callback: validates state, retrieves PKCE verifier, and exchanges code for tokens.
 */
export async function handleAuthCallback(
  code: string,
  state: string
): Promise<{ session: SpotifySession; returnPath: string }> {
  const { codeVerifier, returnPath } = validateAndRetrievePkce(state);
  const clientId = getSpotifyClientId();
  const redirectUri = getSpotifyRedirectUri();

  if (!clientId) {
    throw new SpotifyAuthError('Spotify Client ID not configured during token exchange.');
  }

  const bodyParams = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDesc = 'Failed to exchange authorization code for tokens.';
    try {
      const parsed = JSON.parse(errorText);
      errorDesc = parsed.error_description || parsed.error || errorDesc;
    } catch {
      // Keep fallback
    }
    throw new SpotifyAuthError(errorDesc, 'token_exchange_failed');
  }

  const tokenData: SpotifyTokenResponse = await response.json();
  const expiresAt = Date.now() + tokenData.expires_in * 1000;

  // Fetch current user details
  let user: SpotifyUser | undefined;
  try {
    user = await fetchSpotifyCurrentUser(tokenData.access_token);
  } catch (err) {
    console.warn('Could not fetch Spotify user profile:', err);
  }

  const session: SpotifySession = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt,
    scope: tokenData.scope,
    user,
  };

  saveSpotifySession(session);
  return { session, returnPath };
}

/**
 * Refreshes an expired access token using the stored refresh token.
 */
export async function refreshSpotifyToken(
  refreshToken: string
): Promise<SpotifyTokenResponse> {
  const clientId = getSpotifyClientId();
  if (!clientId) {
    throw new SpotifyAuthError('Spotify Client ID is required to refresh token.');
  }

  const bodyParams = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    throw new SpotifyAuthError('Token refresh failed. Re-authorization required.', 'refresh_failed');
  }

  const data: SpotifyTokenResponse = await response.json();
  return data;
}

/**
 * Fetches the authenticated user's Spotify profile.
 */
export async function fetchSpotifyCurrentUser(accessToken: string): Promise<SpotifyUser> {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new SpotifyAuthError('Failed to fetch user profile from Spotify API.');
  }

  return response.json();
}

/**
 * Saves the active Spotify session in sessionStorage (isolated per browser session).
 */
export function saveSpotifySession(session: SpotifySession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('Failed to save Spotify session:', err);
  }
}

/**
 * Retrieves the active Spotify session from sessionStorage, refreshing if nearing expiration.
 */
export async function getSpotifySession(): Promise<SpotifySession | null> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const session: SpotifySession = JSON.parse(raw);
    const now = Date.now();

    // Check if token expires within the next 60 seconds
    const isExpiringSoon = session.expiresAt - now < 60 * 1000;

    if (isExpiringSoon && session.refreshToken) {
      try {
        const refreshed = await refreshSpotifyToken(session.refreshToken);
        const updatedSession: SpotifySession = {
          ...session,
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token || session.refreshToken,
          expiresAt: Date.now() + refreshed.expires_in * 1000,
        };
        saveSpotifySession(updatedSession);
        return updatedSession;
      } catch (err) {
        console.warn('Silent token refresh failed:', err);
        clearSpotifySession();
        return null;
      }
    }

    // Token is expired and cannot be refreshed
    if (now >= session.expiresAt && !session.refreshToken) {
      clearSpotifySession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Clears stored Spotify session credentials.
 */
export function clearSpotifySession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (err) {
    console.error('Failed to clear Spotify session:', err);
  }
}
