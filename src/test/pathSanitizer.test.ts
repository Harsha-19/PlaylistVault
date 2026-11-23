import { describe, it, expect } from 'vitest';
import {
  sanitizePathSegment,
  generateSafeTrackFilename,
  resolveArchivePath,
  sanitizeExtension,
} from '../lib/export/pathSanitizer';

describe('Safe Path Sanitizer & Collision Engine (Phase 6)', () => {
  describe('sanitizePathSegment (ZIP Slip & Traversal Protection)', () => {
    it('strips directory traversal dots and slashes', () => {
      expect(sanitizePathSegment('../../../etc/passwd')).toBe('etc_passwd');
      expect(sanitizePathSegment('..\\..\\windows\\system32')).toBe('windows_system32');
      expect(sanitizePathSegment('./subfolder/track')).toBe('subfolder_track');
      expect(sanitizePathSegment('....//secret')).toBe('secret');
    });

    it('replaces illegal filesystem characters across Windows and POSIX', () => {
      // Forbidden: < > : " / \ | ? *
      const dirty = 'AC/DC: Live <2020> "Special" | Track? *#1';
      const clean = sanitizePathSegment(dirty);
      expect(clean).not.toMatch(/[<>:"/\\|?*]/);
      expect(clean).toBe('AC_DC_ Live _2020_ _Special_ _ Track_ _#1');
    });

    it('sanitizes Windows reserved device names (CON, PRN, AUX, NUL, COM1, LPT1)', () => {
      expect(sanitizePathSegment('CON')).toBe('_CON');
      expect(sanitizePathSegment('con.mp3')).toBe('_con.mp3');
      expect(sanitizePathSegment('aux')).toBe('_aux');
      expect(sanitizePathSegment('NUL.txt')).toBe('_NUL.txt');
      expect(sanitizePathSegment('COM1')).toBe('_COM1');
    });

    it('removes leading and trailing dots and whitespace', () => {
      expect(sanitizePathSegment('  .Hidden Album.  ')).toBe('Hidden Album');
      expect(sanitizePathSegment('...Song...')).toBe('Song');
    });

    it('falls back cleanly for empty or whitespace-only inputs', () => {
      expect(sanitizePathSegment('')).toBe('untitled');
      expect(sanitizePathSegment('   ')).toBe('untitled');
      expect(sanitizePathSegment('...', 'fallback_name')).toBe('fallback_name');
    });

    it('truncates excessively long path segments while preserving extension', () => {
      const veryLong = 'a'.repeat(150) + '.mp3';
      const result = sanitizePathSegment(veryLong);
      expect(result.length).toBeLessThanOrEqual(90);
      expect(result.endsWith('.mp3')).toBe(true);
    });
  });

  describe('sanitizeExtension', () => {
    it('normalizes common audio formats cleanly', () => {
      expect(sanitizeExtension('track.MP3')).toBe('mp3');
      expect(sanitizeExtension('track.FLAC')).toBe('flac');
      expect(sanitizeExtension('song.wav')).toBe('wav');
      expect(sanitizeExtension('audio.m4a')).toBe('m4a');
      expect(sanitizeExtension('tune.ogg')).toBe('ogg');
      expect(sanitizeExtension('file.opus')).toBe('opus');
    });

    it('derives extension from codec if filename has no extension', () => {
      expect(sanitizeExtension('track_without_ext', 'FLAC')).toBe('flac');
      expect(sanitizeExtension(undefined, 'MPEG')).toBe('mp3');
      expect(sanitizeExtension(undefined, 'vorbis')).toBe('ogg');
    });
  });

  describe('generateSafeTrackFilename', () => {
    it('generates filename according to track_artist_title pattern with padded track number', () => {
      const name = generateSafeTrackFilename(
        {
          title: 'Blinding Lights',
          artist: 'The Weeknd',
          trackNumber: 9,
          codec: 'mp3',
        },
        'track_artist_title'
      );
      expect(name).toBe('09 - The Weeknd - Blinding Lights.mp3');
    });

    it('generates filename according to artist_title pattern', () => {
      const name = generateSafeTrackFilename(
        {
          title: 'Starboy',
          artist: 'The Weeknd / Daft Punk',
          codec: 'flac',
        },
        'artist_title'
      );
      expect(name).toBe('The Weeknd _ Daft Punk - Starboy.flac');
    });

    it('generates filename according to title_only pattern', () => {
      const name = generateSafeTrackFilename(
        {
          title: 'Save Your Tears',
          artist: 'The Weeknd',
          codec: 'wav',
        },
        'title_only'
      );
      expect(name).toBe('Save Your Tears.wav');
    });

    it('preserves sanitized original filename when original pattern is selected', () => {
      const name = generateSafeTrackFilename(
        {
          title: 'Midnight City',
          artist: 'M83',
          originalFilename: '01_m83_midnight_city_master.mp3',
        },
        'original'
      );
      expect(name).toBe('01_m83_midnight_city_master.mp3');
    });
  });

  describe('resolveArchivePath (Folder Structures & Collision Resolution)', () => {
    it('resolves playlist_track hierarchy', () => {
      const allocated = new Set<string>();
      const path = resolveArchivePath(
        {
          playlistName: 'Road Trip 2024',
          artist: 'Queen',
          album: 'A Night at the Opera',
          genre: 'Rock',
          filename: '01 - Queen - Bohemian Rhapsody.mp3',
          folderStructure: 'playlist_track',
        },
        allocated
      );
      expect(path).toBe('Road Trip 2024/01 - Queen - Bohemian Rhapsody.mp3');
      expect(allocated.has('road trip 2024/01 - queen - bohemian rhapsody.mp3')).toBe(true);
    });

    it('resolves artist_album_track hierarchy', () => {
      const allocated = new Set<string>();
      const path = resolveArchivePath(
        {
          playlistName: 'Hits',
          artist: 'Pink Floyd',
          album: 'Dark Side of the Moon',
          genre: 'Progressive Rock',
          filename: '01 - Pink Floyd - Time.flac',
          folderStructure: 'artist_album_track',
        },
        allocated
      );
      expect(path).toBe('Pink Floyd/Dark Side of the Moon/01 - Pink Floyd - Time.flac');
    });

    it('resolves genre_artist_track hierarchy', () => {
      const allocated = new Set<string>();
      const path = resolveArchivePath(
        {
          playlistName: 'Synth Mix',
          artist: 'Kavinsky',
          album: 'OutRun',
          genre: 'Synthwave',
          filename: '01 - Kavinsky - Nightcall.mp3',
          folderStructure: 'genre_artist_track',
        },
        allocated
      );
      expect(path).toBe('Synthwave/Kavinsky/01 - Kavinsky - Nightcall.mp3');
    });

    it('resolves flat hierarchy', () => {
      const allocated = new Set<string>();
      const path = resolveArchivePath(
        {
          playlistName: 'Mix',
          artist: 'Daft Punk',
          album: 'Discovery',
          genre: 'Electronic',
          filename: '01 - Daft Punk - One More Time.mp3',
          folderStructure: 'flat',
        },
        allocated
      );
      expect(path).toBe('01 - Daft Punk - One More Time.mp3');
    });

    it('resolves filename collisions by appending sequential counter (1), (2)', () => {
      const allocated = new Set<string>();
      const trackOptions = {
        playlistName: 'My Mix',
        artist: 'Various Artists',
        album: 'Best Of',
        genre: 'Pop',
        filename: 'Intro.mp3',
        folderStructure: 'playlist_track' as const,
      };

      const path1 = resolveArchivePath(trackOptions, allocated);
      const path2 = resolveArchivePath(trackOptions, allocated);
      const path3 = resolveArchivePath(trackOptions, allocated);

      expect(path1).toBe('My Mix/Intro.mp3');
      expect(path2).toBe('My Mix/Intro (1).mp3');
      expect(path3).toBe('My Mix/Intro (2).mp3');
    });
  });
});
