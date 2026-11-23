/**
 * Phase 5 — Collection Context & Hook
 * 
 * Provides reactive management of user custom playlists and audio collections.
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { CustomCollection } from '../types';
import { CollectionRepository } from '../lib/collections/collectionRepository';
import { useAuth } from './AuthContext';

interface CollectionContextType {
  collections: CustomCollection[];
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
  activeCollection: CustomCollection | null;
  createCollection: (name: string, description?: string) => Promise<CustomCollection>;
  updateCollection: (id: string, name: string, description?: string) => Promise<CustomCollection>;
  deleteCollection: (id: string) => Promise<void>;
  addTrackToCollection: (collectionId: string, audioFileId: string) => Promise<void>;
  removeTrackFromCollection: (collectionId: string, audioFileId: string) => Promise<void>;
  refreshCollections: () => Promise<void>;
}

const CollectionContext = createContext<CollectionContextType | undefined>(undefined);

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id || 'local-user';

  const [collections, setCollections] = useState<CustomCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const refreshCollections = useCallback(async () => {
    try {
      const list = await CollectionRepository.getCollections(userId);
      setCollections(list);
    } catch (err) {
      console.error('[PlaylistVault] Failed to load collections:', err);
    }
  }, [userId]);

  useEffect(() => {
    refreshCollections();
  }, [refreshCollections]);

  const activeCollection = useMemo(() => {
    if (!selectedCollectionId) return null;
    return collections.find((c) => c.id === selectedCollectionId) || null;
  }, [collections, selectedCollectionId]);

  const createCollection = useCallback(
    async (name: string, description?: string) => {
      const created = await CollectionRepository.createCollection(userId, name, description);
      setCollections((prev) => [...prev, created]);
      setSelectedCollectionId(created.id);
      return created;
    },
    [userId]
  );

  const updateCollection = useCallback(
    async (id: string, name: string, description?: string) => {
      const updated = await CollectionRepository.updateCollection(id, { name, description });
      setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    },
    []
  );

  const deleteCollection = useCallback(
    async (id: string) => {
      await CollectionRepository.deleteCollection(id);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (selectedCollectionId === id) {
        setSelectedCollectionId(null);
      }
    },
    [selectedCollectionId]
  );

  const addTrackToCollection = useCallback(
    async (collectionId: string, audioFileId: string) => {
      const updated = await CollectionRepository.addTrackToCollection(collectionId, audioFileId);
      setCollections((prev) => prev.map((c) => (c.id === collectionId ? updated : c)));
    },
    []
  );

  const removeTrackFromCollection = useCallback(
    async (collectionId: string, audioFileId: string) => {
      const updated = await CollectionRepository.removeTrackFromCollection(collectionId, audioFileId);
      setCollections((prev) => prev.map((c) => (c.id === collectionId ? updated : c)));
    },
    []
  );

  const value = {
    collections,
    selectedCollectionId,
    setSelectedCollectionId,
    activeCollection,
    createCollection,
    updateCollection,
    deleteCollection,
    addTrackToCollection,
    removeTrackFromCollection,
    refreshCollections,
  };

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection() {
  const context = useContext(CollectionContext);
  if (!context) {
    throw new Error('useCollection must be used within a CollectionProvider');
  }
  return context;
}
