import { SpotifyAuthError } from './errors';

const PKCE_CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

const STORAGE_KEYS = {
  STATE: 'pv_spotify_pkce_state',
  VERIFIER: 'pv_spotify_pkce_verifier',
  REDIRECT_PATH: 'pv_spotify_redirect_path',
};

/**
 * Base64URL encoding (RFC 4648 § 5) without padding
 */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generates a high-entropy cryptographically secure PKCE code verifier (RFC 7636).
 * Length must be between 43 and 128 characters.
 */
export function generateCodeVerifier(length = 64): string {
  if (length < 43 || length > 128) {
    throw new Error('PKCE Code Verifier length must be between 43 and 128 characters.');
  }

  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || !cryptoObj.getRandomValues) {
    throw new Error('Web Cryptography API is not available.');
  }

  const randomValues = new Uint8Array(length);
  cryptoObj.getRandomValues(randomValues);

  let verifier = '';
  for (let i = 0; i < length; i++) {
    verifier += PKCE_CHARSET[randomValues[i] % PKCE_CHARSET.length];
  }
  return verifier;
}

/**
 * Generates the SHA-256 PKCE code challenge from a code verifier.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle) {
    throw new Error('SubtleCrypto is not available in this environment.');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await cryptoObj.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Generates a random cryptographic state string for OAuth CSRF protection.
 */
export function generateRandomState(length = 32): string {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || !cryptoObj.getRandomValues) {
    throw new Error('Web Cryptography API is not available.');
  }

  const randomValues = new Uint8Array(length);
  cryptoObj.getRandomValues(randomValues);

  let state = '';
  const stateCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    state += stateCharset[randomValues[i] % stateCharset.length];
  }
  return state;
}

/**
 * Stores PKCE state and verifier in sessionStorage before navigating to Spotify authorization.
 */
export function storePkceSession(
  state: string,
  verifier: string,
  returnPath: string = '/playlists'
): void {
  try {
    sessionStorage.setItem(STORAGE_KEYS.STATE, state);
    sessionStorage.setItem(STORAGE_KEYS.VERIFIER, verifier);
    sessionStorage.setItem(STORAGE_KEYS.REDIRECT_PATH, returnPath);
  } catch (err) {
    console.error('Failed to store PKCE credentials in sessionStorage:', err);
    throw new SpotifyAuthError('Failed to initialize OAuth session storage.');
  }
}

/**
 * Validates the state returned in OAuth callback and retrieves the saved code verifier.
 * Clears the stored values on retrieval to prevent replay attacks.
 */
export function validateAndRetrievePkce(incomingState: string): {
  codeVerifier: string;
  returnPath: string;
} {
  try {
    const savedState = sessionStorage.getItem(STORAGE_KEYS.STATE);
    const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.VERIFIER);
    const returnPath = sessionStorage.getItem(STORAGE_KEYS.REDIRECT_PATH) || '/playlists';

    // Clear saved session parameters immediately to prevent reuse
    sessionStorage.removeItem(STORAGE_KEYS.STATE);
    sessionStorage.removeItem(STORAGE_KEYS.VERIFIER);
    sessionStorage.removeItem(STORAGE_KEYS.REDIRECT_PATH);

    if (!incomingState || !savedState || incomingState !== savedState) {
      throw new SpotifyAuthError(
        'OAuth state parameter mismatch or missing. Authorization request rejected for security.',
        'state_mismatch'
      );
    }

    if (!codeVerifier) {
      throw new SpotifyAuthError(
        'Missing PKCE code verifier in session. Please initiate Spotify login again.',
        'missing_verifier'
      );
    }

    return { codeVerifier, returnPath };
  } catch (err) {
    if (err instanceof SpotifyAuthError) throw err;
    throw new SpotifyAuthError('Error validating OAuth PKCE parameters.', 'validation_error');
  }
}
