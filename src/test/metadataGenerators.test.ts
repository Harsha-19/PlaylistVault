import { describe, it, expect } from 'vitest';
import {
  escapeCsvField,
  generateMetadataJson,
  generateMetadataCsv,
  generatePlaylistJson,
  generateReadmeText,
} from '../lib/export/metadataGenerators';
import { ExportOptionsConfig, ExportTrackItem } from '../lib/export/types';

describe('Metadata Export Manifest Generators (Phase 6)', () => {
  const mockConfig: ExportOptionsConfig = {
    sourceType: 'spotify_playlist',
    sourceId: 'pl-123',
    sourceName: 'Synthwave Nightride',
    folderStructure: 'playlist_track',
    filenamePattern: 'track_artist_title',
    includeAudioFiles: true,
    includeCsv: true,
    includeJson: true,
    includePlaylistJson: true,
    includeReadme: true,
  };

  const mockTracks: ExportTrackItem[] = [
    {
      trackId: 't-1',
      title: 'Nightcall, The Special "Remix"',
      artist: 'Kavinsky, feat. Lovefoxxx',
      albumArtist: 'Kavinsky',
      album: 'OutRun',
      genre: 'Synthwave',
      year: '2013',
      trackNumber: 1,
      discNumber: 1,
      durationMs: 259000,
      spotifyTrackId: 'spotify-track-1',
      audioFileId: 'file-1',
      matchConfidence: 98,
      matchStatus: 'confirmed',
      status: 'ready',
      issues: [],
      originalFilename: 'kavinsky_nightcall.mp3',
      exportedFilename: '01 - Kavinsky - Nightcall.mp3',
      exportedPath: 'Synthwave Nightride/01 - Kavinsky - Nightcall.mp3',
      fileSizeBytes: 6200000,
      codec: 'MP3',
      fileHash: 'hash-kavinsky-1234567890abcdef',
    },
    {
      trackId: 't-2',
      title: 'Resonance',
      artist: 'HOME',
      album: 'Odyssey',
      genre: 'Chillwave',
      year: '2014',
      trackNumber: 2,
      discNumber: 1,
      durationMs: 212000,
      spotifyTrackId: 'spotify-track-2',
      audioFileId: 'file-2',
      matchConfidence: 92,
      matchStatus: 'confirmed',
      status: 'ready',
      issues: [],
      originalFilename: 'home_resonance.flac',
      exportedFilename: '02 - HOME - Resonance.flac',
      exportedPath: 'Synthwave Nightride/02 - HOME - Resonance.flac',
      fileSizeBytes: 18400000,
      codec: 'FLAC',
      fileHash: 'hash-home-abcdef1234567890',
    },
  ];

  describe('escapeCsvField (RFC 4180 Escaping)', () => {
    it('returns simple string without modification if no special characters exist', () => {
      expect(escapeCsvField('Simple Title')).toBe('Simple Title');
      expect(escapeCsvField(12345)).toBe('12345');
    });

    it('wraps string in quotes if it contains commas', () => {
      expect(escapeCsvField('Artist A, Artist B')).toBe('"Artist A, Artist B"');
    });

    it('doubles internal double quotes and wraps in quotes', () => {
      expect(escapeCsvField('The "Greatest" Hits')).toBe('"The ""Greatest"" Hits"');
    });

    it('wraps string in quotes if it contains newline characters', () => {
      expect(escapeCsvField('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
    });

    it('handles empty or null values', () => {
      expect(escapeCsvField(null)).toBe('');
      expect(escapeCsvField(undefined)).toBe('');
      expect(escapeCsvField('')).toBe('');
    });
  });

  describe('generateMetadataJson', () => {
    it('generates valid JSON with complete track metadata and hashes', () => {
      const jsonStr = generateMetadataJson(mockTracks, mockConfig);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.archive_name).toBe('Synthwave Nightride');
      expect(parsed.source_id).toBe('pl-123');
      expect(parsed.generator).toContain('PlaylistVault');
      expect(parsed.total_tracks).toBe(2);
      expect(parsed.tracks).toHaveLength(2);

      const track1 = parsed.tracks[0];
      expect(track1.title).toBe('Nightcall, The Special "Remix"');
      expect(track1.artist).toBe('Kavinsky, feat. Lovefoxxx');
      expect(track1.album).toBe('OutRun');
      expect(track1.genre).toBe('Synthwave');
      expect(track1.year).toBe('2013');
      expect(track1.duration_ms).toBe(259000);
      expect(track1.exported_path).toBe('Synthwave Nightride/01 - Kavinsky - Nightcall.mp3');
      expect(track1.format).toBe('MP3');
      expect(track1.file_size_bytes).toBe(6200000);
      expect(track1.spotify_track_id).toBe('spotify-track-1');
      expect(track1.match_confidence).toBe(98);
      expect(track1.sha256_hash).toBe('hash-kavinsky-1234567890abcdef');
    });
  });

  describe('generateMetadataCsv', () => {
    it('generates RFC 4180 CSV prefixed with UTF-8 BOM for spreadsheet compatibility', () => {
      const csvStr = generateMetadataCsv(mockTracks);

      // Verify UTF-8 BOM (\uFEFF)
      expect(csvStr.charCodeAt(0)).toBe(0xfeff);

      // Verify header columns
      expect(csvStr).toContain('Track Number,Disc Number,Title,Artist,Album Artist');
      expect(csvStr).toContain('Duration Formatted,Format,File Size (Bytes),Exported Path');

      // Verify quotes around comma/quote fields
      expect(csvStr).toContain('"Nightcall, The Special ""Remix"""');
      expect(csvStr).toContain('"Kavinsky, feat. Lovefoxxx"');

      // Verify second track
      expect(csvStr).toContain('Resonance,HOME,HOME,Odyssey,Chillwave,2014');
    });
  });

  describe('generatePlaylistJson', () => {
    it('generates playlist manifest with collection duration and track paths', () => {
      const jsonStr = generatePlaylistJson(mockTracks, mockConfig);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.name).toBe('Synthwave Nightride');
      expect(parsed.total_tracks).toBe(2);
      expect(parsed.total_duration_ms).toBe(471000);
      expect(parsed.tracks).toHaveLength(2);
      expect(parsed.tracks[0].path).toBe('Synthwave Nightride/01 - Kavinsky - Nightcall.mp3');
      expect(parsed.tracks[1].path).toBe('Synthwave Nightride/02 - HOME - Resonance.flac');
    });
  });

  describe('generateReadmeText', () => {
    it('generates human-readable README with offline guarantee and track listing', () => {
      const readmeStr = generateReadmeText(mockTracks, mockConfig);

      expect(readmeStr).toContain('PLAYLISTVAULT — OFFLINE AUDIO ARCHIVE');
      expect(readmeStr).toContain('Archive Name:    Synthwave Nightride');
      expect(readmeStr).toContain('Total Tracks:    2');
      expect(readmeStr).toContain('1. OFFLINE STANDALONE USAGE GUARANTEE');
      expect(readmeStr).toContain('NO internet connection, Spotify authorization');
      expect(readmeStr).toContain('3. TRACK LISTING');
      expect(readmeStr).toContain('Kavinsky, feat. Lovefoxxx - Nightcall, The Special "Remix"');
      expect(readmeStr).toContain('HOME - Resonance');
      expect(readmeStr).toContain('SHA-256: hash-kavinsky-1234567890abcdef');
    });
  });
});
