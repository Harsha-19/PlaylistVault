import { describe, it, expect, beforeEach } from 'vitest';
import { AudioRepository } from '../lib/audio/audioRepository';
import { clearAllAudioRecords } from '../lib/audio/indexedDb';
import { StoredAudioFile } from '../lib/audio/types';

describe('Audio Storage & Repository Service', () => {
  const dummyFile: StoredAudioFile = {
    id: 'test-audio-1',
    user_id: 'test-user-123',
    filename: 'song1.mp3',
    original_name: 'song1.mp3',
    file_size_bytes: 4096,
    mime_type: 'audio/mpeg',
    file_hash: 'abc123hash456',
    duration_ms: 210000,
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    genre: 'Rock',
    genres: ['Rock'],
    track_number: 1,
    disc_number: 1,
    year: '2024',
    bitrate_kbps: 320,
    sample_rate_hz: 44100,
    channels: 2,
    codec: 'MP3',
    artwork_data_url: null,
    blob: new Blob(['audio data']),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    await clearAllAudioRecords();
  });

  it('saves an audio record and retrieves it by ID', async () => {
    const saved = await AudioRepository.saveAudioFile(dummyFile);
    expect(saved.id).toBe(dummyFile.id);

    const retrieved = await AudioRepository.getById(dummyFile.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe('Test Song');
    expect(retrieved?.artist).toBe('Test Artist');
  });

  it('retrieves an audio record by content hash for duplicate detection', async () => {
    await AudioRepository.saveAudioFile(dummyFile);

    const match = await AudioRepository.findByHash('abc123hash456');
    expect(match).not.toBeNull();
    expect(match?.id).toBe(dummyFile.id);

    const nonMatch = await AudioRepository.findByHash('non-existent-hash');
    expect(nonMatch).toBeNull();
  });

  it('updates metadata fields without modifying binary audio or hash', async () => {
    await AudioRepository.saveAudioFile(dummyFile);

    const updated = await AudioRepository.updateMetadata(dummyFile.id, {
      title: 'Updated Title',
      genre: 'Alternative Rock',
      year: '2025',
    });

    expect(updated.title).toBe('Updated Title');
    expect(updated.genre).toBe('Alternative Rock');
    expect(updated.file_hash).toBe(dummyFile.file_hash);

    const fetched = await AudioRepository.getById(dummyFile.id);
    expect(fetched?.title).toBe('Updated Title');
  });

  it('deletes an audio record', async () => {
    await AudioRepository.saveAudioFile(dummyFile);

    await AudioRepository.delete(dummyFile.id);
    const retrieved = await AudioRepository.getById(dummyFile.id);
    expect(retrieved).toBeNull();
  });

  it('calculates total audio storage statistics correctly', async () => {
    await AudioRepository.saveAudioFile(dummyFile);
    await AudioRepository.saveAudioFile({
      ...dummyFile,
      id: 'test-audio-2',
      file_hash: 'diff-hash-789',
      file_size_bytes: 8192,
    });

    const stats = await AudioRepository.getStorageStats();
    expect(stats.count).toBe(2);
    expect(stats.totalBytes).toBe(4096 + 8192);
  });
});
