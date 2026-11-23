/**
 * Phase 7 — Export Context & History State Management (Enhanced)
 * 
 * Manages live ZIP generation state, cancellation signals, progress updates,
 * persistent history synchronization, cloud backups (Supabase Storage), and signed download URLs.
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { ExportHistoryRepository } from '../lib/export/exportHistoryRepository';
import { CloudBackupService } from '../lib/cloud/cloudBackupService';
import {
  buildZipArchive,
  saveZipToDisk,
  ZipExportCancelledError,
} from '../lib/export/zipBuilder';
import {
  ExportHistoryRecord,
  ExportOptionsConfig,
  ExportProgress,
  ExportTrackItem,
  HistoryFilterOptions,
} from '../lib/export/types';

interface ExportContextType {
  history: ExportHistoryRecord[];
  isLoadingHistory: boolean;
  activeProgress: ExportProgress | null;
  isExporting: boolean;
  isCloudUploading: boolean;
  startExport: (options: {
    tracks: ExportTrackItem[];
    config: ExportOptionsConfig;
  }) => Promise<{ success: boolean; exportId?: string; error?: string }>;
  cancelExport: () => void;
  refreshHistory: (filterOptions?: HistoryFilterOptions) => Promise<void>;
  deleteHistoryItem: (id: string) => Promise<void>;
  bulkDeleteHistory: (ids: string[]) => Promise<void>;
  clearAllHistory: () => Promise<void>;
  backupArchiveToCloud: (
    recordId: string
  ) => Promise<{ success: boolean; storagePath?: string; error?: string }>;
  getCloudDownloadUrl: (
    storagePath: string
  ) => Promise<{ success: boolean; signedUrl?: string; error?: string }>;
  deleteCloudBackup: (
    recordId: string,
    storagePath: string
  ) => Promise<{ success: boolean; error?: string }>;
}

const ExportContext = createContext<ExportContextType | undefined>(undefined);

export function ExportProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id || 'local-user';

  const [history, setHistory] = useState<ExportHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeProgress, setActiveProgress] = useState<ExportProgress | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCloudUploading, setIsCloudUploading] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const cachedBlobsRef = useRef<Map<string, Blob>>(new Map());

  // Load persistent history with optional filter/search/sort
  const refreshHistory = useCallback(
    async (filterOptions?: HistoryFilterOptions) => {
      setIsLoadingHistory(true);
      try {
        const records = filterOptions
          ? await ExportHistoryRepository.searchHistory(userId, filterOptions)
          : await ExportHistoryRepository.getHistory(userId);
        setHistory(records);
      } catch (err) {
        console.warn('[PlaylistVault] Failed to load export history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // Cancel currently running export
  const cancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setActiveProgress((prev) =>
        prev
          ? {
              ...prev,
              phase: 'cancelled',
              message: 'Export was cancelled by the user.',
            }
          : null
      );
      setIsExporting(false);
    }
  }, []);

  // Start ZIP archive generation and file save
  const startExport = useCallback(
    async (options: {
      tracks: ExportTrackItem[];
      config: ExportOptionsConfig;
    }): Promise<{ success: boolean; exportId?: string; error?: string }> => {
      const { tracks, config } = options;

      setIsExporting(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setActiveProgress({
        phase: 'validating',
        processedCount: 0,
        totalCount: tracks.length,
        percent: 0,
        message: 'Validating audio binaries...',
      });

      const exportId = `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const formatsSet = new Set<string>();
      tracks.forEach((t) => {
        if (t.codec) formatsSet.add(t.codec.toUpperCase());
      });

      try {
        // 1. Build the actual ZIP archive
        const { blob, filename, sizeBytes } = await buildZipArchive({
          tracks,
          config,
          signal: controller.signal,
          onProgress: (progress) => {
            setActiveProgress(progress);
          },
        });

        // Cache the generated blob in session memory for optional cloud backup
        cachedBlobsRef.current.set(exportId, blob);

        // 2. Prompt user and save to disk
        setActiveProgress({
          phase: 'saving',
          processedCount: tracks.length,
          totalCount: tracks.length,
          percent: 98,
          message: 'Saving archive to disk...',
        });

        const saveResult = await saveZipToDisk(blob, filename);

        // 3. Record successful export in history
        const historyRecord: ExportHistoryRecord = {
          id: exportId,
          userId,
          archiveName: saveResult.savedFilename,
          sourceType: config.sourceType,
          sourceId: config.sourceId,
          sourceName: config.sourceName,
          totalTracks: tracks.length,
          matchedAudioCount: tracks.filter(
            (t) => t.status === 'ready' || t.status === 'duplicate_audio'
          ).length,
          totalSizeBytes: sizeBytes,
          formatsIncluded: Array.from(formatsSet),
          folderStructure: config.folderStructure,
          status: 'completed',
          createdAt: new Date().toISOString(),
          downloaded: true,
          manifestSnapshot: {
            totalTracks: tracks.length,
            totalDurationMs: tracks.reduce((sum, t) => sum + (t.durationMs || 0), 0),
            formats: Array.from(formatsSet),
            tracksPreview: tracks.slice(0, 10).map((t) => ({ title: t.title, artist: t.artist })),
          },
        };

        await ExportHistoryRepository.recordExport(historyRecord);
        await refreshHistory();

        setActiveProgress({
          phase: 'complete',
          processedCount: tracks.length,
          totalCount: tracks.length,
          percent: 100,
          message: `Archive "${saveResult.savedFilename}" successfully saved!`,
        });

        setIsExporting(false);
        abortControllerRef.current = null;
        return { success: true, exportId };
      } catch (err: any) {
        setIsExporting(false);
        abortControllerRef.current = null;

        if (err instanceof ZipExportCancelledError) {
          setActiveProgress({
            phase: 'cancelled',
            processedCount: 0,
            totalCount: tracks.length,
            percent: 0,
            message: 'Export was cancelled.',
          });
          return { success: false, error: 'Export was cancelled.' };
        }

        const errorMsg = err?.message || 'An unexpected error occurred during export.';
        setActiveProgress({
          phase: 'error',
          processedCount: 0,
          totalCount: tracks.length,
          percent: 0,
          message: errorMsg,
          error: errorMsg,
        });

        // Record failed export
        const failedRecord: ExportHistoryRecord = {
          id: exportId,
          userId,
          archiveName: `${config.sourceName}.zip`,
          sourceType: config.sourceType,
          sourceId: config.sourceId,
          sourceName: config.sourceName,
          totalTracks: tracks.length,
          matchedAudioCount: 0,
          totalSizeBytes: 0,
          formatsIncluded: Array.from(formatsSet),
          folderStructure: config.folderStructure,
          status: 'failed',
          createdAt: new Date().toISOString(),
          downloaded: false,
        };
        await ExportHistoryRepository.recordExport(failedRecord);
        await refreshHistory();

        return { success: false, error: errorMsg };
      }
    },
    [userId, refreshHistory]
  );

  // Upload an archive to private Supabase Cloud Storage
  const backupArchiveToCloud = useCallback(
    async (recordId: string): Promise<{ success: boolean; storagePath?: string; error?: string }> => {
      const record = history.find((r) => r.id === recordId);
      if (!record) {
        return { success: false, error: 'Export record not found.' };
      }

      const cachedBlob = cachedBlobsRef.current.get(recordId);
      if (!cachedBlob) {
        return {
          success: false,
          error:
            'Archive binary is no longer in active browser memory. Please regenerate the archive to upload it to cloud storage.',
        };
      }

      setIsCloudUploading(true);
      try {
        const result = await CloudBackupService.uploadArchive({
          userId,
          archiveId: record.id,
          filename: record.archiveName,
          blob: cachedBlob,
        });

        if (!result.success || !result.storagePath) {
          setIsCloudUploading(false);
          return { success: false, error: result.error || 'Cloud backup failed.' };
        }

        // Update record in repository
        await ExportHistoryRepository.updateRecord(recordId, {
          cloudStoragePath: result.storagePath,
          cloudSyncedAt: new Date().toISOString(),
          cloudSizeBytes: result.sizeBytes,
        });

        await refreshHistory();
        setIsCloudUploading(false);
        return { success: true, storagePath: result.storagePath };
      } catch (err: any) {
        setIsCloudUploading(false);
        return { success: false, error: err?.message || 'Error uploading archive to cloud.' };
      }
    },
    [history, userId, refreshHistory]
  );

  // Generate temporary signed download URL for cloud backup
  const getCloudDownloadUrl = useCallback(
    async (storagePath: string): Promise<{ success: boolean; signedUrl?: string; error?: string }> => {
      return CloudBackupService.getSignedDownloadUrl(userId, storagePath);
    },
    [userId]
  );

  // Delete cloud backup
  const deleteCloudBackup = useCallback(
    async (recordId: string, storagePath: string): Promise<{ success: boolean; error?: string }> => {
      const result = await CloudBackupService.deleteArchive(userId, storagePath);
      if (result.success) {
        await ExportHistoryRepository.updateRecord(recordId, {
          cloudStoragePath: undefined,
          cloudSyncedAt: undefined,
          cloudSizeBytes: undefined,
        });
        await refreshHistory();
      }
      return result;
    },
    [userId, refreshHistory]
  );

  const deleteHistoryItem = useCallback(
    async (id: string) => {
      cachedBlobsRef.current.delete(id);
      await ExportHistoryRepository.deleteRecord(id);
      await refreshHistory();
    },
    [refreshHistory]
  );

  const bulkDeleteHistory = useCallback(
    async (ids: string[]) => {
      ids.forEach((id) => cachedBlobsRef.current.delete(id));
      await ExportHistoryRepository.bulkDelete(ids);
      await refreshHistory();
    },
    [refreshHistory]
  );

  const clearAllHistory = useCallback(async () => {
    cachedBlobsRef.current.clear();
    await ExportHistoryRepository.clearHistory(userId);
    await refreshHistory();
  }, [userId, refreshHistory]);

  const value = {
    history,
    isLoadingHistory,
    activeProgress,
    isExporting,
    isCloudUploading,
    startExport,
    cancelExport,
    refreshHistory,
    deleteHistoryItem,
    bulkDeleteHistory,
    clearAllHistory,
    backupArchiveToCloud,
    getCloudDownloadUrl,
    deleteCloudBackup,
  };

  return <ExportContext.Provider value={value}>{children}</ExportContext.Provider>;
}

export function useExport() {
  const context = useContext(ExportContext);
  if (!context) {
    throw new Error('useExport must be used within an ExportProvider');
  }
  return context;
}
