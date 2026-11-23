import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateRandomState,
  storePkceSession,
  validateAndRetrievePkce,
  base64UrlEncode,
} from '../lib/spotify/pkce';
import { SpotifyAuthError } from '../lib/spotify/errors';

describe('Spotify PKCE Module', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('generateCodeVerifier', () => {
    it('generates a 64-character verifier by default', () => {
      const verifier = generateCodeVerifier();
      expect(verifier.length).toBe(64);
      expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    });

    it('generates verifiers with custom allowed lengths', () => {
      const v43 = generateCodeVerifier(43);
      expect(v43.length).toBe(43);

      const v128 = generateCodeVerifier(128);
      expect(v128.length).toBe(128);
    });

    it('throws error if length is out of RFC 7636 bounds (<43 or >128)', () => {
      expect(() => generateCodeVerifier(42)).toThrow(/between 43 and 128/);
      expect(() => generateCodeVerifier(129)).toThrow(/between 43 and 128/);
    });

    it('generates unique verifiers on successive calls', () => {
      const v1 = generateCodeVerifier();
      const v2 = generateCodeVerifier();
      expect(v1).not.toBe(v2);
    });
  });

  describe('generateCodeChallenge', () => {
    it('generates a base64url-encoded SHA-256 hash', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      // Challenge should be base64url encoded: alphanumeric + '-' and '_' without '=' padding
      expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
      expect(challenge).not.toContain('=');
      expect(challenge).not.toContain('+');
      expect(challenge).not.toContain('/');
    });

    it('produces deterministic output for the same verifier', async () => {
      const verifier = generateCodeVerifier();
      const c1 = await generateCodeChallenge(verifier);
      const c2 = await generateCodeChallenge(verifier);
      expect(c1).toBe(c2);
    });
  });

  describe('generateRandomState', () => {
    it('generates random alphanumeric state string', () => {
      const state = generateRandomState(32);
      expect(state.length).toBe(32);
      expect(state).toMatch(/^[A-Za-z0-9]+$/);
    });
  });

  describe('storePkceSession and validateAndRetrievePkce', () => {
    it('stores and validates matching state', () => {
      const state = generateRandomState();
      const verifier = generateCodeVerifier();
      storePkceSession(state, verifier, '/playlists/custom');

      const retrieved = validateAndRetrievePkce(state);
      expect(retrieved.codeVerifier).toBe(verifier);
      expect(retrieved.returnPath).toBe('/playlists/custom');
    });

    it('throws SpotifyAuthError on state mismatch (CSRF protection)', () => {
      const state = generateRandomState();
      const verifier = generateCodeVerifier();
      storePkceSession(state, verifier);

      expect(() => validateAndRetrievePkce('attacker_state')).toThrow(SpotifyAuthError);
    });

    it('prevents replay attacks by clearing session upon retrieval', () => {
      const state = generateRandomState();
      const verifier = generateCodeVerifier();
      storePkceSession(state, verifier);

      // First call succeeds
      validateAndRetrievePkce(state);

      // Second call with same state fails
      expect(() => validateAndRetrievePkce(state)).toThrow(SpotifyAuthError);
    });
  });

  describe('base64UrlEncode', () => {
    it('strips padding and replaces + and /', () => {
      // Test string that produces + and / in standard base64
      const bytes = new Uint8Array([251, 255, 254]);
      const encoded = base64UrlEncode(bytes);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });
  });
});
