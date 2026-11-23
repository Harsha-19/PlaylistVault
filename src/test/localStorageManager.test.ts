import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalStorageManager } from '../lib/storage/localStorageManager';
import { AudioRepository } from '../lib/audio/audioRepository';
import { CollectionRepository } from '../lib/collections/collectionRepository';
import { ExportHistoryRepository } from '../lib/export/exportHistoryRepository';

describe('LocalStorageManager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('getStorageQuota', () => {
    it('returns calculated quota metrics when navigator.storage is available', async () => {
      const mockEstimate = vi.fn().mockResolvedValue({
        usage: 10485760, // 10 MB
        quota: 104857600, // 100 MB
      });
      const mockPersisted = vi.fn().mockResolvedValue(true);

      vi.stubGlobal('navigator', {
        ...navigator,
        storage: {
          estimate: mockEstimate,
          persisted: mockPersisted,
        },
      });

      const quota = await LocalStorageManager.getStorageQuota();

      expect(quota.isSupported).toBe(true);
      expect(quota.usageBytes).toBe(10485760);
      expect(quota.quotaBytes).toBe(104857600);
      expect(quota.remainingBytes).toBe(94371840);
      expect(quota.usagePercentage).toBe(10);
      expect(quota.isPersistent).toBe(true);
    });

    it('falls back gracefully if estimate throws an error', async () => {
      vi.stubGlobal('navigator', {
        ...navigator,
        storage: {
          estimate: vi.fn().mockRejectedValue(new Error('Quota error')),
        },
      });

      const quota = await LocalStorageManager.getStorageQuota();

      expect(quota.isSupported).toBe(false);
      expect(quota.usageBytes).toBe(0);
      expect(quota.quotaBytes).toBe(0);
    });
  });

  describe('requestPersistentStorage', () => {
    it('calls navigator.storage.persist and returns result', async () => {
      const mockPersist = vi.fn().mockResolvedValue(true);
      vi.stubGlobal('navigator', {
        ...navigator,
        storage: {
          persist: mockPersist,
        },
      });

      const result = await LocalStorageManager.requestPersistentStorage();
      expect(result).toBe(true);
      expect(mockPersist).toHaveBeenCalled();
    });
  });

  describe('getStorageBreakdown', () => {
    it('calculates counts and byte footprints across audio, collections, and history', async () => {
      vi.spyOn(AudioRepository, 'getStorageStats').mockResolvedValue({
        count: 5,
        totalBytes: 25000000,
      });

      vi.spyOn(CollectionRepository, 'getCollections').mockResolvedValue([
        {
          id: 'col_1',
          user_id: 'user_1',
          name: 'Workout Mix',
          description: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          audio_file_ids: ['a1', 'a2'],
        },
      ]);

      vi.spyOn(ExportHistoryRepository, 'getHistory').mockResolvedValue([
        {
          id: 'hist_1',
          userId: 'user_1',
          archiveName: 'Archive.zip',
          sourceType: 'spotify_playlist',
          sourceId: 'pl_1',
          sourceName: 'My Playlist',
          totalTracks: 2,
          matchedAudioCount: 2,
          totalSizeBytes: 1000,
          formatsIncluded: ['audio/mp3'],
          folderStructure: 'flat',
          downloaded: true,
          status: 'completed',
          createdAt: new Date().toISOString(),
        },
      ]);

      const breakdown = await LocalStorageManager.getStorageBreakdown('user_1');

      expect(breakdown.audioFilesCount).toBe(5);
      expect(breakdown.audioFilesBytes).toBe(25000000);
      expect(breakdown.collectionsCount).toBe(1);
      expect(breakdown.collectionsBytes).toBeGreaterThan(0);
      expect(breakdown.historyCount).toBe(1);
      expect(breakdown.historyBytes).toBeGreaterThan(0);
      expect(breakdown.totalLocalBytes).toBeGreaterThan(25000000);
    });
  });

  describe('inspectOrphanedRecords and cleanupOrphanedRecords', () => {
    it('detects and cleans up orphaned match records and collection references', async () => {
      // Setup existing audio files: only 'audio_1' exists
      vi.spyOn(AudioRepository, 'getAll').mockResolvedValue([
        {
          id: 'audio_1',
          user_id: 'user_1',
          filename: 'song1.mp3',
          original_name: 'song1.mp3',
          file_hash: 'hash1',
          file_size_bytes: 1000,
          mime_type: 'audio/mpeg',
          title: 'Song 1',
          artist: 'Artist 1',
          album: 'Album 1',
          duration_ms: 120000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any,
      ]);

      // Setup match decisions in localStorage: one valid, one orphan pointing to 'missing_audio_99'
      const matches = [
        {
          id: 'm1',
          user_id: 'user_1',
          playlist_id: 'pl_1',
          track_id: 't1',
          audio_file_id: 'audio_1',
          match_type: 'exact',
          confidence_score: 1.0,
          manually_assigned: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'm2',
          user_id: 'user_1',
          playlist_id: 'pl_1',
          track_id: 't2',
          audio_file_id: 'missing_audio_99',
          match_type: 'fuzzy',
          confidence_score: 0.8,
          manually_assigned: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem('pv_track_matches_data', JSON.stringify(matches));

      // Setup collection in CollectionRepository: referencing valid 'audio_1' and orphan 'missing_audio_99'
      const collection = {
        id: 'col_1',
        user_id: 'user_1',
        name: 'Chill Vibes',
        description: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        audio_file_ids: ['audio_1', 'missing_audio_99'],
      };
      vi.spyOn(CollectionRepository, 'getCollections').mockResolvedValue([collection]);
      const removeSpy = vi.spyOn(CollectionRepository, 'removeTrackFromCollection').mockResolvedValue(collection);

      // Inspect orphans
      const inspection = await LocalStorageManager.inspectOrphanedRecords('user_1');
      expect(inspection.orphanedMatchesCount).toBe(1);
      expect(inspection.orphanedMatches[0].id).toBe('m2');
      expect(inspection.orphanedCollectionItemsCount).toBe(1);
      expect(inspection.orphanedCollectionReferences[0].missingAudioFileId).toBe('missing_audio_99');

      // Clean up orphans
      const cleanResult = await LocalStorageManager.cleanupOrphanedRecords('user_1');
      expect(cleanResult.cleanedMatches).toBe(1);
      expect(cleanResult.cleanedRefs).toBe(1);
      expect(removeSpy).toHaveBeenCalledWith('col_1', 'missing_audio_99');

      // Verify localStorage matches was cleaned
      const remainingMatches = JSON.parse(localStorage.getItem('pv_track_matches_data') || '[]');
      expect(remainingMatches).toHaveLength(1);
      expect(remainingMatches[0].id).toBe('m1');
    });
  });

  describe('safeDeleteAudioFile', () => {
    it('blocks deletion of currently playing track when force is false', async () => {
      const result = await LocalStorageManager.safeDeleteAudioFile('track_123', 'track_123', false);
      expect(result.success).toBe(false);
      expect(result.error).toContain('currently playing');
    });

    it('allows deletion of currently playing track when force is true', async () => {
      const deleteSpy = vi.spyOn(AudioRepository, 'delete').mockResolvedValue();

      const result = await LocalStorageManager.safeDeleteAudioFile('track_123', 'track_123', true);
      expect(result.success).toBe(true);
      expect(deleteSpy).toHaveBeenCalledWith('track_123');
    });

    it('deletes audio file and cascades deletion across matches and custom collections', async () => {
      const deleteSpy = vi.spyOn(AudioRepository, 'delete').mockResolvedValue();

      localStorage.setItem(
        'pv_track_matches_data',
        JSON.stringify([
          { id: 'm1', audio_file_id: 'audio_del' },
          { id: 'm2', audio_file_id: 'audio_keep' },
        ])
      );

      localStorage.setItem(
        'pv_custom_collections',
        JSON.stringify([
          { id: 'c1', name: 'Col 1', audio_file_ids: ['audio_del', 'audio_keep'] },
        ])
      );

      const result = await LocalStorageManager.safeDeleteAudioFile('audio_del', 'audio_keep', false);

      expect(result.success).toBe(true);
      expect(deleteSpy).toHaveBeenCalledWith('audio_del');

      const matches = JSON.parse(localStorage.getItem('pv_track_matches_data') || '[]');
      expect(matches).toEqual([{ id: 'm2', audio_file_id: 'audio_keep' }]);

      const collections = JSON.parse(localStorage.getItem('pv_custom_collections') || '[]');
      expect(collections[0].audio_file_ids).toEqual(['audio_keep']);
    });
  });
});
