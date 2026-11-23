import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizePathSegment, resolveArchivePath } from '../lib/export/pathSanitizer';
import { CloudBackupService } from '../lib/cloud/cloudBackupService';
import { generateCodeChallenge, generateCodeVerifier } from '../lib/spotify/pkce';
import * as supabaseModule from '../lib/supabase';

describe('Security & Data Isolation Audit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('ZIP Slip & Path Traversal Mitigations', () => {
    it('strips directory traversal dots and relative paths', () => {
      expect(sanitizePathSegment('../../../etc/passwd')).not.toContain('..');
      expect(sanitizePathSegment('..\\..\\Windows\\System32')).not.toContain('..');
      expect(sanitizePathSegment('../secret.txt')).toBe('secret.txt');
    });

    it('neutralizes absolute filesystem paths', () => {
      const sanitized = sanitizePathSegment('/var/log/system.log');
      expect(sanitized.startsWith('/')).toBe(false);
      expect(sanitized).not.toContain('/');
    });

    it('prevents Windows reserved device name exploitation', () => {
      const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];
      reserved.forEach((name) => {
        const sanitized = sanitizePathSegment(name);
        expect(sanitized).toBe(`_${name}`);
        const withExt = sanitizePathSegment(`${name}.mp3`);
        expect(withExt.startsWith('_')).toBe(true);
      });
    });

    it('replaces dangerous POSIX and Windows illegal characters', () => {
      const dangerous = 'Track<1>:Special"Version"|Live?*';
      const clean = sanitizePathSegment(dangerous);
      expect(clean).not.toMatch(/[<>:"/\\|?*]/);
      expect(clean).toBe('Track_1__Special_Version__Live');
    });

    it('clamps overly long segment names to prevent filesystem buffer overflows', () => {
      const longName = 'A'.repeat(300) + '.mp3';
      const clean = sanitizePathSegment(longName);
      expect(clean.length).toBeLessThanOrEqual(90);
    });

    it('safely builds hierarchical export paths without escaping root folder', () => {
      const fullPath = resolveArchivePath(
        {
          folderStructure: 'artist_album_track',
          playlistName: '../../root',
          artist: '..\\malicious_artist',
          album: '../malicious_album',
          genre: '../evil_genre',
          filename: 'evil_track.mp3',
        },
        new Set<string>()
      );

      expect(fullPath).not.toContain('..');
      expect(fullPath.startsWith('/')).toBe(false);
      expect(fullPath.startsWith('\\')).toBe(false);
    });
  });

  describe('Cloud Storage User Path Isolation', () => {
    it('blocks signed URL generation if path targets a different user folder', async () => {
      vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);

      const attackerUserId = 'attacker_456';
      const victimStoragePath = 'victim_123/arch_999/secret_backup.zip';

      const result = await CloudBackupService.getSignedDownloadUrl(attackerUserId, victimStoragePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
      expect(result.signedUrl).toBeUndefined();
    });

    it('blocks archive deletion if path targets a different user folder', async () => {
      vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);

      const attackerUserId = 'attacker_456';
      const victimStoragePath = 'victim_123/arch_999/backup.zip';

      const result = await CloudBackupService.deleteArchive(attackerUserId, victimStoragePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });
  });

  describe('OAuth PKCE Token & Entropy Safety', () => {
    it('generates high-entropy base64url PKCE verifiers between 43 and 128 characters', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();

      expect(verifier1.length).toBeGreaterThanOrEqual(43);
      expect(verifier1.length).toBeLessThanOrEqual(128);
      // Ensure entropy (two consecutive verifiers are completely distinct)
      expect(verifier1).not.toBe(verifier2);
      expect(verifier1).toMatch(/^[A-Za-z0-9_.~-]+$/);
    });

    it('computes valid SHA-256 base64url challenge matching RFC 7636', async () => {
      const verifier = 'E9Melhoa2OwvFrEMTJguCHAo65K-GvS-2_142318723981729387';
      const challenge = await generateCodeChallenge(verifier);

      expect(challenge).toBeDefined();
      expect(challenge.length).toBeGreaterThan(20);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      // Challenge must not contain padding '=' or illegal chars '+', '/'
      expect(challenge).not.toContain('=');
      expect(challenge).not.toContain('+');
      expect(challenge).not.toContain('/');
    });
  });
});
