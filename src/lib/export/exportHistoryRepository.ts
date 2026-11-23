/**
 * Phase 7 — Export History Repository (Enhanced)
 * 
 * Manages persistent export history records with offline-first localStorage,
 * rich filtering/search/sorting, cloud backup state tracking, and Supabase mirroring.
 */

import { supabase, isSupabaseConfigured } from '../supabase';
import { ExportHistoryRecord, HistoryFilterOptions } from './types';

const EXPORT_HISTORY_STORAGE_KEY = 'pv_export_history';

function getStoredHistory(): ExportHistoryRecord[] {
  try {
    const raw = localStorage.getItem(EXPORT_HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredHistory(history: ExportHistoryRecord[]) {
  try {
    localStorage.setItem(EXPORT_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.warn('[PlaylistVault] Failed to save export history to local storage:', err);
  }
}

export class ExportHistoryRepository {
  /**
   * Retrieves all export history records for a user, sorted newest first.
   */
  static async getHistory(userId: string): Promise<ExportHistoryRecord[]> {
    const all = getStoredHistory();
    const userRecords = all.filter((r) => r.userId === userId);
    return userRecords.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Searches, filters, and sorts export history records according to specified criteria.
   */
  static async searchHistory(
    userId: string,
    options: HistoryFilterOptions = {}
  ): Promise<ExportHistoryRecord[]> {
    const all = await this.getHistory(userId);
    const { query, status, sortBy = 'newest', dateRange } = options;

    return all
      .filter((record) => {
        // Search query filter
        if (query && query.trim()) {
          const q = query.toLowerCase().trim();
          const matchesName = record.archiveName.toLowerCase().includes(q);
          const matchesSource = record.sourceName.toLowerCase().includes(q);
          if (!matchesName && !matchesSource) return false;
        }

        // Status filter
        if (status && status !== 'all') {
          if (status === 'cloud_backed') {
            if (!record.cloudStoragePath) return false;
          } else if (record.status !== status) {
            return false;
          }
        }

        // Date range filter
        if (dateRange?.start) {
          const startTime = new Date(dateRange.start).getTime();
          if (new Date(record.createdAt).getTime() < startTime) return false;
        }
        if (dateRange?.end) {
          const endTime = new Date(dateRange.end).getTime();
          if (new Date(record.createdAt).getTime() > endTime) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === 'size_desc') {
          return (b.totalSizeBytes || 0) - (a.totalSizeBytes || 0);
        }
        if (sortBy === 'tracks_desc') {
          return (b.totalTracks || 0) - (a.totalTracks || 0);
        }
        return 0;
      });
  }

  /**
   * Records a new export event.
   */
  static async recordExport(record: ExportHistoryRecord): Promise<ExportHistoryRecord> {
    const all = getStoredHistory();
    all.unshift(record);
    saveStoredHistory(all);

    // Mirror to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await supabase.from('export_archives').insert({
          id: record.id,
          user_id: record.userId,
          playlist_id: record.sourceType === 'spotify_playlist' ? record.sourceId : null,
          archive_name: record.archiveName,
          total_tracks: record.totalTracks,
          total_matched_audio: record.matchedAudioCount,
          total_size_bytes: record.totalSizeBytes,
          formats_included: record.formatsIncluded,
          storage_path: record.cloudStoragePath || `local://${record.archiveName}`,
          download_count: record.downloaded ? 1 : 0,
          status: record.status === 'completed' ? 'completed' : 'failed',
          created_at: record.createdAt,
        });
      } catch (err) {
        console.warn('[PlaylistVault] Failed to mirror export archive to Supabase:', err);
      }
    }

    return record;
  }

  /**
   * Updates an existing export record (e.g. adding cloud backup path or notes).
   */
  static async updateRecord(
    id: string,
    updates: Partial<ExportHistoryRecord>
  ): Promise<ExportHistoryRecord> {
    const all = getStoredHistory();
    const index = all.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Export record with ID "${id}" not found.`);
    }

    const updated = {
      ...all[index],
      ...updates,
    };
    all[index] = updated;
    saveStoredHistory(all);

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('export_archives')
          .update({
            storage_path: updated.cloudStoragePath || `local://${updated.archiveName}`,
            download_count: updated.downloaded ? 1 : 0,
            status: updated.status === 'completed' ? 'completed' : 'failed',
          })
          .eq('id', id);
      } catch (err) {
        console.warn('[PlaylistVault] Failed to update remote export archive record:', err);
      }
    }

    return updated;
  }

  /**
   * Deletes an individual export record.
   */
  static async deleteRecord(id: string): Promise<void> {
    const all = getStoredHistory();
    const filtered = all.filter((r) => r.id !== id);
    saveStoredHistory(filtered);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('export_archives').delete().eq('id', id);
      } catch (err) {
        console.warn('[PlaylistVault] Failed to delete export record from Supabase:', err);
      }
    }
  }

  /**
   * Deletes multiple export records in bulk.
   */
  static async bulkDelete(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const deleteSet = new Set(ids);
    const all = getStoredHistory();
    const filtered = all.filter((r) => !deleteSet.has(r.id));
    saveStoredHistory(filtered);

    if (isSupabaseConfigured) {
      try {
        for (const id of ids) {
          await supabase.from('export_archives').delete().eq('id', id);
        }
      } catch (err) {
        console.warn('[PlaylistVault] Failed to delete bulk export records from Supabase:', err);
      }
    }
  }

  /**
   * Clears all export history for a user.
   */
  static async clearHistory(userId: string): Promise<void> {
    const all = getStoredHistory();
    const filtered = all.filter((r) => r.userId !== userId);
    saveStoredHistory(filtered);
  }
}
