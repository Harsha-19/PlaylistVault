import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudBackupService, CLOUD_STORAGE_BUCKET } from '../lib/cloud/cloudBackupService';
import * as supabaseModule from '../lib/supabase';

describe('CloudBackupService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isAvailable', () => {
    it('returns false when Supabase is running in local unconfigured mode', () => {
      vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(false);
      expect(CloudBackupService.isAvailable()).toBe(false);
    });

    it('returns true when Supabase is properly configured', () => {
      vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);
      expect(CloudBackupService.isAvailable()).toBe(true);
    });
  });

  describe('uploadArchive', () => {
    it('returns failure when Supabase is not configured', async () => {
      vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(false);

      const result = await CloudBackupService.uploadArchive({
        userId: 'user_123',
        archiveId: 'arch_001',
        filename: 'MyArchive.zip',
        blob: new Blob(['mock-zip-bytes'], { type: 'application/zip' }),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('local resilient mode');
    });

    it('rejects uploads with local-user or empty user ID', async () => {
      vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);

      const resultLocal = await CloudBackupService.uploadArchive({
        userId: 'local-user',
        archiveId: 'arch_001',
        filename: 'MyArchive.zip',
        blob: new Blob(['mock-zip-bytes'], { type: 'application/zip' }),
      });

      expect(resultLocal.success).toBe(false);
      expect(resultLocal.error).toContain('You must be signed in');

      const resultEmpty = await CloudBackupService.uploadArchive({
        userId: '',
        archiveId: 'arch_001',
        filename: 'MyArchive.zip',
        blob: new Blob(['mock-zip-bytes'], { type: 'application/zip' }),
      });

      expect(resultEmpty.success).toBe(false);
    });

    it('uploads to user-isolated path {userId}/{archiveId}/{filename}.zip when authenticated', async () => {
      vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);

      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({ upload: mockUpload });
      // @ts-expect-error mock storage
      supabaseModule.supabase.storage = { from: mockFrom };

      const blob = new Blob(['mock-zip-bytes'], { type: 'application/zip' });
      const result = await CloudBackupService.uploadArchive({
        userId: 'user_xyz',
        archiveId: 'arch_999',
        filename: 'My:Archive?.zip',
        blob,
      });

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith(CLOUD_STORAGE_BUCKET);
      expect(mockUpload).toHaveBeenCalledWith(
        'user_xyz/arch_999/My_Archive_.zip',
        blob,
        expect.objectContaining({ contentType: 'application/zip', upsert: true })
      );
      expect(result.storagePath).toBe('user_xyz/arch_999/My_Archive_.zip');
      expect(result.sizeBytes).toBe(blob.size);
    });

    it('handles Supabase Storage upload error cleanly', async () => {
      vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);

      const mockUpload = vi.fn().mockResolvedValue({ error: { message: 'Bucket quota exceeded' } });
      const mockFrom = vi.fn().mockReturnValue({ upload: mockUpload });
      // @ts-expect-error mock storage
      supabaseModule.supabase.storage = { from: mockFrom };

      const result = await CloudBackupService.uploadArchive({
        userId: 'user_xyz',
        archiveId: 'arch_999',
        filename: 'Archive.zip',
        blob: new Blob(['test']),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Bucket quota exceeded');
    });
  });

  describe('getSignedDownloadUrl', () => {
    it('rejects access if storage path does not belong to the user', async () => {
      vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);

      const result = await CloudBackupService.getSignedDownloadUrl(
        'user_alice',
        'user_bob/arch_001/archive.zip'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });

    it('generates a signed download URL with 1-hour expiration for owned path', async () => {
      vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);

      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://supabase.co/storage/v1/signed/user_alice/arch_001/archive.zip?token=mock' },
        error: null,
      });
      const mockFrom = vi.fn().mockReturnValue({ createSignedUrl: mockCreateSignedUrl });
      // @ts-expect-error mock storage
      supabaseModule.supabase.storage = { from: mockFrom };

      const result = await CloudBackupService.getSignedDownloadUrl(
        'user_alice',
        'user_alice/arch_001/archive.zip',
        3600
      );

      expect(result.success).toBe(true);
      expect(result.signedUrl).toContain('https://supabase.co/storage/v1/signed');
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('user_alice/arch_001/archive.zip', 3600);
      expect(result.expiresInSeconds).toBe(3600);
    });

    it('handles signed URL creation errors', async () => {
      vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);

      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Object not found in bucket' },
      });
      const mockFrom = vi.fn().mockReturnValue({ createSignedUrl: mockCreateSignedUrl });
      // @ts-expect-error mock storage
      supabaseModule.supabase.storage = { from: mockFrom };

      const result = await CloudBackupService.getSignedDownloadUrl(
        'user_alice',
        'user_alice/arch_001/archive.zip'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Object not found in bucket');
    });
  });

  describe('deleteArchive', () => {
    it('rejects deletion if storage path does not belong to the user', async () => {
      vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);

      const result = await CloudBackupService.deleteArchive(
        'user_alice',
        'user_bob/arch_001/archive.zip'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });

    it('deletes the archive when path is owned by user', async () => {
      vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);

      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({ remove: mockRemove });
      // @ts-expect-error mock storage
      supabaseModule.supabase.storage = { from: mockFrom };

      const result = await CloudBackupService.deleteArchive(
        'user_alice',
        'user_alice/arch_001/archive.zip'
      );

      expect(result.success).toBe(true);
      expect(mockRemove).toHaveBeenCalledWith(['user_alice/arch_001/archive.zip']);
    });
  });
});
