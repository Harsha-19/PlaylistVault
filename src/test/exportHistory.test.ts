import { describe, it, expect, beforeEach } from 'vitest';
import { ExportHistoryRepository } from '../lib/export/exportHistoryRepository';
import { ExportHistoryRecord } from '../lib/export/types';

describe('Export History Repository (Phase 6)', () => {
  const userId = 'user-hist-1';
  const otherUserId = 'user-hist-2';

  const mockRecord1: ExportHistoryRecord = {
    id: 'exp-1',
    userId,
    archiveName: 'Synthwave Classics.zip',
    sourceType: 'spotify_playlist',
    sourceId: 'pl-1',
    sourceName: 'Synthwave Classics',
    totalTracks: 10,
    matchedAudioCount: 10,
    totalSizeBytes: 85000000,
    formatsIncluded: ['MP3', 'FLAC'],
    folderStructure: 'playlist_track',
    status: 'completed',
    createdAt: '2026-11-20T10:00:00.000Z',
    downloaded: true,
  };

  const mockRecord2: ExportHistoryRecord = {
    id: 'exp-2',
    userId,
    archiveName: 'Chill Beats.zip',
    sourceType: 'custom_collection',
    sourceId: 'col-1',
    sourceName: 'Chill Beats',
    totalTracks: 5,
    matchedAudioCount: 5,
    totalSizeBytes: 42000000,
    formatsIncluded: ['FLAC'],
    folderStructure: 'artist_album_track',
    status: 'completed',
    createdAt: '2026-11-22T15:30:00.000Z', // newer
    downloaded: true,
  };

  const mockRecordOther: ExportHistoryRecord = {
    id: 'exp-other',
    userId: otherUserId,
    archiveName: 'Other User Archive.zip',
    sourceType: 'spotify_playlist',
    sourceId: 'pl-other',
    sourceName: 'Other User Archive',
    totalTracks: 3,
    matchedAudioCount: 3,
    totalSizeBytes: 20000000,
    formatsIncluded: ['MP3'],
    folderStructure: 'flat',
    status: 'completed',
    createdAt: '2026-11-21T12:00:00.000Z',
    downloaded: true,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('records new export entries and retrieves them sorted newest first', async () => {
    await ExportHistoryRepository.recordExport(mockRecord1);
    await ExportHistoryRepository.recordExport(mockRecord2);
    await ExportHistoryRepository.recordExport(mockRecordOther);

    const history = await ExportHistoryRepository.getHistory(userId);
    expect(history).toHaveLength(2);
    // Newest first: exp-2 (Nov 22) then exp-1 (Nov 20)
    expect(history[0].id).toBe('exp-2');
    expect(history[1].id).toBe('exp-1');

    const otherHistory = await ExportHistoryRepository.getHistory(otherUserId);
    expect(otherHistory).toHaveLength(1);
    expect(otherHistory[0].id).toBe('exp-other');
  });

  it('deletes an individual export record', async () => {
    await ExportHistoryRepository.recordExport(mockRecord1);
    await ExportHistoryRepository.recordExport(mockRecord2);

    await ExportHistoryRepository.deleteRecord('exp-1');

    const history = await ExportHistoryRepository.getHistory(userId);
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe('exp-2');
  });

  it('clears all export history for a user', async () => {
    await ExportHistoryRepository.recordExport(mockRecord1);
    await ExportHistoryRepository.recordExport(mockRecord2);

    await ExportHistoryRepository.clearHistory(userId);

    const history = await ExportHistoryRepository.getHistory(userId);
    expect(history).toHaveLength(0);
  });
});
