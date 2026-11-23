/**
 * Phase 7 — Application Metadata Backup & Restore Service
 * 
 * Generates portable, validated JSON backups of application metadata, collections,
 * match decisions, export logs, and client settings.
 * Validates incoming schemas and resolves conflicts safely with rollback protection.
 */

import { CustomCollection, TrackMatch } from '../../types';
import { ExportHistoryRecord } from '../export/types';

export const BACKUP_SCHEMA_VERSION = 'playlistvault-backup-v1';

export interface AppMetadataBackupPayload {
  version: string;
  app: string;
  exported_at: string;
  user_id: string;
  notice: string;
  data: {
    collections: CustomCollection[];
    matches: TrackMatch[];
    export_history: ExportHistoryRecord[];
    settings?: {
      spotify_client_id?: string;
    };
  };
}

export interface BackupValidationResult {
  isValid: boolean;
  version: string;
  stats: {
    collectionsCount: number;
    matchesCount: number;
    historyCount: number;
  };
  conflicts: {
    conflictingCollectionsCount: number;
    conflictingMatchesCount: number;
  };
  errors: string[];
  payload?: AppMetadataBackupPayload;
}

export class MetadataBackupService {
  /**
   * Generates a complete application metadata JSON backup.
   */
  static generateBackup(userId: string): { jsonString: string; filename: string } {
    let collections: CustomCollection[] = [];
    try {
      const raw = localStorage.getItem('pv_custom_collections');
      collections = raw ? JSON.parse(raw) : [];
    } catch {
      collections = [];
    }

    let matches: TrackMatch[] = [];
    try {
      const raw = localStorage.getItem('pv_track_matches_data');
      matches = raw ? JSON.parse(raw) : [];
    } catch {
      matches = [];
    }

    let history: ExportHistoryRecord[] = [];
    try {
      const raw = localStorage.getItem('pv_export_history');
      history = raw ? JSON.parse(raw) : [];
    } catch {
      history = [];
    }

    const spotifyClientId = localStorage.getItem('pv_custom_spotify_client_id') || undefined;

    const payload: AppMetadataBackupPayload = {
      version: BACKUP_SCHEMA_VERSION,
      app: 'PlaylistVault',
      exported_at: new Date().toISOString(),
      user_id: userId,
      notice:
        'DISCLAIMER: This backup file contains application configuration, collections, match decisions, and history metadata only. It does NOT contain audio binaries.',
      data: {
        collections,
        matches,
        export_history: history,
        settings: {
          spotify_client_id: spotifyClientId,
        },
      },
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const dateSlug = new Date().toISOString().split('T')[0];
    const filename = `playlistvault-backup-${dateSlug}.json`;

    return { jsonString, filename };
  }

  /**
   * Validates an imported backup JSON string and identifies potential conflicts.
   */
  static validateBackupFile(content: string): BackupValidationResult {
    const errors: string[] = [];

    if (!content || !content.trim()) {
      return {
        isValid: false,
        version: 'unknown',
        stats: { collectionsCount: 0, matchesCount: 0, historyCount: 0 },
        conflicts: { conflictingCollectionsCount: 0, conflictingMatchesCount: 0 },
        errors: ['The backup file is empty.'],
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return {
        isValid: false,
        version: 'unknown',
        stats: { collectionsCount: 0, matchesCount: 0, historyCount: 0 },
        conflicts: { conflictingCollectionsCount: 0, conflictingMatchesCount: 0 },
        errors: ['Invalid JSON syntax. The file could not be parsed.'],
      };
    }

    // 1. Check schema version
    if (!parsed.version || parsed.version !== BACKUP_SCHEMA_VERSION) {
      errors.push(
        `Unsupported schema version "${parsed.version || 'unknown'}". Expected "${BACKUP_SCHEMA_VERSION}".`
      );
    }

    // 2. Validate data structure
    if (!parsed.data || typeof parsed.data !== 'object') {
      errors.push('Backup payload is missing the core "data" container.');
      return {
        isValid: false,
        version: parsed.version || 'unknown',
        stats: { collectionsCount: 0, matchesCount: 0, historyCount: 0 },
        conflicts: { conflictingCollectionsCount: 0, conflictingMatchesCount: 0 },
        errors,
      };
    }

    const { collections, matches, export_history } = parsed.data;

    if (!Array.isArray(collections)) {
      errors.push('The "collections" entry must be an array.');
    }
    if (!Array.isArray(matches)) {
      errors.push('The "matches" entry must be an array.');
    }
    if (!Array.isArray(export_history)) {
      errors.push('The "export_history" entry must be an array.');
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        version: parsed.version || 'unknown',
        stats: { collectionsCount: 0, matchesCount: 0, historyCount: 0 },
        conflicts: { conflictingCollectionsCount: 0, conflictingMatchesCount: 0 },
        errors,
      };
    }

    // 3. Detect conflicts with current local storage
    let currentCollections: CustomCollection[] = [];
    try {
      const raw = localStorage.getItem('pv_custom_collections');
      currentCollections = raw ? JSON.parse(raw) : [];
    } catch {
      currentCollections = [];
    }

    let currentMatches: TrackMatch[] = [];
    try {
      const raw = localStorage.getItem('pv_track_matches_data');
      currentMatches = raw ? JSON.parse(raw) : [];
    } catch {
      currentMatches = [];
    }

    const currentCollectionIds = new Set(currentCollections.map((c) => c.id));
    const conflictingCollections = (collections as CustomCollection[]).filter((c) =>
      currentCollectionIds.has(c.id)
    );

    const currentMatchKeys = new Set(currentMatches.map((m) => `${m.playlist_id}::${m.track_id}`));
    const conflictingMatches = (matches as TrackMatch[]).filter((m) =>
      currentMatchKeys.has(`${m.playlist_id}::${m.track_id}`)
    );

    return {
      isValid: true,
      version: parsed.version,
      stats: {
        collectionsCount: collections.length,
        matchesCount: matches.length,
        historyCount: export_history.length,
      },
      conflicts: {
        conflictingCollectionsCount: conflictingCollections.length,
        conflictingMatchesCount: conflictingMatches.length,
      },
      errors: [],
      payload: parsed as AppMetadataBackupPayload,
    };
  }

  /**
   * Restores application metadata according to selected resolution strategy.
   * Strategy:
   *  - 'merge': retains existing items and adds new non-conflicting items.
   *  - 'overwrite': completely replaces collections and matches with backup items.
   */
  static executeRestore(
    payload: AppMetadataBackupPayload,
    strategy: 'merge' | 'overwrite' = 'merge'
  ): { success: boolean; error?: string } {
    // Take snapshots for rollback in case of error
    const prevCollections = localStorage.getItem('pv_custom_collections');
    const prevMatches = localStorage.getItem('pv_track_matches_data');
    const prevHistory = localStorage.getItem('pv_export_history');
    const prevSettings = localStorage.getItem('pv_custom_spotify_client_id');

    try {
      const { collections, matches, export_history, settings } = payload.data;

      if (strategy === 'overwrite') {
        localStorage.setItem('pv_custom_collections', JSON.stringify(collections));
        localStorage.setItem('pv_track_matches_data', JSON.stringify(matches));
        localStorage.setItem('pv_export_history', JSON.stringify(export_history));
      } else {
        // Merge Collections
        let existingCollections: CustomCollection[] = [];
        try {
          existingCollections = prevCollections ? JSON.parse(prevCollections) : [];
        } catch {
          existingCollections = [];
        }
        const colMap = new Map(existingCollections.map((c) => [c.id, c]));
        collections.forEach((c) => {
          if (!colMap.has(c.id)) colMap.set(c.id, c);
        });
        localStorage.setItem('pv_custom_collections', JSON.stringify(Array.from(colMap.values())));

        // Merge Matches
        let existingMatches: TrackMatch[] = [];
        try {
          existingMatches = prevMatches ? JSON.parse(prevMatches) : [];
        } catch {
          existingMatches = [];
        }
        const matchMap = new Map(existingMatches.map((m) => [`${m.playlist_id}::${m.track_id}`, m]));
        matches.forEach((m) => {
          const key = `${m.playlist_id}::${m.track_id}`;
          if (!matchMap.has(key)) matchMap.set(key, m);
        });
        localStorage.setItem('pv_track_matches_data', JSON.stringify(Array.from(matchMap.values())));

        // Merge History
        let existingHistory: ExportHistoryRecord[] = [];
        try {
          existingHistory = prevHistory ? JSON.parse(prevHistory) : [];
        } catch {
          existingHistory = [];
        }
        const histMap = new Map(existingHistory.map((h) => [h.id, h]));
        export_history.forEach((h) => {
          if (!histMap.has(h.id)) histMap.set(h.id, h);
        });
        localStorage.setItem('pv_export_history', JSON.stringify(Array.from(histMap.values())));
      }

      if (settings?.spotify_client_id) {
        localStorage.setItem('pv_custom_spotify_client_id', settings.spotify_client_id);
      }

      return { success: true };
    } catch (err: any) {
      // Rollback
      if (prevCollections !== null) localStorage.setItem('pv_custom_collections', prevCollections);
      if (prevMatches !== null) localStorage.setItem('pv_track_matches_data', prevMatches);
      if (prevHistory !== null) localStorage.setItem('pv_export_history', prevHistory);
      if (prevSettings !== null) localStorage.setItem('pv_custom_spotify_client_id', prevSettings);

      return {
        success: false,
        error: err?.message || 'Failed to restore application metadata. Rollback completed.',
      };
    }
  }
}
