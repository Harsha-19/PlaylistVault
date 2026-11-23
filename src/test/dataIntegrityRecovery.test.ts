import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetadataBackupService } from '../lib/storage/metadataBackupService';
import { LocalStorageManager } from '../lib/storage/localStorageManager';
import { AudioRepository } from '../lib/audio/audioRepository';

describe('Data Integrity, Failure Recovery & Resilient Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Corrupted & Malformed Backup Rejection', () => {
    it('rejects truncated JSON files cleanly without modifying state', () => {
      localStorage.setItem('pv_custom_collections', JSON.stringify([{ id: 'c1', name: 'Safe Collection' }]));

      const truncated = '{"version":"playlistvault-backup-v1","data":{"collections":[';
      const result = MetadataBackupService.validateBackupFile(truncated);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid JSON syntax');

      // Verify state was completely untouched
      const stored = JSON.parse(localStorage.getItem('pv_custom_collections') || '[]');
      expect(stored[0].name).toBe('Safe Collection');
    });

    it('rejects unsupported backup versions', () => {
      const incompatible = JSON.stringify({
        version: 'future-v999.0',
        data: { collections: [], matches: [], export_history: [] },
      });

      const result = MetadataBackupService.validateBackupFile(incompatible);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Unsupported schema version');
    });

    it('rejects non-array collections or matches', () => {
      const malformed = JSON.stringify({
        version: 'playlistvault-backup-v1',
        data: {
          collections: { id: 'c1' }, // not an array
          matches: [],
          export_history: [],
        },
      });

      const result = MetadataBackupService.validateBackupFile(malformed);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('The "collections" entry must be an array.');
    });
  });

  describe('Atomic Rollback Protection on Restore Error', () => {
    it('restores previous localStorage state if JSON parsing or saving fails mid-execution', () => {
      const initialCollections = [{ id: 'col_orig', name: 'Original Collection' }];
      const initialMatches = [{ id: 'match_orig', playlist_id: 'p1', track_id: 't1' }];
      localStorage.setItem('pv_custom_collections', JSON.stringify(initialCollections));
      localStorage.setItem('pv_track_matches_data', JSON.stringify(initialMatches));

      // Mock an error during localStorage.setItem for matches only during execution
      const originalSetItem = localStorage.setItem.bind(localStorage);
      let hasThrown = false;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => {
        if (key === 'pv_track_matches_data' && !hasThrown) {
          hasThrown = true;
          throw new Error('QuotaExceededError: LocalStorage quota exceeded');
        }
        originalSetItem(key, val);
      });

      const payload = {
        version: 'playlistvault-backup-v1',
        app: 'PlaylistVault',
        exported_at: new Date().toISOString(),
        user_id: 'u1',
        notice: '',
        data: {
          collections: [{ id: 'col_new', name: 'New Collection', audio_file_ids: [] as string[] }] as any,
          matches: [{ id: 'match_new', playlist_id: 'p1', track_id: 't1' }] as any,
          export_history: [],
        },
      };

      const result = MetadataBackupService.executeRestore(payload, 'overwrite');

      expect(result.success).toBe(false);
      expect(result.error).toContain('quota exceeded');

      // Verify original snapshots were rolled back
      const restoredCols = JSON.parse(localStorage.getItem('pv_custom_collections') || '[]');
      expect(restoredCols[0].name).toBe('Original Collection');
    });
  });

  describe('Safe Audio Deletion Safeguards', () => {
    it('prevents accidental deletion of the actively playing track without force confirmation', async () => {
      const activeAudioId = 'playing_audio_123';
      const result = await LocalStorageManager.safeDeleteAudioFile(activeAudioId, activeAudioId, false);

      expect(result.success).toBe(false);
      expect(result.error).toContain('currently playing');
    });

    it('permits deletion of actively playing track when user forces action', async () => {
      vi.spyOn(AudioRepository, 'delete').mockResolvedValue();

      const activeAudioId = 'playing_audio_123';
      const result = await LocalStorageManager.safeDeleteAudioFile(activeAudioId, activeAudioId, true);

      expect(result.success).toBe(true);
    });

    it('cascades deletion cleanly across matches and custom collections', async () => {
      vi.spyOn(AudioRepository, 'delete').mockResolvedValue();

      localStorage.setItem(
        'pv_track_matches_data',
        JSON.stringify([
          { id: 'm1', audio_file_id: 'delete_me' },
          { id: 'm2', audio_file_id: 'keep_me' },
        ])
      );

      localStorage.setItem(
        'pv_custom_collections',
        JSON.stringify([
          { id: 'col1', name: 'My List', audio_file_ids: ['delete_me', 'keep_me'] },
        ])
      );

      const result = await LocalStorageManager.safeDeleteAudioFile('delete_me', null, false);

      expect(result.success).toBe(true);

      const remainingMatches = JSON.parse(localStorage.getItem('pv_track_matches_data') || '[]');
      expect(remainingMatches).toHaveLength(1);
      expect(remainingMatches[0].audio_file_id).toBe('keep_me');

      const remainingCols = JSON.parse(localStorage.getItem('pv_custom_collections') || '[]');
      expect(remainingCols[0].audio_file_ids).toEqual(['keep_me']);
    });
  });
});
