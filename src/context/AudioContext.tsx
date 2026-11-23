/**
 * Phase 3 — Audio Library Context & Hook
 * 
 * Provides centralized reactive state for uploaded audio files, batch processing queue,
 * metadata updates, deletion, and local storage statistics.
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { StoredAudioFile, UploadQueueItem, AudioStorageStats } from '../lib/audio/types';
import { AudioRepository } from '../lib/audio/audioRepository';
import { AudioUploadQueue } from '../lib/audio/uploadQueue';
import { useAuth } from './AuthContext';

interface AudioContextType {
  audioFiles: StoredAudioFile[];
  isLoading: boolean;
  queue: UploadQueueItem[];
  storageStats: AudioStorageStats;
  importAudioFiles: (files: FileList | File[]) => void;
  cancelUploads: () => void;
  clearCompletedUploads: () => void;
  deleteAudioFile: (id: string) => Promise<void>;
  updateAudioMetadata: (
    id: string,
    updates: Partial<Omit<StoredAudioFile, 'id' | 'blob' | 'file_hash' | 'file_size_bytes'>>
  ) => Promise<StoredAudioFile>;
  refreshAudioFiles: () => Promise<void>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id || 'local-user';

  const [audioFiles, setAudioFiles] = useState<StoredAudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);

  // Initialize upload queue instance
  const uploadQueue = useMemo(() => new AudioUploadQueue(userId), [userId]);

  // Load audio files from IndexedDB on mount / user change
  const refreshAudioFiles = useCallback(async () => {
    try {
      const records = await AudioRepository.getAll(userId);
      setAudioFiles(records);
    } catch (err) {
      console.error('[PlaylistVault] Failed to load audio files from storage:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshAudioFiles();
  }, [refreshAudioFiles]);

  // Subscribe to upload queue changes
  useEffect(() => {
    const unsubscribe = uploadQueue.subscribe((items) => {
      setQueue(items);

      // Check if any item completed and update audioFiles list
      const hasCompleted = items.some((i) => i.status === 'completed');
      if (hasCompleted) {
        refreshAudioFiles();
      }
    });

    return unsubscribe;
  }, [uploadQueue, refreshAudioFiles]);

  const importAudioFiles = useCallback(
    (files: FileList | File[]) => {
      uploadQueue.addFiles(files);
    },
    [uploadQueue]
  );

  const cancelUploads = useCallback(() => {
    uploadQueue.cancelQueue();
  }, [uploadQueue]);

  const clearCompletedUploads = useCallback(() => {
    uploadQueue.clearCompleted();
  }, [uploadQueue]);

  const deleteAudioFile = useCallback(
    async (id: string) => {
      await AudioRepository.delete(id);
      setAudioFiles((prev) => prev.filter((item) => item.id !== id));
    },
    []
  );

  const updateAudioMetadata = useCallback(
    async (
      id: string,
      updates: Partial<Omit<StoredAudioFile, 'id' | 'blob' | 'file_hash' | 'file_size_bytes'>>
    ) => {
      const updated = await AudioRepository.updateMetadata(id, updates);
      setAudioFiles((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return updated;
    },
    []
  );

  // Compute storage statistics
  const storageStats = useMemo<AudioStorageStats>(() => {
    const totalBytes = audioFiles.reduce((acc, f) => acc + (f.file_size_bytes || 0), 0);
    const artists = new Set(audioFiles.map((f) => f.artist.toLowerCase()).filter(Boolean));
    const genres = new Set(audioFiles.map((f) => f.genre.toLowerCase()).filter(Boolean));

    const formatsBreakdown: Record<string, number> = {};
    audioFiles.forEach((f) => {
      const ext = f.filename.split('.').pop()?.toUpperCase() || 'UNKNOWN';
      formatsBreakdown[ext] = (formatsBreakdown[ext] || 0) + 1;
    });

    return {
      totalFiles: audioFiles.length,
      totalBytes,
      uniqueArtists: artists.size,
      uniqueGenres: genres.size,
      formatsBreakdown,
    };
  }, [audioFiles]);

  const value = {
    audioFiles,
    isLoading,
    queue,
    storageStats,
    importAudioFiles,
    cancelUploads,
    clearCompletedUploads,
    deleteAudioFile,
    updateAudioMetadata,
    refreshAudioFiles,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
