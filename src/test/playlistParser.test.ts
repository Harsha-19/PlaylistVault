import { describe, it, expect } from 'vitest';
import { parseSpotifyPlaylistUrl, extractSpotifyPlaylistId } from '../lib/spotify/playlistParser';
import { PlaylistParseError } from '../lib/spotify/errors';

describe('Spotify Playlist URL Parser', () => {
  const VALID_ID = '37i9dQZF1DXcBWIGoYBM5M';

  describe('parseSpotifyPlaylistUrl - Valid Inputs', () => {
    it('parses standard https open.spotify.com playlist URL', () => {
      const res = parseSpotifyPlaylistUrl(`https://open.spotify.com/playlist/${VALID_ID}`);
      expect(res.success).toBe(true);
      expect(res.playlistId).toBe(VALID_ID);
    });

    it('parses playlist URL with query/tracking parameters', () => {
      const res = parseSpotifyPlaylistUrl(
        `https://open.spotify.com/playlist/${VALID_ID}?si=42fa3d7a8b9c&nd=1&pt=abc`
      );
      expect(res.success).toBe(true);
      expect(res.playlistId).toBe(VALID_ID);
    });

    it('parses user-scoped playlist URL format', () => {
      const res = parseSpotifyPlaylistUrl(
        `https://open.spotify.com/user/spotify/playlist/${VALID_ID}`
      );
      expect(res.success).toBe(true);
      expect(res.playlistId).toBe(VALID_ID);
    });

    it('parses legacy play.spotify.com playlist URL', () => {
      const res = parseSpotifyPlaylistUrl(`https://play.spotify.com/playlist/${VALID_ID}`);
      expect(res.success).toBe(true);
      expect(res.playlistId).toBe(VALID_ID);
    });

    it('parses spotify:playlist: URI format', () => {
      const res = parseSpotifyPlaylistUrl(`spotify:playlist:${VALID_ID}`);
      expect(res.success).toBe(true);
      expect(res.playlistId).toBe(VALID_ID);
    });

    it('parses valid raw playlist ID', () => {
      const res = parseSpotifyPlaylistUrl(VALID_ID);
      expect(res.success).toBe(true);
      expect(res.playlistId).toBe(VALID_ID);
    });

    it('handles leading and trailing whitespace', () => {
      const res = parseSpotifyPlaylistUrl(`  https://open.spotify.com/playlist/${VALID_ID}  \n`);
      expect(res.success).toBe(true);
      expect(res.playlistId).toBe(VALID_ID);
    });
  });

  describe('parseSpotifyPlaylistUrl - Invalid Inputs', () => {
    it('rejects empty or whitespace input', () => {
      expect(parseSpotifyPlaylistUrl('').success).toBe(false);
      expect(parseSpotifyPlaylistUrl('   ').success).toBe(false);
    });

    it('rejects URLs from other domains', () => {
      const res = parseSpotifyPlaylistUrl('https://music.apple.com/playlist/my-playlist');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Unrecognized hostname');
    });

    it('rejects Spotify tracks, albums, and artists', () => {
      const trackRes = parseSpotifyPlaylistUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
      expect(trackRes.success).toBe(false);
      expect(trackRes.error).toContain('Detected resource type: "track"');

      const albumRes = parseSpotifyPlaylistUrl('https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3');
      expect(albumRes.success).toBe(false);
      expect(albumRes.error).toContain('Detected resource type: "album"');

      const artistRes = parseSpotifyPlaylistUrl('https://open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02');
      expect(artistRes.success).toBe(false);
      expect(artistRes.error).toContain('Detected resource type: "artist"');
    });

    it('rejects invalid URI resources', () => {
      const res = parseSpotifyPlaylistUrl('spotify:track:4cOdK2wGLETKBW3PvgPWqT');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid Spotify URI resource');
    });

    it('rejects malformed or too short raw IDs', () => {
      const res = parseSpotifyPlaylistUrl('short_id');
      expect(res.success).toBe(false);
    });

    it('rejects raw IDs with illegal symbols', () => {
      const res = parseSpotifyPlaylistUrl('37i9dQZF1DXcBWIG!@#$%^');
      expect(res.success).toBe(false);
    });
  });

  describe('extractSpotifyPlaylistId', () => {
    it('returns ID for valid input', () => {
      expect(extractSpotifyPlaylistId(VALID_ID)).toBe(VALID_ID);
    });

    it('throws PlaylistParseError for invalid input', () => {
      expect(() => extractSpotifyPlaylistId('https://google.com')).toThrow(PlaylistParseError);
    });
  });
});
