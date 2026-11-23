/**
 * Phase 7 — Export Vault Page (Enhanced)
 * 
 * Standalone offline ZIP archive generator, folder structure customizer,
 * pre-export validation inspector, real-time progress monitor, persistent history manager,
 * and optional private Supabase Storage cloud backup integration.
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  Download,
  Music,
  ShieldCheck,
  CheckSquare,
  Square,
  AlertTriangle,
  CheckCircle2,
  FolderTree,
  Trash2,
  CloudUpload,
  CloudDownload,
  Eye,
  Search,
  Cloud,
  Check,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { useExport } from '../context/ExportContext';
import { useMatch } from '../context/MatchContext';
import { useCollection } from '../context/CollectionContext';
import { useAudio } from '../context/AudioContext';
import { validateExportSelection } from '../lib/export/exportValidator';
import {
  ExportOptionsConfig,
  FolderOrganization,
  FilenamePattern,
  ExportSourceType,
  ExportHistoryRecord,
  HistorySortOption,
  HistoryStatusFilter,
} from '../lib/export/types';
import { formatBytes, formatDate } from '../lib/utils';
import { Playlist } from '../types';

export function ExportVault() {
  const {
    history,
    isExporting,
    isCloudUploading,
    activeProgress,
    startExport,
    cancelExport,
    deleteHistoryItem,
    bulkDeleteHistory,
    backupArchiveToCloud,
    getCloudDownloadUrl,
    deleteCloudBackup,
  } = useExport();

  const {
    availablePlaylists,
    selectedPlaylistId: matchSelectedId,
    setSelectedPlaylistId: setMatchSelectedId,
    matchItems,
  } = useMatch();
  const { collections } = useCollection();
  const { audioFiles } = useAudio();

  // Active view tab: 'new_export' or 'history'
  const [activeTab, setActiveTab] = useState<'new_export' | 'history'>('new_export');

  // Step 1: Source Configuration
  const [sourceType, setSourceType] = useState<ExportSourceType>('spotify_playlist');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(
    availablePlaylists[0]?.id || ''
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    collections[0]?.id || ''
  );

  const activePlaylistId = selectedPlaylistId || matchSelectedId || availablePlaylists[0]?.id || '';

  // Step 2: Archive & Folder Configuration
  const [folderStructure, setFolderStructure] = useState<FolderOrganization>('playlist_track');
  const [filenamePattern, setFilenamePattern] = useState<FilenamePattern>('track_artist_title');
  const [includeAudioFiles, setIncludeAudioFiles] = useState(true);
  const [includeCsv, setIncludeCsv] = useState(true);
  const [includeJson, setIncludeJson] = useState(true);
  const [includePlaylistJson, setIncludePlaylistJson] = useState(true);
  const [includeReadme, setIncludeReadme] = useState(true);

  // Partial export selection
  const [excludedTrackIds, setExcludedTrackIds] = useState<Set<string>>(new Set());

  // Partial Export Confirmation Modal State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Track filter in validation table
  const [tableFilter, setTableFilter] = useState<'all' | 'ready' | 'issues'>('all');

  // History Search, Filter & Sort State
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>('all');
  const [historySortBy, setHistorySortBy] = useState<HistorySortOption>('newest');
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());

  // History Detail Inspection Modal State
  const [inspectingRecord, setInspectingRecord] = useState<ExportHistoryRecord | null>(null);
  const [cloudSignedUrl, setCloudSignedUrl] = useState<string | null>(null);
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);

  // Resolve active source metadata
  const currentSource = useMemo(() => {
    if (sourceType === 'spotify_playlist') {
      const pl = availablePlaylists.find((p: Playlist) => p.id === activePlaylistId) || availablePlaylists[0];
      return {
        id: pl?.id || '',
        name: pl?.name || 'Untitled Playlist',
        artwork: pl?.image_url || undefined,
        count: pl?.total_tracks || 0,
      };
    } else {
      const col = collections.find((c) => c.id === selectedCollectionId) || collections[0];
      return {
        id: col?.id || '',
        name: col?.name || 'Untitled Collection',
        artwork: undefined,
        count: col?.audio_file_ids.length || 0,
      };
    }
  }, [sourceType, activePlaylistId, selectedCollectionId, availablePlaylists, collections]);

  // Current export configuration object
  const exportConfig: ExportOptionsConfig = useMemo(() => {
    return {
      sourceType,
      sourceId: currentSource.id,
      sourceName: currentSource.name,
      folderStructure,
      filenamePattern,
      includeAudioFiles,
      includeCsv,
      includeJson,
      includePlaylistJson,
      includeReadme,
    };
  }, [
    sourceType,
    currentSource,
    folderStructure,
    filenamePattern,
    includeAudioFiles,
    includeCsv,
    includeJson,
    includePlaylistJson,
    includeReadme,
  ]);

  // Pre-export validation analysis
  const validationSummary = useMemo(() => {
    const rawTracks =
      sourceType === 'spotify_playlist'
        ? matchItems.map((m) => m.track)
        : [];

    const playlistMatches =
      sourceType === 'spotify_playlist'
        ? matchItems.filter((m) => !!m.match).map((m) => m.match!)
        : [];

    const activeCollection =
      sourceType === 'custom_collection'
        ? collections.find((c) => c.id === currentSource.id)
        : undefined;

    return validateExportSelection({
      config: exportConfig,
      tracks: rawTracks,
      matches: playlistMatches,
      audioFiles,
      collectionAudioFileIds: activeCollection?.audio_file_ids || [],
    });
  }, [exportConfig, sourceType, currentSource, matchItems, audioFiles, collections]);

  // Filtered tracks for preview table
  const displayTracks = useMemo(() => {
    return validationSummary.items.filter((item) => {
      if (tableFilter === 'ready') return item.status === 'ready';
      if (tableFilter === 'issues') return item.status !== 'ready';
      return true;
    });
  }, [validationSummary.items, tableFilter]);

  // Filtered & Sorted History
  const filteredHistory = useMemo(() => {
    return history
      .filter((rec) => {
        if (historySearch.trim()) {
          const q = historySearch.toLowerCase().trim();
          const matchName = rec.archiveName.toLowerCase().includes(q);
          const matchSource = rec.sourceName.toLowerCase().includes(q);
          if (!matchName && !matchSource) return false;
        }
        if (historyStatusFilter === 'cloud_backed') {
          if (!rec.cloudStoragePath) return false;
        } else if (historyStatusFilter !== 'all' && rec.status !== historyStatusFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (historySortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (historySortBy === 'oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (historySortBy === 'size_desc') {
          return (b.totalSizeBytes || 0) - (a.totalSizeBytes || 0);
        }
        if (historySortBy === 'tracks_desc') {
          return (b.totalTracks || 0) - (a.totalTracks || 0);
        }
        return 0;
      });
  }, [history, historySearch, historyStatusFilter, historySortBy]);

  // Handle track inclusion toggle
  const toggleTrackInclusion = (trackId: string) => {
    setExcludedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  };

  // Trigger export flow
  const handleInitiateExport = () => {
    if (!validationSummary.canExport) return;

    if (validationSummary.requiresPartialConfirmation) {
      setIsConfirmModalOpen(true);
    } else {
      executeExport();
    }
  };

  // Perform actual ZIP generation
  const executeExport = async () => {
    setIsConfirmModalOpen(false);

    const finalTracks = validationSummary.items.filter(
      (item) => !excludedTrackIds.has(item.trackId)
    );

    await startExport({
      tracks: finalTracks,
      config: exportConfig,
    });
  };

  // Cloud Backup Handler
  const handleBackupToCloud = async (record: ExportHistoryRecord) => {
    setCloudNotice(null);
    const result = await backupArchiveToCloud(record.id);
    if (result.success) {
      setCloudNotice(`Archive "${record.archiveName}" successfully backed up to private cloud storage!`);
    } else {
      setCloudNotice(result.error || 'Failed to upload archive to cloud storage.');
    }
  };

  // Cloud Signed Download URL Handler
  const handleGetSignedUrl = async (record: ExportHistoryRecord) => {
    if (!record.cloudStoragePath) return;
    setCloudNotice(null);
    const result = await getCloudDownloadUrl(record.cloudStoragePath);
    if (result.success && result.signedUrl) {
      setCloudSignedUrl(result.signedUrl);
    } else {
      setCloudNotice(result.error || 'Failed to generate cloud download URL.');
    }
  };

  // Cloud Backup Delete Handler
  const handleDeleteCloudBackup = async (record: ExportHistoryRecord) => {
    if (!record.cloudStoragePath) return;
    const confirmed = window.confirm(
      `Are you sure you want to remove the cloud backup for "${record.archiveName}"? Your local record will remain.`
    );
    if (!confirmed) return;

    const result = await deleteCloudBackup(record.id, record.cloudStoragePath);
    if (result.success) {
      setCloudSignedUrl(null);
      setCloudNotice('Cloud backup deleted successfully.');
      if (inspectingRecord?.id === record.id) {
        setInspectingRecord((prev) => (prev ? { ...prev, cloudStoragePath: undefined } : null));
      }
    } else {
      setCloudNotice(result.error || 'Failed to delete cloud backup.');
    }
  };

  // Bulk History Deletion
  const handleBulkDeleteHistory = async () => {
    if (selectedHistoryIds.size === 0) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedHistoryIds.size} export records from history?`
    );
    if (!confirmed) return;

    await bulkDeleteHistory(Array.from(selectedHistoryIds));
    setSelectedHistoryIds(new Set());
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-spotify-secondary">Export Vault</h1>
          <p className="text-xs text-spotify-on-surface mt-1">
            Package authorized audio binaries and structured metadata into standalone offline ZIP archives.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-spotify-surface rounded-full border border-spotify-surface-border">
          <button
            onClick={() => setActiveTab('new_export')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeTab === 'new_export'
                ? 'bg-spotify-surface-border text-spotify-secondary shadow-sm'
                : 'text-spotify-on-surface hover:text-spotify-secondary'
            }`}
          >
            New Archive
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-spotify-surface-border text-spotify-secondary shadow-sm'
                : 'text-spotify-on-surface hover:text-spotify-secondary'
            }`}
          >
            Export History
            {history.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-spotify-accent text-spotify-base font-bold">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Standalone Guarantee Banner */}
      <div className="p-4 rounded-lg bg-spotify-surface border border-spotify-accent/40 flex items-start gap-3 shadow-lg">
        <ShieldCheck className="w-5 h-5 text-spotify-accent flex-shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-spotify-secondary">
            Standalone Guarantee: 100% Offline Independence
          </p>
          <p className="text-spotify-on-surface leading-relaxed">
            The exported ZIP contains genuine, uncompressed audio binaries from your local IndexedDB,
            accompanied by <code className="text-spotify-accent">metadata.json</code>,{' '}
            <code className="text-spotify-accent">metadata.csv</code>, and{' '}
            <code className="text-spotify-accent">playlist.json</code>. The archive requires zero external
            network connectivity, Spotify authorization, or Supabase backend to extract and play.
          </p>
        </div>
      </div>

      {/* ================= TAB 1: NEW EXPORT PACKAGE ================= */}
      {activeTab === 'new_export' && (
        <div className="space-y-6">
          {/* STEP 1: SOURCE SELECTION */}
          <Card className="p-5 bg-spotify-surface border-spotify-surface-border space-y-4">
            <div className="flex items-center justify-between border-b border-spotify-surface-border pb-3">
              <div>
                <span className="text-[10px] font-bold text-spotify-accent uppercase tracking-wider">
                  Step 1
                </span>
                <h2 className="text-sm font-bold text-spotify-secondary">Select Export Source</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSourceType('spotify_playlist')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    sourceType === 'spotify_playlist'
                      ? 'bg-spotify-accent text-spotify-base'
                      : 'bg-spotify-surface-border text-spotify-on-surface hover:text-spotify-secondary'
                  }`}
                >
                  Spotify Playlist
                </button>
                <button
                  onClick={() => setSourceType('custom_collection')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    sourceType === 'custom_collection'
                      ? 'bg-spotify-accent text-spotify-base'
                      : 'bg-spotify-surface-border text-spotify-on-surface hover:text-spotify-secondary'
                  }`}
                >
                  Custom Collection
                </button>
              </div>
            </div>

            {sourceType === 'spotify_playlist' ? (
              availablePlaylists.length === 0 ? (
                <div className="p-6 text-center text-xs text-spotify-on-surface border border-dashed border-spotify-surface-border rounded-md">
                  No Spotify playlists found. Import a playlist first from the{' '}
                  <Link to="/playlists" className="text-spotify-accent underline">
                    Playlists
                  </Link>{' '}
                  page.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availablePlaylists.map((pl: Playlist) => {
                    const isSelected = pl.id === currentSource.id;
                    return (
                      <div
                        key={pl.id}
                        onClick={() => {
                          setSelectedPlaylistId(pl.id);
                          setMatchSelectedId(pl.id);
                        }}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${
                          isSelected
                            ? 'bg-spotify-surface-border border-spotify-accent shadow-md'
                            : 'bg-spotify-base/40 border-spotify-surface-border hover:border-spotify-on-surface'
                        }`}
                      >
                        {pl.image_url ? (
                          <img
                            src={pl.image_url}
                            alt={pl.name}
                            className="w-12 h-12 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-spotify-surface-border flex items-center justify-center flex-shrink-0">
                            <Music className="w-6 h-6 text-spotify-on-surface" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-spotify-secondary truncate">
                            {pl.name}
                          </p>
                          <p className="text-[11px] text-spotify-on-surface">
                            {pl.total_tracks} tracks
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-spotify-accent flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )
            ) : collections.length === 0 ? (
              <div className="p-6 text-center text-xs text-spotify-on-surface border border-dashed border-spotify-surface-border rounded-md">
                No custom collections created yet. Create custom collections in the{' '}
                <Link to="/audio" className="text-spotify-accent underline">
                  Audio Library
                </Link>
                .
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {collections.map((col) => {
                  const isSelected = col.id === currentSource.id;
                  return (
                    <div
                      key={col.id}
                      onClick={() => setSelectedCollectionId(col.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'bg-spotify-surface-border border-spotify-accent shadow-md'
                          : 'bg-spotify-base/40 border-spotify-surface-border hover:border-spotify-on-surface'
                      }`}
                    >
                      <div className="w-12 h-12 rounded bg-spotify-surface-border flex items-center justify-center flex-shrink-0">
                        <FolderTree className="w-6 h-6 text-spotify-accent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-spotify-secondary truncate">{col.name}</p>
                        <p className="text-[11px] text-spotify-on-surface">
                          {col.audio_file_ids.length} files
                        </p>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-spotify-accent flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* STEP 2: ARCHIVE CONFIGURATION & LAYOUT */}
          <Card className="p-5 bg-spotify-surface border-spotify-surface-border space-y-5">
            <div className="border-b border-spotify-surface-border pb-3">
              <span className="text-[10px] font-bold text-spotify-accent uppercase tracking-wider">
                Step 2
              </span>
              <h2 className="text-sm font-bold text-spotify-secondary">Folder Layout & Metadata Options</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Folder Organization Layout */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-spotify-secondary flex items-center gap-1.5">
                  <FolderTree className="w-4 h-4 text-spotify-accent" />
                  Folder Structure Inside ZIP
                </label>
                <div className="space-y-2">
                  {[
                    {
                      id: 'playlist_track',
                      label: 'Playlist / Track',
                      example: `${currentSource.name}/01 - Artist - Title.mp3`,
                    },
                    {
                      id: 'artist_album_track',
                      label: 'Artist / Album / Track',
                      example: 'The Weeknd/After Hours/01 - The Weeknd - Blinding Lights.mp3',
                    },
                    {
                      id: 'genre_artist_track',
                      label: 'Genre / Artist / Track',
                      example: 'Pop/The Weeknd/01 - The Weeknd - Blinding Lights.mp3',
                    },
                    {
                      id: 'flat',
                      label: 'Flat (Single Folder)',
                      example: '01 - The Weeknd - Blinding Lights.mp3',
                    },
                  ].map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => setFolderStructure(opt.id as FolderOrganization)}
                      className={`p-3 rounded-md border cursor-pointer transition-colors text-xs ${
                        folderStructure === opt.id
                          ? 'bg-spotify-surface-border border-spotify-accent text-spotify-secondary'
                          : 'bg-spotify-base/30 border-spotify-surface-border text-spotify-on-surface hover:border-spotify-on-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>{opt.label}</span>
                        {folderStructure === opt.id && (
                          <span className="w-2 h-2 rounded-full bg-spotify-accent" />
                        )}
                      </div>
                      <p className="text-[10px] text-spotify-on-surface font-mono mt-1 truncate">
                        {opt.example}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Filename Pattern & Included Content */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-spotify-secondary">Filename Convention</label>
                  <select
                    value={filenamePattern}
                    onChange={(e) => setFilenamePattern(e.target.value as FilenamePattern)}
                    className="w-full bg-spotify-base border border-spotify-surface-border rounded-md px-3 py-2 text-xs text-spotify-secondary focus:outline-none focus:border-spotify-accent"
                  >
                    <option value="track_artist_title">01 - Artist - Title.mp3 (Recommended)</option>
                    <option value="artist_title">Artist - Title.mp3</option>
                    <option value="title_only">Title.mp3</option>
                    <option value="original">Original Filename</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-spotify-secondary">
                    Archive Manifest Inclusions
                  </label>
                  <div className="space-y-2 text-xs">
                    <div
                      onClick={() => setIncludeAudioFiles((p) => !p)}
                      className="flex items-center gap-2 p-2 rounded bg-spotify-base/30 cursor-pointer hover:bg-spotify-base/50"
                    >
                      {includeAudioFiles ? (
                        <CheckSquare className="w-4 h-4 text-spotify-accent" />
                      ) : (
                        <Square className="w-4 h-4 text-spotify-on-surface" />
                      )}
                      <span className="font-semibold text-spotify-secondary">
                        Actual Audio Files (Binary Blobs)
                      </span>
                    </div>

                    <div
                      onClick={() => setIncludeCsv((p) => !p)}
                      className="flex items-center gap-2 p-2 rounded bg-spotify-base/30 cursor-pointer hover:bg-spotify-base/50"
                    >
                      {includeCsv ? (
                        <CheckSquare className="w-4 h-4 text-spotify-accent" />
                      ) : (
                        <Square className="w-4 h-4 text-spotify-on-surface" />
                      )}
                      <span className="text-spotify-secondary">
                        <code className="text-spotify-accent">metadata.csv</code> (Spreadsheet with UTF-8 BOM)
                      </span>
                    </div>

                    <div
                      onClick={() => setIncludeJson((p) => !p)}
                      className="flex items-center gap-2 p-2 rounded bg-spotify-base/30 cursor-pointer hover:bg-spotify-base/50"
                    >
                      {includeJson ? (
                        <CheckSquare className="w-4 h-4 text-spotify-accent" />
                      ) : (
                        <Square className="w-4 h-4 text-spotify-on-surface" />
                      )}
                      <span className="text-spotify-secondary">
                        <code className="text-spotify-accent">metadata.json</code> (Detailed Track Manifest)
                      </span>
                    </div>

                    <div
                      onClick={() => setIncludePlaylistJson((p) => !p)}
                      className="flex items-center gap-2 p-2 rounded bg-spotify-base/30 cursor-pointer hover:bg-spotify-base/50"
                    >
                      {includePlaylistJson ? (
                        <CheckSquare className="w-4 h-4 text-spotify-accent" />
                      ) : (
                        <Square className="w-4 h-4 text-spotify-on-surface" />
                      )}
                      <span className="text-spotify-secondary">
                        <code className="text-spotify-accent">playlist.json</code> (Collection Manifest)
                      </span>
                    </div>

                    <div
                      onClick={() => setIncludeReadme((p) => !p)}
                      className="flex items-center gap-2 p-2 rounded bg-spotify-base/30 cursor-pointer hover:bg-spotify-base/50"
                    >
                      {includeReadme ? (
                        <CheckSquare className="w-4 h-4 text-spotify-accent" />
                      ) : (
                        <Square className="w-4 h-4 text-spotify-on-surface" />
                      )}
                      <span className="text-spotify-secondary">
                        <code className="text-spotify-accent">README.txt</code> (Offline Documentation)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* STEP 3: PRE-EXPORT VALIDATION INSPECTOR */}
          <Card className="p-5 bg-spotify-surface border-spotify-surface-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-spotify-surface-border pb-3">
              <div>
                <span className="text-[10px] font-bold text-spotify-accent uppercase tracking-wider">
                  Step 3
                </span>
                <h2 className="text-sm font-bold text-spotify-secondary">Pre-Export Validation Analysis</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-spotify-on-surface">Filter:</span>
                <button
                  onClick={() => setTableFilter('all')}
                  className={`px-2.5 py-1 rounded text-[11px] ${
                    tableFilter === 'all'
                      ? 'bg-spotify-surface-border text-spotify-secondary'
                      : 'text-spotify-on-surface'
                  }`}
                >
                  All ({validationSummary.totalTracks})
                </button>
                <button
                  onClick={() => setTableFilter('ready')}
                  className={`px-2.5 py-1 rounded text-[11px] ${
                    tableFilter === 'ready'
                      ? 'bg-spotify-accent text-spotify-base font-bold'
                      : 'text-spotify-on-surface'
                  }`}
                >
                  Ready ({validationSummary.readyTracks})
                </button>
                <button
                  onClick={() => setTableFilter('issues')}
                  className={`px-2.5 py-1 rounded text-[11px] ${
                    tableFilter === 'issues'
                      ? 'bg-spotify-warning text-spotify-base font-bold'
                      : 'text-spotify-on-surface'
                  }`}
                >
                  Issues ({validationSummary.totalTracks - validationSummary.readyTracks})
                </button>
              </div>
            </div>

            {/* Validation Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 rounded-lg bg-spotify-base/40 border border-spotify-surface-border text-center">
                <p className="text-[10px] text-spotify-on-surface">Total Tracks</p>
                <p className="text-lg font-bold text-spotify-secondary">{validationSummary.totalTracks}</p>
              </div>

              <div className="p-3 rounded-lg bg-spotify-base/40 border border-spotify-accent/30 text-center">
                <p className="text-[10px] text-spotify-accent">Ready to Export</p>
                <p className="text-lg font-bold text-spotify-accent">{validationSummary.readyTracks}</p>
              </div>

              <div className="p-3 rounded-lg bg-spotify-base/40 border border-spotify-surface-border text-center">
                <p className="text-[10px] text-spotify-warning">Unmatched</p>
                <p
                  className={`text-lg font-bold ${
                    validationSummary.unmatchedTracks > 0
                      ? 'text-spotify-warning'
                      : 'text-spotify-on-surface'
                  }`}
                >
                  {validationSummary.unmatchedTracks}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-spotify-base/40 border border-spotify-surface-border text-center">
                <p className="text-[10px] text-spotify-error">Missing Binaries</p>
                <p
                  className={`text-lg font-bold ${
                    validationSummary.missingBinaryTracks > 0
                      ? 'text-spotify-error'
                      : 'text-spotify-on-surface'
                  }`}
                >
                  {validationSummary.missingBinaryTracks}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-spotify-base/40 border border-spotify-surface-border text-center">
                <p className="text-[10px] text-spotify-on-surface">Duplicates</p>
                <p className="text-lg font-bold text-spotify-secondary">
                  {validationSummary.duplicateAssignments}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-spotify-base/40 border border-spotify-surface-border text-center">
                <p className="text-[10px] text-spotify-on-surface">Est. Archive Size</p>
                <p className="text-lg font-bold text-spotify-secondary">
                  {formatBytes(validationSummary.estimatedBytes)}
                </p>
              </div>
            </div>

            {/* Validation Notice if issues exist */}
            {validationSummary.requiresPartialConfirmation && (
              <div className="p-3 rounded-lg bg-spotify-warning/10 border border-spotify-warning/30 flex items-start gap-3 text-xs">
                <AlertTriangle className="w-4 h-4 text-spotify-warning flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-spotify-warning">
                    Partial Export Notice: Missing audio files detected
                  </p>
                  <p className="text-spotify-on-surface text-[11px] leading-relaxed">
                    {validationSummary.unmatchedTracks > 0 &&
                      `${validationSummary.unmatchedTracks} tracks do not have an audio file matched. `}
                    {validationSummary.missingBinaryTracks > 0 &&
                      `${validationSummary.missingBinaryTracks} tracks reference missing audio binaries in storage. `}
                    Only verified audio files ({validationSummary.readyTracks}) will be included in the
                    generated ZIP.
                  </p>
                </div>
              </div>
            )}

            {/* Track Manifest Inspection Table */}
            <div className="overflow-x-auto border border-spotify-surface-border rounded-lg max-h-72">
              <table className="w-full text-left text-xs">
                <thead className="bg-spotify-base/70 text-spotify-on-surface uppercase text-[10px] sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="py-2.5 px-3 text-center">Include</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-4">Track</th>
                    <th className="py-2.5 px-4">Artist</th>
                    <th className="py-2.5 px-4">Format</th>
                    <th className="py-2.5 px-4">Size</th>
                    <th className="py-2.5 px-4">Export Path</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-spotify-surface-border/40 font-mono text-[11px]">
                  {displayTracks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-spotify-on-surface">
                        No tracks match current filter.
                      </td>
                    </tr>
                  ) : (
                    displayTracks.map((item) => {
                      const isExcluded = excludedTrackIds.has(item.trackId);
                      const isReady = item.status === 'ready' || item.status === 'duplicate_audio';
                      return (
                        <tr
                          key={item.trackId}
                          className={`hover:bg-spotify-surface-border/20 transition-colors ${
                            isExcluded ? 'opacity-40' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => toggleTrackInclusion(item.trackId)}
                              disabled={!isReady}
                              className="p-1 disabled:opacity-30"
                            >
                              {!isExcluded && isReady ? (
                                <CheckSquare className="w-3.5 h-3.5 text-spotify-accent" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-spotify-on-surface" />
                              )}
                            </button>
                          </td>
                          <td className="py-2 px-3">
                            {item.status === 'ready' && (
                              <Badge variant="success">Ready</Badge>
                            )}
                            {item.status === 'duplicate_audio' && (
                              <Badge variant="warning">Duplicate</Badge>
                            )}
                            {item.status === 'unmatched' && (
                              <Badge variant="neutral">Unmatched</Badge>
                            )}
                            {item.status === 'missing_binary' && (
                              <Badge variant="error">Missing Blob</Badge>
                            )}
                          </td>
                          <td className="py-2 px-4 font-sans font-semibold text-spotify-secondary truncate max-w-[160px]">
                            {item.title}
                          </td>
                          <td className="py-2 px-4 font-sans text-spotify-on-surface truncate max-w-[120px]">
                            {item.artist}
                          </td>
                          <td className="py-2 px-4">
                            <span className="text-[10px] uppercase font-bold text-spotify-secondary">
                              {item.codec || 'N/A'}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-spotify-on-surface">
                            {item.fileSizeBytes > 0 ? formatBytes(item.fileSizeBytes) : '—'}
                          </td>
                          <td
                            className="py-2 px-4 text-spotify-on-surface text-[10px] truncate max-w-[200px]"
                            title={item.exportedPath}
                          >
                            {item.exportedPath}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-spotify-surface-border">
              <div className="text-xs text-spotify-on-surface">
                Ready to package{' '}
                <strong className="text-spotify-secondary">
                  {validationSummary.readyTracks - excludedTrackIds.size}
                </strong>{' '}
                tracks into <code className="text-spotify-accent">{currentSource.name}.zip</code>
              </div>

              <div className="flex items-center gap-3">
                {validationSummary.unmatchedTracks > 0 && (
                  <Link to="/match">
                    <Button variant="secondary" size="sm" className="text-xs">
                      Go to Match Studio &rarr;
                    </Button>
                  </Link>
                )}

                <Button
                  variant="primary"
                  onClick={handleInitiateExport}
                  disabled={!validationSummary.canExport || isExporting}
                  className="bg-spotify-accent text-spotify-base font-bold shadow-lg flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Generate & Download ZIP
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ================= TAB 2: EXPORT HISTORY & CLOUD BACKUPS ================= */}
      {activeTab === 'history' && (
        <Card className="p-5 bg-spotify-surface border-spotify-surface-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-spotify-surface-border pb-3">
            <div>
              <h2 className="text-sm font-bold text-spotify-secondary">Export Archive Records</h2>
              <p className="text-[11px] text-spotify-on-surface">
                Search, inspect, and manage generated ZIP archives with optional Supabase cloud backups.
              </p>
            </div>

            {/* Bulk actions */}
            {selectedHistoryIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-spotify-on-surface">
                  {selectedHistoryIds.size} selected
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBulkDeleteHistory}
                  className="text-xs text-spotify-error hover:border-spotify-error"
                >
                  Delete Selected
                </Button>
              </div>
            )}
          </div>

          {/* Search, Filter, Sort Controls */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-spotify-on-surface" />
              <Input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search archive or playlist name..."
                className="pl-8 text-xs h-9 bg-spotify-base border-spotify-surface-border rounded-full"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Filter */}
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value as HistoryStatusFilter)}
                className="bg-spotify-base border border-spotify-surface-border rounded-full px-3 py-1.5 text-xs text-spotify-secondary focus:outline-none focus:border-spotify-accent"
              >
                <option value="all">All Records</option>
                <option value="completed">Completed Only</option>
                <option value="cloud_backed">Cloud Backed Up</option>
                <option value="cancelled">Cancelled</option>
                <option value="failed">Failed</option>
              </select>

              {/* Sort By */}
              <select
                value={historySortBy}
                onChange={(e) => setHistorySortBy(e.target.value as HistorySortOption)}
                className="bg-spotify-base border border-spotify-surface-border rounded-full px-3 py-1.5 text-xs text-spotify-secondary focus:outline-none focus:border-spotify-accent"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="size_desc">Largest Size</option>
                <option value="tracks_desc">Most Tracks</option>
              </select>
            </div>
          </div>

          {/* Cloud Operation Status Notice */}
          {cloudNotice && (
            <div className="p-3 rounded-lg bg-spotify-surface-border/50 border border-spotify-accent/30 text-xs text-spotify-secondary flex items-center justify-between">
              <span>{cloudNotice}</span>
              <button
                onClick={() => setCloudNotice(null)}
                className="text-spotify-on-surface hover:text-spotify-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {filteredHistory.length === 0 ? (
            <div className="p-12 text-center text-xs text-spotify-on-surface border border-dashed border-spotify-surface-border rounded-lg space-y-2">
              <Archive className="w-8 h-8 text-spotify-on-surface mx-auto opacity-40" />
              <p className="font-semibold text-spotify-secondary">No export records found</p>
              <p className="text-[11px]">
                {history.length === 0
                  ? 'Generated ZIP archives will be logged here with complete manifest details.'
                  : 'No records match your search or filter criteria.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-spotify-surface-border rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-spotify-base/70 text-spotify-on-surface uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedHistoryIds.size === filteredHistory.length &&
                          filteredHistory.length > 0
                        }
                        onChange={() => {
                          if (selectedHistoryIds.size === filteredHistory.length) {
                            setSelectedHistoryIds(new Set());
                          } else {
                            setSelectedHistoryIds(new Set(filteredHistory.map((r) => r.id)));
                          }
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="py-3 px-4">Archive Name</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Tracks</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Cloud Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-spotify-surface-border/40 font-mono text-[11px]">
                  {filteredHistory.map((rec) => {
                    const isSelected = selectedHistoryIds.has(rec.id);
                    const isCloudBacked = !!rec.cloudStoragePath;

                    return (
                      <tr
                        key={rec.id}
                        className={`hover:bg-spotify-surface-border/20 transition-colors ${
                          isSelected ? 'bg-spotify-surface-border/30' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedHistoryIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(rec.id)) next.delete(rec.id);
                                else next.add(rec.id);
                                return next;
                              });
                            }}
                            className="rounded"
                          />
                        </td>
                        <td className="py-3 px-4 font-sans font-bold text-spotify-secondary truncate max-w-[180px]">
                          <div className="flex items-center gap-2">
                            <Archive className="w-4 h-4 text-spotify-accent flex-shrink-0" />
                            <span className="truncate">{rec.archiveName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-sans text-spotify-on-surface truncate max-w-[140px]">
                          {rec.sourceName}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-spotify-secondary">
                            {rec.matchedAudioCount}
                          </span>{' '}
                          <span className="text-spotify-on-surface">/ {rec.totalTracks}</span>
                        </td>
                        <td className="py-3 px-4 text-spotify-on-surface">
                          {rec.totalSizeBytes > 0 ? formatBytes(rec.totalSizeBytes) : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {isCloudBacked ? (
                            <Badge variant="success" size="sm" className="flex items-center gap-1 w-max">
                              <Cloud className="w-3 h-3" /> Backed Up
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-spotify-on-surface">Local Only</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-spotify-on-surface text-[11px]">
                          {formatDate(rec.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          {rec.status === 'completed' && <Badge variant="success">Completed</Badge>}
                          {rec.status === 'cancelled' && <Badge variant="warning">Cancelled</Badge>}
                          {rec.status === 'failed' && <Badge variant="error">Failed</Badge>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Inspect Detail */}
                            <button
                              onClick={() => setInspectingRecord(rec)}
                              className="p-1 rounded text-spotify-on-surface hover:text-spotify-secondary transition-colors"
                              title="Inspect Archive Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Backup to Cloud Trigger */}
                            {!isCloudBacked && rec.status === 'completed' && (
                              <button
                                onClick={() => handleBackupToCloud(rec)}
                                disabled={isCloudUploading}
                                className="p-1 rounded text-spotify-on-surface hover:text-spotify-accent transition-colors disabled:opacity-40"
                                title="Backup to Supabase Cloud Storage"
                              >
                                <CloudUpload className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Cloud Download */}
                            {isCloudBacked && (
                              <button
                                onClick={() => handleGetSignedUrl(rec)}
                                className="p-1 rounded text-spotify-on-surface hover:text-spotify-accent transition-colors"
                                title="Generate Signed Cloud Download URL"
                              >
                                <CloudDownload className="w-3.5 h-3.5 text-spotify-accent" />
                              </button>
                            )}

                            {/* Delete Record */}
                            <button
                              onClick={() => deleteHistoryItem(rec.id)}
                              className="p-1 rounded text-spotify-on-surface hover:text-spotify-error transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ================= MODAL: RECORD INSPECTION ================= */}
      {inspectingRecord && (
        <Modal
          isOpen={!!inspectingRecord}
          onClose={() => {
            setInspectingRecord(null);
            setCloudSignedUrl(null);
          }}
          title={`Archive Details: ${inspectingRecord.archiveName}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-spotify-base/40 border border-spotify-surface-border">
              <div>
                <p className="text-[10px] text-spotify-on-surface">Source</p>
                <p className="font-bold text-spotify-secondary">{inspectingRecord.sourceName}</p>
                <p className="text-[10px] text-spotify-on-surface">
                  {inspectingRecord.sourceType === 'spotify_playlist'
                    ? 'Spotify Playlist'
                    : 'Custom Collection'}
                </p>
              </div>

              <div>
                <p className="text-[10px] text-spotify-on-surface">Export Date</p>
                <p className="font-bold text-spotify-secondary">
                  {new Date(inspectingRecord.createdAt).toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-[10px] text-spotify-on-surface">Track Packaging</p>
                <p className="font-bold text-spotify-secondary">
                  {inspectingRecord.matchedAudioCount} of {inspectingRecord.totalTracks} tracks packaged
                </p>
              </div>

              <div>
                <p className="text-[10px] text-spotify-on-surface">Archive Size</p>
                <p className="font-bold text-spotify-secondary">
                  {formatBytes(inspectingRecord.totalSizeBytes)}
                </p>
              </div>

              <div>
                <p className="text-[10px] text-spotify-on-surface">Folder Structure</p>
                <p className="font-mono text-spotify-secondary">{inspectingRecord.folderStructure}</p>
              </div>

              <div>
                <p className="text-[10px] text-spotify-on-surface">Audio Formats</p>
                <div className="flex gap-1 mt-0.5">
                  {inspectingRecord.formatsIncluded.map((f) => (
                    <Badge key={f} variant="neutral" size="sm">
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Cloud Backup Details */}
            <div className="p-3 rounded-lg bg-spotify-surface border border-spotify-surface-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-spotify-secondary flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-spotify-accent" /> Private Cloud Backup (Supabase Storage)
                </span>
                {inspectingRecord.cloudStoragePath ? (
                  <Badge variant="success">Active in Cloud</Badge>
                ) : (
                  <Badge variant="neutral">Not Uploaded</Badge>
                )}
              </div>

              {inspectingRecord.cloudStoragePath ? (
                <div className="space-y-2 text-[11px] text-spotify-on-surface">
                  <p>
                    Storage Path:{' '}
                    <code className="text-spotify-accent font-mono">
                      {inspectingRecord.cloudStoragePath}
                    </code>
                  </p>
                  {inspectingRecord.cloudSyncedAt && (
                    <p>Backed up on: {new Date(inspectingRecord.cloudSyncedAt).toLocaleString()}</p>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleGetSignedUrl(inspectingRecord)}
                      className="bg-spotify-accent text-spotify-base text-xs font-bold"
                    >
                      Generate Download Link
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDeleteCloudBackup(inspectingRecord)}
                      className="text-xs text-spotify-error hover:border-spotify-error"
                    >
                      Delete Cloud Backup
                    </Button>
                  </div>

                  {cloudSignedUrl && (
                    <div className="p-2.5 rounded bg-spotify-base border border-spotify-accent/40 mt-2 space-y-1.5">
                      <p className="text-spotify-secondary font-bold text-xs flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-spotify-accent" /> Signed Download Link Active
                        (Expires in 1 Hour)
                      </p>
                      <a
                        href={cloudSignedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-spotify-accent underline break-all font-mono text-[10px] block"
                      >
                        Click to Download Archive from Cloud &rarr;
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-spotify-on-surface">
                    Upload this archive to your private, authenticated Supabase Storage bucket
                    (`export-archives`) for secure remote access.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleBackupToCloud(inspectingRecord)}
                    disabled={isCloudUploading}
                    className="bg-spotify-accent text-spotify-base text-xs font-bold"
                  >
                    {isCloudUploading ? 'Uploading to Cloud...' : 'Backup to Cloud Now'}
                  </Button>
                </div>
              )}
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-2 border-t border-spotify-surface-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setInspectingRecord(null);
                  setCloudSignedUrl(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ================= MODAL: PARTIAL EXPORT CONFIRMATION ================= */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Partial Export"
      >
        <div className="space-y-4">
          <div className="p-3 rounded bg-spotify-warning/10 border border-spotify-warning/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-spotify-warning flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-spotify-warning">Missing Audio Files Detected</p>
              <p className="text-spotify-on-surface leading-relaxed">
                This export contains {validationSummary.unmatchedTracks} unmatched tracks and/or{' '}
                {validationSummary.missingBinaryTracks} missing audio files.
              </p>
            </div>
          </div>

          <div className="text-xs text-spotify-on-surface space-y-2">
            <p>
              Only the{' '}
              <strong className="text-spotify-accent">
                {validationSummary.readyTracks - excludedTrackIds.size} ready audio files
              </strong>{' '}
              will be included in the archive. The metadata manifests (`metadata.json` and `metadata.csv`)
              will accurately list only exported files.
            </p>
            <p>Do you wish to proceed with the partial export?</p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-spotify-surface-border">
            <Button
              variant="secondary"
              onClick={() => setIsConfirmModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={executeExport}
              className="bg-spotify-accent text-spotify-base font-bold text-xs"
            >
              Proceed With Partial Export
            </Button>
          </div>
        </div>
      </Modal>

      {/* ================= MODAL: LIVE GENERATION PROGRESS ================= */}
      <Modal
        isOpen={isExporting}
        onClose={() => {}}
        title="Generating Offline ZIP Archive..."
      >
        <div className="space-y-5 py-2">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-spotify-secondary">
                {activeProgress?.message || 'Processing...'}
              </span>
              <span className="font-bold text-spotify-accent font-mono">
                {activeProgress?.percent || 0}%
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-spotify-surface-border overflow-hidden">
              <div
                className="h-full bg-spotify-accent transition-all duration-300 rounded-full"
                style={{ width: `${activeProgress?.percent || 0}%` }}
              />
            </div>
          </div>

          {/* Current file / details */}
          {activeProgress?.currentFile && (
            <p className="text-[11px] text-spotify-on-surface font-mono truncate bg-spotify-base/40 p-2 rounded">
              File: {activeProgress.currentFile}
            </p>
          )}

          {/* Guarantee Reminder */}
          <div className="p-3 rounded bg-spotify-base/40 border border-spotify-surface-border text-[11px] text-spotify-on-surface space-y-1">
            <p className="font-semibold text-spotify-secondary">Packaging Local Audio Blobs</p>
            <p>
              Actual binary audio bytes are being bundled directly inside your browser. No files are
              uploaded to Spotify or any third-party server.
            </p>
          </div>

          {/* Cancellation Button */}
          <div className="flex justify-end pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={cancelExport}
              className="text-xs text-spotify-error hover:border-spotify-error"
            >
              Cancel Export
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
