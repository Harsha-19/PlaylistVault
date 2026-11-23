import { describe, it, expect, beforeEach } from 'vitest';
import {
  MetadataBackupService,
  BACKUP_SCHEMA_VERSION,
  AppMetadataBackupPayload,
} from '../lib/storage/metadataBackupService';
import { CustomCollection, TrackMatch } from '../types';
import { ExportHistoryRecord } from '../lib/export/types';

describe('MetadataBackupService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('generateBackup', () => {
    it('generates a valid JSON backup with all required schema fields', () => {
      const sampleCollection: CustomCollection = {
        id: 'col_sample_1',
        user_id: 'user_test',
        name: 'Roadtrip 2026',
        description: 'Cruising tracks',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        audio_file_ids: ['af_1'],
      };
      localStorage.setItem('pv_custom_collections', JSON.stringify([sampleCollection]));

      const sampleMatch: TrackMatch = {
        id: 'match_1',
        user_id: 'user_test',
        playlist_id: 'pl_1',
        track_id: 't_1',
        audio_file_id: 'af_1',
        match_type: 'manual',
        confidence_score: 1.0,
        status: 'confirmed',
        matched_at: new Date().toISOString(),
        notes: null,
      };
      localStorage.setItem('pv_track_matches_data', JSON.stringify([sampleMatch]));

      const sampleHistory: ExportHistoryRecord = {
        id: 'hist_1',
        userId: 'user_test',
        archiveName: 'Roadtrip.zip',
        sourceType: 'custom_collection',
        sourceId: 'col_sample_1',
        sourceName: 'Roadtrip 2026',
        totalTracks: 1,
        matchedAudioCount: 1,
        totalSizeBytes: 5000000,
        formatsIncluded: ['audio/mp3'],
        folderStructure: 'flat',
        downloaded: true,
        status: 'completed',
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem('pv_export_history', JSON.stringify([sampleHistory]));
      localStorage.setItem('pv_custom_spotify_client_id', 'custom_client_id_123');

      const { jsonString, filename } = MetadataBackupService.generateBackup('user_test');

      expect(filename).toMatch(/^playlistvault-backup-\d{4}-\d{2}-\d{2}\.json$/);

      const parsed: AppMetadataBackupPayload = JSON.parse(jsonString);
      expect(parsed.version).toBe(BACKUP_SCHEMA_VERSION);
      expect(parsed.app).toBe('PlaylistVault');
      expect(parsed.user_id).toBe('user_test');
      expect(parsed.data.collections).toHaveLength(1);
      expect(parsed.data.collections[0].name).toBe('Roadtrip 2026');
      expect(parsed.data.matches).toHaveLength(1);
      expect(parsed.data.export_history).toHaveLength(1);
      expect(parsed.data.settings?.spotify_client_id).toBe('custom_client_id_123');
    });
  });

  describe('validateBackupFile', () => {
    it('fails when given an empty string', () => {
      const result = MetadataBackupService.validateBackupFile('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('The backup file is empty.');
    });

    it('fails when given malformed non-JSON data', () => {
      const result = MetadataBackupService.validateBackupFile('not json {');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid JSON syntax');
    });

    it('fails when schema version does not match', () => {
      const payload = {
        version: 'v0.0.1-legacy',
        data: { collections: [], matches: [], export_history: [] },
      };
      const result = MetadataBackupService.validateBackupFile(JSON.stringify(payload));
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Unsupported schema version');
    });

    it('fails when required data arrays are missing', () => {
      const payload = {
        version: BACKUP_SCHEMA_VERSION,
        data: {
          collections: 'invalid-string',
          matches: null,
        },
      };
      const result = MetadataBackupService.validateBackupFile(JSON.stringify(payload));
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('The "collections" entry must be an array.');
      expect(result.errors).toContain('The "matches" entry must be an array.');
    });

    it('validates correct payload and detects conflicts with current storage', () => {
      // Existing in storage
      localStorage.setItem(
        'pv_custom_collections',
        JSON.stringify([{ id: 'c_existing', name: 'Existing Col', audio_file_ids: [] }])
      );
      localStorage.setItem(
        'pv_track_matches_data',
        JSON.stringify([
          {
            id: 'm_existing',
            playlist_id: 'pl_1',
            track_id: 't_1',
            audio_file_id: 'a_1',
          },
        ])
      );

      // Incoming backup has one conflicting collection and one conflicting match
      const incoming: AppMetadataBackupPayload = {
        version: BACKUP_SCHEMA_VERSION,
        app: 'PlaylistVault',
        exported_at: new Date().toISOString(),
        user_id: 'user_x',
        notice: 'Test',
        data: {
          collections: [
            {
              id: 'c_existing',
              user_id: 'user_x',
              name: 'Updated Col',
              description: '',
              created_at: '',
              updated_at: '',
              audio_file_ids: [],
            },
            {
              id: 'c_new',
              user_id: 'user_x',
              name: 'Brand New Col',
              description: '',
              created_at: '',
              updated_at: '',
              audio_file_ids: [],
            },
          ],
          matches: [
            {
              id: 'm_incoming_1',
              user_id: 'user_x',
              playlist_id: 'pl_1',
              track_id: 't_1',
              audio_file_id: 'a_different',
              match_type: 'manual',
              confidence_score: 1.0,
              status: 'confirmed',
              matched_at: '',
              notes: null,
            },
          ],
          export_history: [],
        },
      };

      const result = MetadataBackupService.validateBackupFile(JSON.stringify(incoming));

      expect(result.isValid).toBe(true);
      expect(result.stats.collectionsCount).toBe(2);
      expect(result.stats.matchesCount).toBe(1);
      expect(result.conflicts.conflictingCollectionsCount).toBe(1);
      expect(result.conflicts.conflictingMatchesCount).toBe(1);
    });
  });

  describe('executeRestore', () => {
    const backupPayload: AppMetadataBackupPayload = {
      version: BACKUP_SCHEMA_VERSION,
      app: 'PlaylistVault',
      exported_at: new Date().toISOString(),
      user_id: 'user_test',
      notice: 'Test',
      data: {
        collections: [
          {
            id: 'c_backup_1',
            user_id: 'user_test',
            name: 'Backup Collection 1',
            description: '',
            created_at: '',
            updated_at: '',
            audio_file_ids: [],
          },
        ],
        matches: [
          {
            id: 'm_backup_1',
            user_id: 'user_test',
            playlist_id: 'pl_1',
            track_id: 't_backup',
            audio_file_id: 'af_1',
            match_type: 'auto',
            confidence_score: 1.0,
            status: 'confirmed',
            matched_at: '',
            notes: null,
          },
        ],
        export_history: [
          {
            id: 'h_backup_1',
            userId: 'user_test',
            archiveName: 'OldArchive.zip',
            sourceType: 'custom_collection',
            sourceId: 'c_backup_1',
            sourceName: 'Backup Collection 1',
            totalTracks: 1,
            matchedAudioCount: 1,
            totalSizeBytes: 1000,
            formatsIncluded: ['audio/mp3'],
            folderStructure: 'flat',
            downloaded: true,
            status: 'completed',
            createdAt: '',
          },
        ],
        settings: {
          spotify_client_id: 'new_client_id_xyz',
        },
      },
    };

    it('merges non-conflicting backup records with existing state when strategy is merge', () => {
      localStorage.setItem(
        'pv_custom_collections',
        JSON.stringify([
          {
            id: 'c_local_existing',
            user_id: 'user_test',
            name: 'Local Collection',
            description: '',
            created_at: '',
            updated_at: '',
            audio_file_ids: [],
          },
        ])
      );

      const restoreResult = MetadataBackupService.executeRestore(backupPayload, 'merge');
      expect(restoreResult.success).toBe(true);

      const mergedCollections = JSON.parse(localStorage.getItem('pv_custom_collections') || '[]');
      expect(mergedCollections).toHaveLength(2);
      expect(mergedCollections.map((c: any) => c.id)).toContain('c_local_existing');
      expect(mergedCollections.map((c: any) => c.id)).toContain('c_backup_1');

      expect(localStorage.getItem('pv_custom_spotify_client_id')).toBe('new_client_id_xyz');
    });

    it('replaces all state completely when strategy is overwrite', () => {
      localStorage.setItem(
        'pv_custom_collections',
        JSON.stringify([
          {
            id: 'c_local_to_be_replaced',
            user_id: 'user_test',
            name: 'Old Local Collection',
            description: '',
            created_at: '',
            updated_at: '',
            audio_file_ids: [],
          },
        ])
      );

      const restoreResult = MetadataBackupService.executeRestore(backupPayload, 'overwrite');
      expect(restoreResult.success).toBe(true);

      const overwrittenCollections = JSON.parse(localStorage.getItem('pv_custom_collections') || '[]');
      expect(overwrittenCollections).toHaveLength(1);
      expect(overwrittenCollections[0].id).toBe('c_backup_1');
    });
  });
});
