/**
 * Phase 7 — Local Storage Management & Browser Quota Service
 * 
 * Inspects browser storage quotas (navigator.storage.estimate), persistent storage flags,
 * audits storage consumption across IndexedDB, collections, and export history,
 * identifies and purges orphaned metadata records, and enforces safe deletion.
 */

import { AudioRepository } from '../audio/audioRepository';
import { CollectionRepository } from '../collections/collectionRepository';
import { ExportHistoryRepository } from '../export/exportHistoryRepository';
import { TrackMatch } from '../../types';

export interface StorageQuotaInfo {
  usageBytes: number;
  quotaBytes: number;
  remainingBytes: number;
  usagePercentage: number;
  isPersistent: boolean;
  isSupported: boolean;
}

export interface StorageBreakdownInfo {
  audioFilesCount: number;
  audioFilesBytes: number;
  collectionsCount: number;
  collectionsBytes: number;
  historyCount: number;
  historyBytes: number;
  totalLocalBytes: number;
}

export interface OrphanInspectionResult {
  orphanedMatchesCount: number;
  orphanedCollectionItemsCount: number;
  orphanedMatches: TrackMatch[];
  orphanedCollectionReferences: {
    collectionId: string;
    collectionName: string;
    missingAudioFileId: string;
  }[];
}

export class LocalStorageManager {
  /**
   * Retrieves browser storage quota and usage information via the StorageManager API.
   */
  static async getStorageQuota(): Promise<StorageQuotaInfo> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usageBytes = estimate.usage || 0;
        const quotaBytes = estimate.quota || 0;
        const remainingBytes = Math.max(0, quotaBytes - usageBytes);
        const usagePercentage = quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0;

        let isPersistent = false;
        if (navigator.storage.persisted) {
          isPersistent = await navigator.storage.persisted();
        }

        return {
          usageBytes,
          quotaBytes,
          remainingBytes,
          usagePercentage: Math.min(100, Math.round(usagePercentage * 10) / 10),
          isPersistent,
          isSupported: true,
        };
      } catch (err) {
        console.warn('[PlaylistVault] Failed to retrieve storage quota estimate:', err);
      }
    }

    return {
      usageBytes: 0,
      quotaBytes: 0,
      remainingBytes: 0,
      usagePercentage: 0,
      isPersistent: false,
      isSupported: false,
    };
  }

  /**
   * Requests persistent storage permission from the browser.
   */
  static async requestPersistentStorage(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        return await navigator.storage.persist();
      } catch (err) {
        console.warn('[PlaylistVault] Storage persistence request rejected or failed:', err);
      }
    }
    return false;
  }

  /**
   * Computes an accurate breakdown of local storage consumption.
   */
  static async getStorageBreakdown(userId: string): Promise<StorageBreakdownInfo> {
    // 1. IndexedDB Audio Files stats
    const audioStats = await AudioRepository.getStorageStats(userId);

    // 2. Collections footprint in localStorage
    const collections = await CollectionRepository.getCollections(userId);
    const collectionsBytes = new Blob([JSON.stringify(collections)]).size;

    // 3. Export History footprint in localStorage
    const history = await ExportHistoryRepository.getHistory(userId);
    const historyBytes = new Blob([JSON.stringify(history)]).size;

    return {
      audioFilesCount: audioStats.count,
      audioFilesBytes: audioStats.totalBytes,
      collectionsCount: collections.length,
      collectionsBytes,
      historyCount: history.length,
      historyBytes,
      totalLocalBytes: audioStats.totalBytes + collectionsBytes + historyBytes,
    };
  }

  /**
   * Audits database and storage to identify orphaned references pointing to deleted audio files.
   */
  static async inspectOrphanedRecords(userId: string): Promise<OrphanInspectionResult> {
    const allAudio = await AudioRepository.getAll(userId);
    const audioIdSet = new Set(allAudio.map((a) => a.id));

    // Audit Matches
    let allMatches: TrackMatch[] = [];
    try {
      const rawMatches = localStorage.getItem('pv_track_matches_data');
      allMatches = rawMatches ? JSON.parse(rawMatches) : [];
    } catch {
      allMatches = [];
    }

    const orphanedMatches = allMatches.filter(
      (m) => m.audio_file_id && !audioIdSet.has(m.audio_file_id)
    );

    // Audit Collections
    const collections = await CollectionRepository.getCollections(userId);
    const orphanedCollectionReferences: {
      collectionId: string;
      collectionName: string;
      missingAudioFileId: string;
    }[] = [];

    collections.forEach((col) => {
      col.audio_file_ids.forEach((id) => {
        if (!audioIdSet.has(id)) {
          orphanedCollectionReferences.push({
            collectionId: col.id,
            collectionName: col.name,
            missingAudioFileId: id,
          });
        }
      });
    });

    return {
      orphanedMatchesCount: orphanedMatches.length,
      orphanedCollectionItemsCount: orphanedCollectionReferences.length,
      orphanedMatches,
      orphanedCollectionReferences,
    };
  }

  /**
   * Safely cleans up all identified orphaned match records and collection references.
   */
  static async cleanupOrphanedRecords(userId: string): Promise<{ cleanedMatches: number; cleanedRefs: number }> {
    const inspection = await this.inspectOrphanedRecords(userId);

    // 1. Purge orphaned matches from local storage
    if (inspection.orphanedMatches.length > 0) {
      try {
        const rawMatches = localStorage.getItem('pv_track_matches_data');
        const allMatches: TrackMatch[] = rawMatches ? JSON.parse(rawMatches) : [];
        const orphanIds = new Set(inspection.orphanedMatches.map((m) => m.id));
        const cleaned = allMatches.filter((m) => !orphanIds.has(m.id));
        localStorage.setItem('pv_track_matches_data', JSON.stringify(cleaned));
      } catch (err) {
        console.warn('[PlaylistVault] Failed to clean orphaned matches from localStorage:', err);
      }
    }

    // 2. Purge missing track IDs from collections
    if (inspection.orphanedCollectionReferences.length > 0) {
      for (const ref of inspection.orphanedCollectionReferences) {
        try {
          await CollectionRepository.removeTrackFromCollection(ref.collectionId, ref.missingAudioFileId);
        } catch {
          // ignore if already removed
        }
      }
    }

    return {
      cleanedMatches: inspection.orphanedMatchesCount,
      cleanedRefs: inspection.orphanedCollectionItemsCount,
    };
  }

  /**
   * Safely deletes an audio file, cleans up associated match records and collection memberships,
   * while enforcing protection against deleting currently playing tracks without confirmation.
   */
  static async safeDeleteAudioFile(
    audioFileId: string,
    currentPlayingAudioId?: string | null,
    force = false
  ): Promise<{ success: boolean; error?: string }> {
    if (!force && currentPlayingAudioId && currentPlayingAudioId === audioFileId) {
      return {
        success: false,
        error: 'Cannot delete audio file while it is currently playing in the active audio player.',
      };
    }

    try {
      // 1. Delete from IndexedDB and Supabase audio_files
      await AudioRepository.delete(audioFileId);

      // 2. Remove any matches pointing to this audio file
      try {
        const rawMatches = localStorage.getItem('pv_track_matches_data');
        if (rawMatches) {
          const allMatches: TrackMatch[] = JSON.parse(rawMatches);
          const cleaned = allMatches.filter((m) => m.audio_file_id !== audioFileId);
          localStorage.setItem('pv_track_matches_data', JSON.stringify(cleaned));
        }
      } catch {
        // ignore
      }

      // 3. Remove from any custom collections
      try {
        const rawCols = localStorage.getItem('pv_custom_collections');
        if (rawCols) {
          const allCols = JSON.parse(rawCols);
          const cleanedCols = allCols.map((c: any) => ({
            ...c,
            audio_file_ids: (c.audio_file_ids || []).filter((id: string) => id !== audioFileId),
          }));
          localStorage.setItem('pv_custom_collections', JSON.stringify(cleanedCols));
        }
      } catch {
        // ignore
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to delete audio file.',
      };
    }
  }
}
