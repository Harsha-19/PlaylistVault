import { describe, it, expect, beforeEach } from 'vitest';
import { AudioUploadQueue } from '../lib/audio/uploadQueue';
import { clearAllAudioRecords } from '../lib/audio/indexedDb';

describe('Audio Upload Queue & Ingestion Pipeline', () => {
  beforeEach(async () => {
    await clearAllAudioRecords();
  });

  it('enqueues and processes a valid audio file to completed state', async () => {
    const queue = new AudioUploadQueue('test-user-queue');
    const file = new File(['valid audio binary content for testing'], 'Artist - Test Track.mp3', {
      type: 'audio/mpeg',
    });

    return new Promise<void>((resolve) => {
      queue.subscribe((items) => {
        const item = items.find((i) => i.file.name === 'Artist - Test Track.mp3');
        if (item && item.status === 'completed') {
          expect(item.progress).toBe(100);
          expect(item.result).toBeDefined();
          expect(item.result?.title).toBe('Test Track');
          expect(item.result?.artist).toBe('Artist');
          resolve();
        }
      });

      queue.addFiles([file]);
    });
  });

  it('flags duplicate file upload by content hash', async () => {
    const queue = new AudioUploadQueue('test-user-queue');
    const content = 'duplicate audio stream byte array test';
    const file1 = new File([content], 'First Track.mp3', { type: 'audio/mpeg' });
    const file2 = new File([content], 'Copy of First Track.mp3', { type: 'audio/mpeg' });

    // Step 1: Ingest file 1
    await new Promise<void>((resolve) => {
      queue.subscribe((items) => {
        const item = items.find((i) => i.file.name === 'First Track.mp3');
        if (item && item.status === 'completed') {
          resolve();
        }
      });
      queue.addFiles([file1]);
    });

    // Step 2: Attempt to ingest file 2 (identical content)
    await new Promise<void>((resolve) => {
      const queue2 = new AudioUploadQueue('test-user-queue');
      queue2.subscribe((items) => {
        const item = items.find((i) => i.file.name === 'Copy of First Track.mp3');
        if (item && item.status === 'duplicate') {
          expect(item.error).toContain('already in library');
          resolve();
        }
      });
      queue2.addFiles([file2]);
    });
  });

  it('handles user cancellation of queued items', () => {
    const queue = new AudioUploadQueue('test-user-queue');
    const file1 = new File(['audio 1'], 'file1.mp3', { type: 'audio/mpeg' });
    const file2 = new File(['audio 2'], 'file2.mp3', { type: 'audio/mpeg' });
    const file3 = new File(['audio 3'], 'file3.mp3', { type: 'audio/mpeg' });

    queue.addFiles([file1, file2, file3]);
    queue.cancelQueue();

    const items = queue.getItems();
    const cancelledOrErrored = items.some((i) => i.status === 'error' || i.status === 'completed');
    expect(cancelledOrErrored).toBe(true);
  });
});
