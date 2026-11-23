/**
 * Phase 3 — Local Audio Storage via Browser IndexedDB
 * 
 * Persists binary audio files (Blobs) and extracted metadata locally
 * in the user's browser, completely independent of Supabase or internet connectivity.
 */

import { StoredAudioFile } from './types';

const DB_NAME = 'PlaylistVault_AudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'audio_files';

let dbInstance: IDBDatabase | null = null;

// In-memory fallback map for environments where IndexedDB is unavailable (e.g. testing)
const memoryFallback = new Map<string, StoredAudioFile>();

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

/**
 * Initializes and opens the IndexedDB database.
 */
export function openAudioDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) {
    return Promise.resolve(null);
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('file_hash', 'file_hash', { unique: false });
        store.createIndex('user_id', 'user_id', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
        store.createIndex('genre', 'genre', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('[PlaylistVault] Failed to open IndexedDB:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Saves a binary audio file record with metadata to IndexedDB.
 */
export async function saveAudioRecord(record: StoredAudioFile): Promise<StoredAudioFile> {
  const db = await openAudioDatabase();

  if (!db) {
    memoryFallback.set(record.id, record);
    return record;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves a single audio record by ID.
 */
export async function getAudioRecord(id: string): Promise<StoredAudioFile | null> {
  const db = await openAudioDatabase();

  if (!db) {
    return memoryFallback.get(id) || null;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Finds an existing audio file by its SHA-256 content hash (for duplicate detection).
 */
export async function getAudioRecordByHash(hash: string): Promise<StoredAudioFile | null> {
  const db = await openAudioDatabase();

  if (!db) {
    for (const item of memoryFallback.values()) {
      if (item.file_hash === hash) return item;
    }
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('file_hash');
    const request = index.get(hash);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves all stored audio records, optionally filtered by user ID.
 */
export async function getAllAudioRecords(userId?: string): Promise<StoredAudioFile[]> {
  const db = await openAudioDatabase();

  if (!db) {
    const items = Array.from(memoryFallback.values());
    if (userId) return items.filter((f) => f.user_id === userId);
    return items;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records: StoredAudioFile[] = request.result || [];
      if (userId) {
        resolve(records.filter((r) => r.user_id === userId));
      } else {
        resolve(records);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Updates metadata fields of an existing audio file record.
 */
export async function updateAudioRecordMetadata(
  id: string,
  updates: Partial<Omit<StoredAudioFile, 'id' | 'blob' | 'file_hash' | 'file_size_bytes'>>
): Promise<StoredAudioFile> {
  const existing = await getAudioRecord(id);
  if (!existing) {
    throw new Error(`Audio file with ID "${id}" not found.`);
  }

  const updated: StoredAudioFile = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  return saveAudioRecord(updated);
}

/**
 * Deletes an audio record and its binary blob from IndexedDB.
 */
export async function deleteAudioRecord(id: string): Promise<void> {
  const db = await openAudioDatabase();

  if (!db) {
    memoryFallback.delete(id);
    return;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clears all audio records from IndexedDB (e.g. for testing or reset).
 */
export async function clearAllAudioRecords(): Promise<void> {
  const db = await openAudioDatabase();

  if (!db) {
    memoryFallback.clear();
    return;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Computes storage statistics: count of files and total size in bytes.
 */
export async function getAudioStorageUsage(userId?: string): Promise<{ count: number; totalBytes: number }> {
  const records = await getAllAudioRecords(userId);
  const totalBytes = records.reduce((sum, r) => sum + (r.file_size_bytes || 0), 0);
  return {
    count: records.length,
    totalBytes,
  };
}
