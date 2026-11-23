import { describe, it, expect, beforeEach } from 'vitest';
import { AudioRepository } from '../lib/audio/audioRepository';
import { clearAllAudioRecords } from '../lib/audio/indexedDb';
import { StoredAudioFile } from '../lib/audio/types';

describe('Metadata Editor & Tag Management (Phase 5)', () => {
  const initialBinaryContent = 'fake-mp3-binary-payload-data';
  const initialBlob = new Blob([initialBinaryContent], { type: 'audio/mpeg' });

  const testFile: StoredAudioFile = {
    id: 'audio-meta-1',
    user_id: 'user-editor-1',
    filename: 'song-orig.mp3',
    original_name: 'song-orig.mp3',
    file_size_bytes: initialBinaryContent.length,
    mime_type: 'audio/mpeg',
    file_hash: 'hash-abc-123456789',
    duration_ms: 195000,
    title: 'Original Title',
    artist: 'Original Artist',
    album_artist: 'Original Album Artist',
    album: 'Original Album',
    genre: 'Synthwave',
    genres: ['Synthwave'],
    track_number: 3,
    disc_number: 1,
    year: '2021',
    comments: 'Original embedded comment',
    bitrate_kbps: 320,
    sample_rate_hz: 44100,
    channels: 2,
    codec: 'MP3',
    artwork_data_url: null,
    blob: initialBlob,
    original_metadata: {
      title: 'Original Title',
      artist: 'Original Artist',
      album: 'Original Album',
      genre: 'Synthwave',
      year: '2021',
      track_number: 3,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    await clearAllAudioRecords();
  });

  describe('Validation Logic', () => {
    const validateFields = (form: {
      title: string;
      artist: string;
      year: string;
      trackNumber: string;
      discNumber: string;
    }): string[] => {
      const errors: string[] = [];
      if (!form.title.trim()) errors.push('Track title cannot be empty.');
      if (!form.artist.trim()) errors.push('Artist name cannot be empty.');
      if (form.year.trim()) {
        const yearNum = parseInt(form.year.trim(), 10);
        if (isNaN(yearNum) || yearNum < 1000 || yearNum > 2100) {
          errors.push('Year must be a valid 4-digit number (e.g. 2024).');
        }
      }
      if (form.trackNumber.trim()) {
        const trackNum = parseInt(form.trackNumber.trim(), 10);
        if (isNaN(trackNum) || trackNum < 0) {
          errors.push('Track number must be a non-negative number.');
        }
      }
      if (form.discNumber.trim()) {
        const discNum = parseInt(form.discNumber.trim(), 10);
        if (isNaN(discNum) || discNum < 0) {
          errors.push('Disc number must be a non-negative number.');
        }
      }
      return errors;
    };

    it('rejects empty track title or artist', () => {
      const errors = validateFields({
        title: '   ',
        artist: '',
        year: '2024',
        trackNumber: '1',
        discNumber: '1',
      });
      expect(errors).toContain('Track title cannot be empty.');
      expect(errors).toContain('Artist name cannot be empty.');
    });

    it('rejects invalid year format', () => {
      expect(validateFields({ title: 'Song', artist: 'Artist', year: '99', trackNumber: '', discNumber: '' }))
        .toContain('Year must be a valid 4-digit number (e.g. 2024).');

      expect(validateFields({ title: 'Song', artist: 'Artist', year: '2500', trackNumber: '', discNumber: '' }))
        .toContain('Year must be a valid 4-digit number (e.g. 2024).');

      expect(validateFields({ title: 'Song', artist: 'Artist', year: 'abcd', trackNumber: '', discNumber: '' }))
        .toContain('Year must be a valid 4-digit number (e.g. 2024).');
    });

    it('rejects negative track or disc numbers', () => {
      const errors = validateFields({
        title: 'Song',
        artist: 'Artist',
        year: '2024',
        trackNumber: '-1',
        discNumber: '-2',
      });
      expect(errors).toContain('Track number must be a non-negative number.');
      expect(errors).toContain('Disc number must be a non-negative number.');
    });

    it('accepts valid input', () => {
      const errors = validateFields({
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        year: '2020',
        trackNumber: '9',
        discNumber: '1',
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('Non-Destructive Metadata Updates', () => {
    it('updates metadata fields without modifying original binary blob or hash', async () => {
      await AudioRepository.saveAudioFile(testFile);

      // Perform update
      const updated = await AudioRepository.updateMetadata(testFile.id, {
        title: 'Updated Title',
        artist: 'Updated Artist',
        album: 'Updated Album',
        genre: 'Cyberpunk',
        year: '2025',
        track_number: 5,
        disc_number: 2,
        comments: 'User edited notes',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.artist).toBe('Updated Artist');
      expect(updated.album).toBe('Updated Album');
      expect(updated.genre).toBe('Cyberpunk');
      expect(updated.year).toBe('2025');
      expect(updated.track_number).toBe(5);
      expect(updated.disc_number).toBe(2);
      expect(updated.comments).toBe('User edited notes');

      // CRITICAL: Ensure binary blob, file size, and file hash remain identical
      expect(updated.file_hash).toBe(testFile.file_hash);
      expect(updated.file_size_bytes).toBe(testFile.file_size_bytes);
      expect(updated.blob).toBe(testFile.blob);
      expect(updated.original_metadata).toEqual(testFile.original_metadata);

      // Verify retrieval from DB
      const retrieved = await AudioRepository.getById(testFile.id);
      expect(retrieved?.title).toBe('Updated Title');
      expect(retrieved?.file_hash).toBe(testFile.file_hash);
      expect(retrieved?.original_metadata?.title).toBe('Original Title');
    });

    it('restores original tags from original_metadata snapshot', async () => {
      await AudioRepository.saveAudioFile(testFile);

      // User modified metadata
      await AudioRepository.updateMetadata(testFile.id, {
        title: 'Modified Name',
        artist: 'Modified Artist',
        album: 'Modified Album',
        genre: 'Pop',
        year: '1999',
        track_number: 99,
      });

      let current = await AudioRepository.getById(testFile.id);
      expect(current?.title).toBe('Modified Name');

      // Restore action
      const orig = current?.original_metadata;
      expect(orig).toBeDefined();

      if (orig) {
        await AudioRepository.updateMetadata(testFile.id, {
          title: orig.title || current?.filename || '',
          artist: orig.artist || 'Unknown Artist',
          album: orig.album || 'Unknown Album',
          genre: orig.genre || 'Unknown Genre',
          year: orig.year || null,
          track_number: orig.track_number ?? null,
        });
      }

      current = await AudioRepository.getById(testFile.id);
      expect(current?.title).toBe('Original Title');
      expect(current?.artist).toBe('Original Artist');
      expect(current?.album).toBe('Original Album');
      expect(current?.genre).toBe('Synthwave');
      expect(current?.year).toBe('2021');
      expect(current?.track_number).toBe(3);
    });
  });

  describe('Batch Metadata Updates', () => {
    it('applies batch updates across multiple audio files while preserving unique titles and blobs', async () => {
      const file1: StoredAudioFile = {
        ...testFile,
        id: 'file-batch-1',
        title: 'Song One',
        file_hash: 'hash-batch-1',
      };
      const file2: StoredAudioFile = {
        ...testFile,
        id: 'file-batch-2',
        title: 'Song Two',
        file_hash: 'hash-batch-2',
      };
      const file3: StoredAudioFile = {
        ...testFile,
        id: 'file-batch-3',
        title: 'Song Three',
        file_hash: 'hash-batch-3',
      };

      await AudioRepository.saveAudioFile(file1);
      await AudioRepository.saveAudioFile(file2);
      await AudioRepository.saveAudioFile(file3);

      const targetIds = [file1.id, file2.id, file3.id];
      const batchUpdates = {
        artist: 'Compilation Artist',
        album: 'Mega Hits Vol. 1',
        genre: 'Electronic',
        year: '2024',
      };

      for (const id of targetIds) {
        await AudioRepository.updateMetadata(id, batchUpdates);
      }

      const all = await AudioRepository.getAll('user-editor-1');
      expect(all).toHaveLength(3);

      for (const f of all) {
        expect(f.artist).toBe('Compilation Artist');
        expect(f.album).toBe('Mega Hits Vol. 1');
        expect(f.genre).toBe('Electronic');
        expect(f.year).toBe('2024');
      }

      // Titles and hashes must remain distinct
      const titles = all.map((f) => f.title);
      expect(titles).toContain('Song One');
      expect(titles).toContain('Song Two');
      expect(titles).toContain('Song Three');
    });
  });
});
