import { describe, it, expect, beforeEach } from 'vitest';
import { CollectionRepository } from '../lib/collections/collectionRepository';

describe('CollectionRepository (Phase 5 Custom Collections)', () => {
  const userId = 'user-123';
  const otherUserId = 'user-456';

  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a new custom collection with valid attributes', async () => {
    const coll = await CollectionRepository.createCollection(
      userId,
      'Driving Vibes',
      'Upbeat tunes for the highway'
    );

    expect(coll.id).toBeDefined();
    expect(coll.id).toMatch(/^coll-/);
    expect(coll.user_id).toBe(userId);
    expect(coll.name).toBe('Driving Vibes');
    expect(coll.description).toBe('Upbeat tunes for the highway');
    expect(coll.audio_file_ids).toEqual([]);
    expect(coll.created_at).toBeDefined();
    expect(coll.updated_at).toBeDefined();
  });

  it('throws an error when creating a collection with an empty or whitespace name', async () => {
    await expect(CollectionRepository.createCollection(userId, '')).rejects.toThrow(
      'Collection name cannot be empty.'
    );
    await expect(CollectionRepository.createCollection(userId, '   ')).rejects.toThrow(
      'Collection name cannot be empty.'
    );
  });

  it('retrieves collections filtered by user_id', async () => {
    await CollectionRepository.createCollection(userId, 'User 1 Playlist A');
    await CollectionRepository.createCollection(userId, 'User 1 Playlist B');
    await CollectionRepository.createCollection(otherUserId, 'Other User Playlist');

    const userCollections = await CollectionRepository.getCollections(userId);
    expect(userCollections).toHaveLength(2);
    expect(userCollections.map((c) => c.name)).toEqual(['User 1 Playlist A', 'User 1 Playlist B']);

    const otherCollections = await CollectionRepository.getCollections(otherUserId);
    expect(otherCollections).toHaveLength(1);
    expect(otherCollections[0].name).toBe('Other User Playlist');
  });

  it('retrieves a collection by ID or returns null if not found', async () => {
    const created = await CollectionRepository.createCollection(userId, 'Chill Beats');
    const fetched = await CollectionRepository.getById(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.name).toBe('Chill Beats');

    const notFound = await CollectionRepository.getById('non-existent-id');
    expect(notFound).toBeNull();
  });

  it('updates collection name and description', async () => {
    const created = await CollectionRepository.createCollection(userId, 'Old Name', 'Old Desc');
    const updated = await CollectionRepository.updateCollection(created.id, {
      name: 'New Name',
      description: 'New Desc',
    });

    expect(updated.name).toBe('New Name');
    expect(updated.description).toBe('New Desc');

    const reFetched = await CollectionRepository.getById(created.id);
    expect(reFetched?.name).toBe('New Name');
    expect(reFetched?.description).toBe('New Desc');
  });

  it('throws an error when updating a non-existent collection', async () => {
    await expect(
      CollectionRepository.updateCollection('missing-id', { name: 'X' })
    ).rejects.toThrow('Collection with ID "missing-id" not found.');
  });

  it('adds audio files to collection and ignores duplicates', async () => {
    const created = await CollectionRepository.createCollection(userId, 'Rock Classics');

    const updated1 = await CollectionRepository.addTrackToCollection(created.id, 'audio-file-1');
    expect(updated1.audio_file_ids).toEqual(['audio-file-1']);

    const updated2 = await CollectionRepository.addTrackToCollection(created.id, 'audio-file-2');
    expect(updated2.audio_file_ids).toEqual(['audio-file-1', 'audio-file-2']);

    // Duplicate add should be idempotent
    const updated3 = await CollectionRepository.addTrackToCollection(created.id, 'audio-file-1');
    expect(updated3.audio_file_ids).toEqual(['audio-file-1', 'audio-file-2']);
  });

  it('removes audio files from collection', async () => {
    const created = await CollectionRepository.createCollection(userId, 'Gym Motivation');
    await CollectionRepository.addTrackToCollection(created.id, 'track-1');
    await CollectionRepository.addTrackToCollection(created.id, 'track-2');

    const afterRemoval = await CollectionRepository.removeTrackFromCollection(created.id, 'track-1');
    expect(afterRemoval.audio_file_ids).toEqual(['track-2']);

    const reFetched = await CollectionRepository.getById(created.id);
    expect(reFetched?.audio_file_ids).toEqual(['track-2']);
  });

  it('deletes a collection completely from storage', async () => {
    const created = await CollectionRepository.createCollection(userId, 'Temporary');
    expect(await CollectionRepository.getById(created.id)).not.toBeNull();

    await CollectionRepository.deleteCollection(created.id);
    expect(await CollectionRepository.getById(created.id)).toBeNull();
  });
});
