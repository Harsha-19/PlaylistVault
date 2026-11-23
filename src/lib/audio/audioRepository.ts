/**
 * Phase 3 — Unified Audio Repository
 * 
 * Coordinates local IndexedDB persistence (storing binary audio blobs and metadata)
 * with optional Supabase PostgreSQL sync (`audio_files` table) when configured.
 */

import { supabase, isSupabaseConfigured } from '../supabase';
import {
  saveAudioRecord,
  getAudioRecord,
  getAudioRecordByHash,
  getAllAudioRecords,
  updateAudioRecordMetadata,
  deleteAudioRecord,
  getAudioStorageUsage,
} from './indexedDb';
import { StoredAudioFile } from './types';

export class AudioRepository {
  /**
   * Persists an audio file locally in IndexedDB and mirrors metadata to Supabase if configured.
   */
  static async saveAudioFile(record: StoredAudioFile): Promise<StoredAudioFile> {
    // 1. Always persist binary audio and metadata to IndexedDB first (Local-First Architecture)
    const savedLocal = await saveAudioRecord(record);

    // 2. Optionally mirror metadata to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('audio_files').upsert(
          {
            id: savedLocal.id,
            user_id: savedLocal.user_id,
            filename: savedLocal.filename,
            original_name: savedLocal.original_name,
            file_size_bytes: savedLocal.file_size_bytes,
            mime_type: savedLocal.mime_type,
            file_hash: savedLocal.file_hash,
            duration_ms: savedLocal.duration_ms,
            title: savedLocal.title,
            artist: savedLocal.artist,
            album: savedLocal.album,
            genre: savedLocal.genre,
            year: savedLocal.year,
            bitrate_kbps: savedLocal.bitrate_kbps,
            sample_rate_hz: savedLocal.sample_rate_hz,
            channels: savedLocal.channels,
            storage_path: `indexeddb://${savedLocal.id}`,
            is_cloud_stored: false,
            created_at: savedLocal.created_at,
          },
          { onConflict: 'id' }
        );

        if (error) {
          console.warn('[PlaylistVault] Failed to mirror audio metadata to Supabase:', error.message);
        }
      } catch (err) {
        console.warn('[PlaylistVault] Supabase audio mirror skipped or failed:', err);
      }
    }

    return savedLocal;
  }

  /**
   * Retrieves an audio record by its content hash (for duplicate detection).
   */
  static async findByHash(hash: string): Promise<StoredAudioFile | null> {
    return getAudioRecordByHash(hash);
  }

  /**
   * Retrieves an audio record by ID.
   */
  static async getById(id: string): Promise<StoredAudioFile | null> {
    return getAudioRecord(id);
  }

  /**
   * Retrieves all audio records for the user.
   */
  static async getAll(userId?: string): Promise<StoredAudioFile[]> {
    return getAllAudioRecords(userId);
  }

  /**
   * Updates metadata for an audio file locally and in Supabase.
   */
  static async updateMetadata(
    id: string,
    updates: Partial<Omit<StoredAudioFile, 'id' | 'blob' | 'file_hash' | 'file_size_bytes'>>
  ): Promise<StoredAudioFile> {
    const updated = await updateAudioRecordMetadata(id, updates);

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('audio_files')
          .update({
            title: updated.title,
            artist: updated.artist,
            album: updated.album,
            genre: updated.genre,
            year: updated.year,
          })
          .eq('id', id);
      } catch (err) {
        console.warn('[PlaylistVault] Failed to update remote audio metadata:', err);
      }
    }

    return updated;
  }

  /**
   * Deletes an audio file record and its binary blob from local storage and Supabase.
   */
  static async delete(id: string): Promise<void> {
    await deleteAudioRecord(id);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('audio_files').delete().eq('id', id);
      } catch (err) {
        console.warn('[PlaylistVault] Failed to delete remote audio file record:', err);
      }
    }
  }

  /**
   * Gets total storage stats.
   */
  static async getStorageStats(userId?: string): Promise<{ count: number; totalBytes: number }> {
    return getAudioStorageUsage(userId);
  }
}
