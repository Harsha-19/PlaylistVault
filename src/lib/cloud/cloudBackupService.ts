/**
 * Phase 7 — Private Cloud Archive Backup Service (Supabase Storage)
 * 
 * Manages secure user-isolated ZIP archive backups in Supabase Storage (`export-archives` private bucket),
 * signed download URLs with expiration, ownership verification, and deletion.
 */

import { supabase, isSupabaseConfigured } from '../supabase';
import { sanitizePathSegment } from '../export/pathSanitizer';

export const CLOUD_STORAGE_BUCKET = 'export-archives';

export interface CloudUploadResult {
  success: boolean;
  storagePath?: string;
  sizeBytes?: number;
  error?: string;
}

export interface CloudSignedUrlResult {
  success: boolean;
  signedUrl?: string;
  expiresInSeconds?: number;
  error?: string;
}

export class CloudBackupService {
  /**
   * Checks whether Supabase Cloud Storage is currently configured and available.
   */
  static isAvailable(): boolean {
    return isSupabaseConfigured;
  }

  /**
   * Uploads a generated ZIP archive Blob to the user's private cloud storage folder.
   * Path: {userId}/{archiveId}/{filename}.zip
   */
  static async uploadArchive(options: {
    userId: string;
    archiveId: string;
    filename: string;
    blob: Blob;
  }): Promise<CloudUploadResult> {
    const { userId, archiveId, filename, blob } = options;

    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Cloud backup is not available because Supabase is running in local resilient mode.',
      };
    }

    if (!userId || userId === 'local-user') {
      return {
        success: false,
        error: 'You must be signed in with a valid account to back up archives to private cloud storage.',
      };
    }

    const safeFilename = sanitizePathSegment(filename, 'archive.zip');
    const storagePath = `${userId}/${archiveId}/${safeFilename}`;

    try {
      const { error } = await supabase.storage
        .from(CLOUD_STORAGE_BUCKET)
        .upload(storagePath, blob, {
          contentType: 'application/zip',
          upsert: true,
        });

      if (error) {
        return {
          success: false,
          error: `Supabase Storage upload failed: ${error.message}`,
        };
      }

      return {
        success: true,
        storagePath,
        sizeBytes: blob.size,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error occurred while uploading archive to cloud storage.',
      };
    }
  }

  /**
   * Generates a secure, temporary signed download URL for an archive.
   * Enforces strict ownership check before requesting signed URL.
   */
  static async getSignedDownloadUrl(
    userId: string,
    storagePath: string,
    expiresInSeconds = 3600
  ): Promise<CloudSignedUrlResult> {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Cloud storage is currently offline or unconfigured.',
      };
    }

    // CRITICAL: Enforce authenticated user path isolation
    const expectedPrefix = `${userId}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      return {
        success: false,
        error: 'Access denied: You do not have permission to access this storage path.',
      };
    }

    try {
      const { data, error } = await supabase.storage
        .from(CLOUD_STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresInSeconds);

      if (error || !data?.signedUrl) {
        return {
          success: false,
          error: error?.message || 'Failed to generate signed download URL.',
        };
      }

      return {
        success: true,
        signedUrl: data.signedUrl,
        expiresInSeconds,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'An error occurred while creating signed download URL.',
      };
    }
  }

  /**
   * Deletes a cloud archive backup from the private bucket.
   * Enforces strict ownership check before deleting.
   */
  static async deleteArchive(
    userId: string,
    storagePath: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Cloud storage is currently offline or unconfigured.',
      };
    }

    // CRITICAL: Enforce authenticated user path isolation
    const expectedPrefix = `${userId}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      return {
        success: false,
        error: 'Access denied: You cannot delete archives belonging to another user.',
      };
    }

    try {
      const { error } = await supabase.storage
        .from(CLOUD_STORAGE_BUCKET)
        .remove([storagePath]);

      if (error) {
        return {
          success: false,
          error: `Failed to delete cloud backup: ${error.message}`,
        };
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'An error occurred while deleting archive from cloud storage.',
      };
    }
  }
}
