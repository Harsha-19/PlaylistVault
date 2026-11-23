/**
 * Phase 5 — Custom Collections & Local Playlists Persistence Repository
 * 
 * Allows users to organize their local audio library into custom playlists/collections
 * with full offline persistence.
 */

import { CustomCollection } from '../../types';

const COLLECTIONS_STORAGE_KEY = 'pv_custom_collections';

function getStoredCollections(): CustomCollection[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredCollections(collections: CustomCollection[]) {
  try {
    localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(collections));
  } catch (err) {
    console.warn('[PlaylistVault] Failed to save collections to local storage:', err);
  }
}

export class CollectionRepository {
  /**
   * Retrieves all collections for a user.
   */
  static async getCollections(userId: string): Promise<CustomCollection[]> {
    const all = getStoredCollections();
    return all.filter((c) => c.user_id === userId);
  }

  /**
   * Retrieves a single collection by ID.
   */
  static async getById(id: string): Promise<CustomCollection | null> {
    const all = getStoredCollections();
    return all.find((c) => c.id === id) || null;
  }

  /**
   * Creates a new collection.
   */
  static async createCollection(
    userId: string,
    name: string,
    description?: string
  ): Promise<CustomCollection> {
    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error('Collection name cannot be empty.');
    }

    const now = new Date().toISOString();
    const newCollection: CustomCollection = {
      id: `coll-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId,
      name: cleanName,
      description: description?.trim() || undefined,
      audio_file_ids: [],
      created_at: now,
      updated_at: now,
    };

    const all = getStoredCollections();
    all.push(newCollection);
    saveStoredCollections(all);

    return newCollection;
  }

  /**
   * Updates collection name or description.
   */
  static async updateCollection(
    id: string,
    updates: Partial<Pick<CustomCollection, 'name' | 'description'>>
  ): Promise<CustomCollection> {
    const all = getStoredCollections();
    const index = all.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error(`Collection with ID "${id}" not found.`);
    }

    const existing = all[index];
    const updated: CustomCollection = {
      ...existing,
      ...updates,
      name: updates.name ? updates.name.trim() : existing.name,
      description: updates.description !== undefined ? updates.description.trim() : existing.description,
      updated_at: new Date().toISOString(),
    };

    all[index] = updated;
    saveStoredCollections(all);

    return updated;
  }

  /**
   * Deletes a collection.
   */
  static async deleteCollection(id: string): Promise<void> {
    const all = getStoredCollections();
    const filtered = all.filter((c) => c.id !== id);
    saveStoredCollections(filtered);
  }

  /**
   * Adds an audio file to a collection.
   */
  static async addTrackToCollection(collectionId: string, audioFileId: string): Promise<CustomCollection> {
    const all = getStoredCollections();
    const index = all.findIndex((c) => c.id === collectionId);
    if (index === -1) {
      throw new Error(`Collection with ID "${collectionId}" not found.`);
    }

    const existing = all[index];
    if (!existing.audio_file_ids.includes(audioFileId)) {
      existing.audio_file_ids.push(audioFileId);
      existing.updated_at = new Date().toISOString();
      all[index] = existing;
      saveStoredCollections(all);
    }

    return existing;
  }

  /**
   * Removes an audio file from a collection.
   */
  static async removeTrackFromCollection(
    collectionId: string,
    audioFileId: string
  ): Promise<CustomCollection> {
    const all = getStoredCollections();
    const index = all.findIndex((c) => c.id === collectionId);
    if (index === -1) {
      throw new Error(`Collection with ID "${collectionId}" not found.`);
    }

    const existing = all[index];
    existing.audio_file_ids = existing.audio_file_ids.filter((id) => id !== audioFileId);
    existing.updated_at = new Date().toISOString();
    all[index] = existing;
    saveStoredCollections(all);

    return existing;
  }
}
