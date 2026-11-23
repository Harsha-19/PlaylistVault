/**
 * Phase 3 — Batch Audio Processing & Upload Queue
 * 
 * Manages the ingestion pipeline for multiple audio files:
 * 1. Validation (MIME, extension, size, header)
 * 2. SHA-256 Hashing (Web Crypto)
 * 3. Duplicate Detection (by content hash)
 * 4. Embedded Metadata Extraction (music-metadata)
 * 5. Persistent Local Storage (IndexedDB + optional Supabase)
 */

import { validateAudioFile } from './validation';
import { computeAudioFileHash } from './hashing';
import { extractAudioMetadata } from './metadata';
import { AudioRepository } from './audioRepository';
import { StoredAudioFile, UploadQueueItem } from './types';

export type QueueSubscriber = (items: UploadQueueItem[]) => void;

export class AudioUploadQueue {
  private queue: UploadQueueItem[] = [];
  private isProcessing = false;
  private isCancelled = false;
  private subscribers: Set<QueueSubscriber> = new Set();
  private maxConcurrency = 2;

  constructor(private userId: string = 'local-user') {}

  /**
   * Subscribes to queue updates.
   */
  public subscribe(subscriber: QueueSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber([...this.queue]);
    return () => this.subscribers.delete(subscriber);
  }

  private notify() {
    const snapshot = [...this.queue];
    this.subscribers.forEach((sub) => sub(snapshot));
  }

  /**
   * Enqueues a batch of files for processing.
   */
  public addFiles(files: FileList | File[]): UploadQueueItem[] {
    const fileArray = Array.from(files);
    const newItems: UploadQueueItem[] = fileArray.map((file, idx) => ({
      id: `queue-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      status: 'queued',
      progress: 0,
    }));

    this.queue.push(...newItems);
    this.notify();

    if (!this.isProcessing) {
      this.isCancelled = false;
      this.processNextBatch();
    }

    return newItems;
  }

  /**
   * Cancels any pending items in the queue.
   */
  public cancelQueue() {
    this.isCancelled = true;
    this.queue = this.queue.map((item) => {
      if (item.status === 'queued') {
        return { ...item, status: 'error', error: 'Upload cancelled by user.' };
      }
      return item;
    });
    this.isProcessing = false;
    this.notify();
  }

  /**
   * Clears finished or errored items from the queue list.
   */
  public clearCompleted() {
    this.queue = this.queue.filter((item) => item.status !== 'completed' && item.status !== 'duplicate');
    this.notify();
  }

  /**
   * Returns current queue items.
   */
  public getItems(): UploadQueueItem[] {
    return [...this.queue];
  }

  /**
   * Main pipeline loop processing items up to max concurrency.
   */
  private async processNextBatch() {
    if (this.isCancelled) return;

    const activeItems = this.queue.filter(
      (item) => item.status !== 'queued' && item.status !== 'completed' && item.status !== 'duplicate' && item.status !== 'error'
    );

    if (activeItems.length >= this.maxConcurrency) {
      return;
    }

    const nextItem = this.queue.find((item) => item.status === 'queued');
    if (!nextItem) {
      if (activeItems.length === 0) {
        this.isProcessing = false;
      }
      return;
    }

    this.isProcessing = true;
    this.processSingleItem(nextItem).finally(() => {
      this.processNextBatch();
    });

    // If concurrency permits, trigger another
    if (activeItems.length + 1 < this.maxConcurrency) {
      this.processNextBatch();
    }
  }

  /**
   * Processes a single audio file through the 5-stage ingestion pipeline.
   */
  private async processSingleItem(item: UploadQueueItem): Promise<void> {
    try {
      if (this.isCancelled) return;

      // Stage 1: Validation
      item.status = 'validating';
      item.progress = 10;
      this.notify();

      const validation = await validateAudioFile(item.file);

      if (this.isCancelled) return;

      // Stage 2: Hashing
      item.status = 'hashing';
      item.progress = 30;
      this.notify();

      const hash = await computeAudioFileHash(item.file);

      if (this.isCancelled) return;

      // Stage 3: Duplicate Detection
      const existing = await AudioRepository.findByHash(hash);
      if (existing) {
        item.status = 'duplicate';
        item.progress = 100;
        item.error = `File content is already in library as "${existing.original_name}".`;
        item.result = existing;
        this.notify();
        return;
      }

      if (this.isCancelled) return;

      // Stage 4: Metadata Extraction
      item.status = 'extracting';
      item.progress = 60;
      this.notify();

      const metadata = await extractAudioMetadata(item.file);

      if (this.isCancelled) return;

      // Stage 5: Local Storage Persistence
      item.status = 'saving';
      item.progress = 85;
      this.notify();

      const now = new Date().toISOString();
      const audioId = `audio-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const record: StoredAudioFile = {
        id: audioId,
        user_id: this.userId,
        filename: item.file.name,
        original_name: item.file.name,
        file_size_bytes: item.file.size,
        mime_type: validation.normalizedMime,
        file_hash: hash,
        duration_ms: metadata.durationMs,
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        genre: metadata.genre,
        genres: metadata.genres,
        track_number: metadata.trackNumber,
        disc_number: metadata.discNumber,
        year: metadata.year,
        bitrate_kbps: metadata.bitrateKbps,
        sample_rate_hz: metadata.sampleRateHz,
        channels: metadata.channels,
        codec: metadata.codec,
        artwork_data_url: metadata.artworkDataUrl,
        album_artist: metadata.albumArtist || null,
        comments: null,
        original_metadata: {
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album,
          genre: metadata.genre,
          year: metadata.year,
          track_number: metadata.trackNumber,
        },
        blob: item.file,
        created_at: now,
        updated_at: now,
      };

      const saved = await AudioRepository.saveAudioFile(record);

      item.status = 'completed';
      item.progress = 100;
      item.result = saved;
      this.notify();
    } catch (err: unknown) {
      item.status = 'error';
      item.progress = 100;
      item.error = err instanceof Error ? err.message : 'Unknown audio processing error.';
      this.notify();
    }
  }
}
