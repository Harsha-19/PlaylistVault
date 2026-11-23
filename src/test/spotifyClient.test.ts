import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { spotifyFetch } from '../lib/spotify/client';
import { SpotifyApiError, SpotifyAuthError, RateLimitError } from '../lib/spotify/errors';
import { saveSpotifySession } from '../lib/spotify/auth';

describe('Spotify API Client (spotifyFetch)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws SpotifyAuthError if no active session is present', async () => {
    await expect(spotifyFetch('/me')).rejects.toThrow(SpotifyAuthError);
  });

  it('injects Bearer token in request header when authenticated', async () => {
    saveSpotifySession({
      accessToken: 'valid-test-token',
      expiresAt: Date.now() + 3600 * 1000,
      scope: 'playlist-read-private',
    });

    const mockResponse = { id: 'user123', display_name: 'Test User' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    const result = await spotifyFetch('/me');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/me',
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('throws SpotifyAuthError and clears session on HTTP 401 (token expired)', async () => {
    saveSpotifySession({
      accessToken: 'expired-token',
      expiresAt: Date.now() + 3600 * 1000,
      scope: 'playlist-read-private',
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'The access token expired' } }),
    } as Response);

    await expect(spotifyFetch('/me')).rejects.toThrow(SpotifyAuthError);
    expect(sessionStorage.getItem('pv_spotify_session')).toBeNull();
  });

  it('throws SpotifyApiError with 403 on restricted access', async () => {
    saveSpotifySession({
      accessToken: 'test-token',
      expiresAt: Date.now() + 3600 * 1000,
      scope: 'playlist-read-private',
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'Insufficient client scope' } }),
    } as Response);

    await expect(spotifyFetch('/playlists/secret')).rejects.toThrow(SpotifyApiError);
  });

  it('throws SpotifyApiError with 404 on missing resource', async () => {
    saveSpotifySession({
      accessToken: 'test-token',
      expiresAt: Date.now() + 3600 * 1000,
      scope: 'playlist-read-private',
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: 'Not found' } }),
    } as Response);

    await expect(spotifyFetch('/playlists/nonexistent')).rejects.toThrow(SpotifyApiError);
  });

  it('throws RateLimitError on HTTP 429 when Retry-After is large', async () => {
    saveSpotifySession({
      accessToken: 'test-token',
      expiresAt: Date.now() + 3600 * 1000,
      scope: 'playlist-read-private',
    });

    const headers = new Headers();
    headers.set('Retry-After', '30');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers,
      json: async () => ({}),
    } as unknown as Response);

    await expect(spotifyFetch('/me')).rejects.toThrow(RateLimitError);
  });

  it('handles network failures gracefully', async () => {
    saveSpotifySession({
      accessToken: 'test-token',
      expiresAt: Date.now() + 3600 * 1000,
      scope: 'playlist-read-private',
    });

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Failed to fetch'));

    await expect(spotifyFetch('/me')).rejects.toThrow(/Network failure connecting to Spotify API/);
  });
});
