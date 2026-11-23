import { describe, it, expect, beforeEach } from 'vitest';
import { ExportHistoryRepository } from '../lib/export/exportHistoryRepository';
import { ExportHistoryRecord } from '../lib/export/types';

describe('ExportHistoryRepository — Search, Filter, Sort & Bulk Management', () => {
  const userId = 'user_history_tester';

  const mockRecords: ExportHistoryRecord[] = [
    {
      id: 'rec_1',
      userId,
      archiveName: 'Chill_Hop_2026.zip',
      sourceType: 'spotify_playlist',
      sourceId: 'pl_chill',
      sourceName: 'Chill Hop Study Sessions',
      totalTracks: 15,
      matchedAudioCount: 15,
      totalSizeBytes: 75000000,
      formatsIncluded: ['audio/mp3'],
      folderStructure: 'flat',
      downloaded: true,
      status: 'completed',
      cloudStoragePath: `${userId}/rec_1/Chill_Hop_2026.zip`,
      cloudSyncedAt: '2026-11-20T10:00:00Z',
      createdAt: '2026-11-20T10:00:00Z',
    },
    {
      id: 'rec_2',
      userId,
      archiveName: 'Workout_Beats.zip',
      sourceType: 'custom_collection',
      sourceId: 'col_workout',
      sourceName: 'Intense Gym Mix',
      totalTracks: 25,
      matchedAudioCount: 20,
      totalSizeBytes: 120000000,
      formatsIncluded: ['audio/flac'],
      folderStructure: 'artist_album_track',
      downloaded: false,
      status: 'failed',
      createdAt: '2026-11-21T12:00:00Z',
    },
    {
      id: 'rec_3',
      userId,
      archiveName: 'Acoustic_Sunday.zip',
      sourceType: 'spotify_playlist',
      sourceId: 'pl_acoustic',
      sourceName: 'Sunday Morning Coffee',
      totalTracks: 8,
      matchedAudioCount: 8,
      totalSizeBytes: 35000000,
      formatsIncluded: ['audio/wav'],
      folderStructure: 'flat',
      downloaded: true,
      status: 'completed',
      createdAt: '2026-11-22T08:00:00Z',
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('pv_export_history', JSON.stringify(mockRecords));
  });

  describe('searchHistory query matching', () => {
    it('searches by archive name substring case-insensitively', async () => {
      const results = await ExportHistoryRepository.searchHistory(userId, { query: 'chill' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('rec_1');
    });

    it('searches by source playlist/collection name substring', async () => {
      const results = await ExportHistoryRepository.searchHistory(userId, { query: 'gym' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('rec_2');
    });

    it('returns empty array when no query matches', async () => {
      const results = await ExportHistoryRepository.searchHistory(userId, { query: 'nonexistent' });
      expect(results).toHaveLength(0);
    });
  });

  describe('searchHistory status filtering', () => {
    it('filters completed status', async () => {
      const results = await ExportHistoryRepository.searchHistory(userId, { status: 'completed' });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'completed')).toBe(true);
    });

    it('filters failed status', async () => {
      const results = await ExportHistoryRepository.searchHistory(userId, { status: 'failed' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('rec_2');
    });

    it('filters cloud_backed status (only records with cloudStoragePath)', async () => {
      const results = await ExportHistoryRepository.searchHistory(userId, { status: 'cloud_backed' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('rec_1');
      expect(results[0].cloudStoragePath).toBeDefined();
    });
  });

  describe('searchHistory sorting', () => {
    it('sorts by newest first (default)', async () => {
      const results = await ExportHistoryRepository.searchHistory(userId, { sortBy: 'newest' });
      expect(results[0].id).toBe('rec_3'); // Nov 22
      expect(results[1].id).toBe('rec_2'); // Nov 21
      expect(results[2].id).toBe('rec_1'); // Nov 20
    });

    it('sorts by oldest first', async () => {
      const results = await ExportHistoryRepository.searchHistory(userId, { sortBy: 'oldest' });
      expect(results[0].id).toBe('rec_1');
      expect(results[2].id).toBe('rec_3');
    });

    it('sorts by size descending', async () => {
      const results = await ExportHistoryRepository.searchHistory(userId, { sortBy: 'size_desc' });
      expect(results[0].id).toBe('rec_2'); // 120 MB
      expect(results[1].id).toBe('rec_1'); // 75 MB
      expect(results[2].id).toBe('rec_3'); // 35 MB
    });

    it('sorts by track count descending', async () => {
      const results = await ExportHistoryRepository.searchHistory(userId, { sortBy: 'tracks_desc' });
      expect(results[0].id).toBe('rec_2'); // 25 tracks
      expect(results[1].id).toBe('rec_1'); // 15 tracks
      expect(results[2].id).toBe('rec_3'); // 8 tracks
    });
  });

  describe('updateRecord and bulkDelete', () => {
    it('updates an existing record with cloud backup metadata', async () => {
      const updated = await ExportHistoryRepository.updateRecord('rec_3', {
        cloudStoragePath: `${userId}/rec_3/Acoustic_Sunday.zip`,
        cloudSizeBytes: 35000000,
        cloudSyncedAt: new Date().toISOString(),
      });

      expect(updated.cloudStoragePath).toContain('Acoustic_Sunday.zip');
      expect(updated.cloudSizeBytes).toBe(35000000);

      // Verify persistence in localStorage
      const all = JSON.parse(localStorage.getItem('pv_export_history') || '[]');
      const storedRec3 = all.find((r: any) => r.id === 'rec_3');
      expect(storedRec3.cloudStoragePath).toContain('Acoustic_Sunday.zip');
    });

    it('bulk deletes multiple records by IDs', async () => {
      await ExportHistoryRepository.bulkDelete(['rec_1', 'rec_3']);

      const remaining = await ExportHistoryRepository.getHistory(userId);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('rec_2');
    });
  });
});
