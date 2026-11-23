import React, { useState, useRef, useMemo } from 'react';
import {
  UploadCloud,
  FileAudio,
  Play,
  Trash2,
  Edit3,
  Search,
  Filter,
  Music2,
  HardDrive,
  Users,
  Tag,
  AlertCircle,
  X,
  Clock,
  Loader2,
  Disc3,
  FolderPlus,
  RotateCcw,
  FolderHeart,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { useAudio } from '../context/AudioContext';
import { usePlayer } from '../context/PlayerContext';
import { useCollection } from '../context/CollectionContext';
import { formatBytes, formatDuration } from '../lib/utils';
import { StoredAudioFile } from '../lib/audio/types';
import { PlayableTrackItem } from '../types';

type ViewMode = 'tracks' | 'artists' | 'albums' | 'genres' | 'collections';

export function AudioLibrary() {
  const {
    audioFiles,
    isLoading,
    queue,
    storageStats,
    importAudioFiles,
    cancelUploads,
    clearCompletedUploads,
    deleteAudioFile,
    updateAudioMetadata,
  } = useAudio();

  const { playTrack, playQueue, state: playerState } = usePlayer();
  const {
    collections,
    createCollection,
    deleteCollection,
    addTrackToCollection,
    removeTrackFromCollection,
  } = useCollection();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // View Mode: tracks, artists, albums, genres, collections
  const [viewMode, setViewMode] = useState<ViewMode>('tracks');

  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [selectedArtistFilter, setSelectedArtistFilter] = useState<string | null>(null);
  const [selectedAlbumFilter, setSelectedAlbumFilter] = useState<string | null>(null);
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'album' | 'duration' | 'date' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Multi-Selection State for Bulk Operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);

  // Modals State
  const [editingFile, setEditingFile] = useState<StoredAudioFile | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    artist: '',
    albumArtist: '',
    album: '',
    genre: '',
    year: '',
    trackNumber: '',
    discNumber: '',
    comments: '',
  });
  const [editValidationErrors, setEditValidationErrors] = useState<string[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Batch Edit Modal State
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({
    artist: '',
    album: '',
    genre: '',
    year: '',
  });

  // Create Collection Modal State
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [collectionForm, setCollectionForm] = useState({ name: '', description: '' });

  // Add Selected To Collection Modal State
  const [isAddToCollectionOpen, setIsAddToCollectionOpen] = useState(false);
  const [targetCollectionId, setTargetCollectionId] = useState<string>('');

  // Delete File Modal State
  const [deletingFile, setDeletingFile] = useState<StoredAudioFile | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Extract distinct genres
  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    audioFiles.forEach((file) => {
      if (file.genre && file.genre !== 'Unknown Genre') {
        genres.add(file.genre);
      }
      if (Array.isArray(file.genres)) {
        file.genres.forEach((g) => {
          if (g && g !== 'Unknown Genre') genres.add(g);
        });
      }
    });
    return ['all', ...Array.from(genres).sort()];
  }, [audioFiles]);

  // Extract distinct formats
  const availableFormats = useMemo(() => {
    const formats = new Set<string>();
    audioFiles.forEach((f) => {
      const ext = f.filename.split('.').pop()?.toLowerCase();
      if (ext) formats.add(ext);
    });
    return ['all', ...Array.from(formats).sort()];
  }, [audioFiles]);

  // Groupings for Artists View
  const artistsGrouped = useMemo(() => {
    const map = new Map<string, { artist: string; count: number; totalDurationMs: number; artwork?: string }>();
    audioFiles.forEach((file) => {
      const key = file.artist || 'Unknown Artist';
      const existing = map.get(key) || { artist: key, count: 0, totalDurationMs: 0, artwork: undefined };
      existing.count += 1;
      existing.totalDurationMs += file.duration_ms || 0;
      if (!existing.artwork && file.artwork_data_url) {
        existing.artwork = file.artwork_data_url;
      }
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.artist.localeCompare(b.artist));
  }, [audioFiles]);

  // Groupings for Albums View
  const albumsGrouped = useMemo(() => {
    const map = new Map<
      string,
      { album: string; artist: string; year?: string | null; count: number; totalDurationMs: number; artwork?: string }
    >();
    audioFiles.forEach((file) => {
      const key = `${file.album || 'Unknown Album'}---${file.artist || 'Unknown Artist'}`;
      const existing = map.get(key) || {
        album: file.album || 'Unknown Album',
        artist: file.artist || 'Unknown Artist',
        year: file.year,
        count: 0,
        totalDurationMs: 0,
        artwork: undefined,
      };
      existing.count += 1;
      existing.totalDurationMs += file.duration_ms || 0;
      if (!existing.artwork && file.artwork_data_url) {
        existing.artwork = file.artwork_data_url;
      }
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.album.localeCompare(b.album));
  }, [audioFiles]);

  // Filtered and Sorted Audio Files for Tracks View
  const filteredFiles = useMemo(() => {
    return audioFiles
      .filter((file) => {
        // Direct Collection Filter
        if (selectedCollectionFilter) {
          const col = collections.find((c) => c.id === selectedCollectionFilter);
          if (!col || !col.audio_file_ids.includes(file.id)) return false;
        }

        // Direct Artist Card Filter
        if (selectedArtistFilter && file.artist !== selectedArtistFilter) {
          return false;
        }

        // Direct Album Card Filter
        if (selectedAlbumFilter && file.album !== selectedAlbumFilter) {
          return false;
        }

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = file.title.toLowerCase().includes(q);
          const matchesArtist = file.artist.toLowerCase().includes(q);
          const matchesAlbum = file.album.toLowerCase().includes(q);
          const matchesFilename = file.filename.toLowerCase().includes(q);
          if (!matchesTitle && !matchesArtist && !matchesAlbum && !matchesFilename) {
            return false;
          }
        }

        // Genre filter
        if (selectedGenre !== 'all') {
          const matchPrimary = file.genre.toLowerCase() === selectedGenre.toLowerCase();
          const matchArray = file.genres?.some((g) => g.toLowerCase() === selectedGenre.toLowerCase());
          if (!matchPrimary && !matchArray) return false;
        }

        // Format filter
        if (selectedFormat !== 'all') {
          const ext = file.filename.split('.').pop()?.toLowerCase();
          if (ext !== selectedFormat.toLowerCase()) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'title') {
          cmp = a.title.localeCompare(b.title);
        } else if (sortBy === 'artist') {
          cmp = a.artist.localeCompare(b.artist);
        } else if (sortBy === 'album') {
          cmp = a.album.localeCompare(b.album);
        } else if (sortBy === 'duration') {
          cmp = a.duration_ms - b.duration_ms;
        } else if (sortBy === 'size') {
          cmp = a.file_size_bytes - b.file_size_bytes;
        } else if (sortBy === 'date') {
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [
    audioFiles,
    selectedCollectionFilter,
    collections,
    selectedArtistFilter,
    selectedAlbumFilter,
    searchQuery,
    selectedGenre,
    selectedFormat,
    sortBy,
    sortOrder,
  ]);

  // Convert stored files to Playable items for PlayerContext
  const toPlayableItem = (f: StoredAudioFile): PlayableTrackItem => ({
    id: f.id,
    title: f.title,
    artist: f.artist,
    album: f.album,
    albumArt: f.artwork_data_url || undefined,
    durationMs: f.duration_ms,
    blob: f.blob,
    audioFileId: f.id,
    codec: f.codec,
  });

  // Play a specific file and queue the rest of the current filtered list
  const handlePlayFile = (file: StoredAudioFile) => {
    const playableItems = filteredFiles.map(toPlayableItem);
    const startIndex = filteredFiles.findIndex((f) => f.id === file.id);
    if (startIndex >= 0) {
      playQueue(playableItems, startIndex);
    } else {
      playTrack(toPlayableItem(file));
    }
  };

  // Play all currently filtered files
  const handlePlayAllFiltered = () => {
    if (filteredFiles.length === 0) return;
    playQueue(filteredFiles.map(toPlayableItem), 0);
  };

  // Play selected items only
  const handlePlaySelected = () => {
    const selectedFiles = audioFiles.filter((f) => selectedIds.has(f.id));
    if (selectedFiles.length === 0) return;
    playQueue(selectedFiles.map(toPlayableItem), 0);
  };

  // Checkbox Multi-selection toggle
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredFiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Metadata Editor Handlers
  const openEditModal = (file: StoredAudioFile) => {
    setEditingFile(file);
    setEditValidationErrors([]);
    setEditForm({
      title: file.title || '',
      artist: file.artist || '',
      albumArtist: file.album_artist || '',
      album: file.album || '',
      genre: file.genre || '',
      year: file.year || '',
      trackNumber: file.track_number !== null ? String(file.track_number) : '',
      discNumber: file.disc_number !== null ? String(file.disc_number) : '',
      comments: file.comments || '',
    });
  };

  const validateEditForm = (): boolean => {
    const errors: string[] = [];
    if (!editForm.title.trim()) {
      errors.push('Track title cannot be empty.');
    }
    if (!editForm.artist.trim()) {
      errors.push('Artist name cannot be empty.');
    }
    if (editForm.year.trim()) {
      const yearNum = parseInt(editForm.year.trim(), 10);
      if (isNaN(yearNum) || yearNum < 1000 || yearNum > 2100) {
        errors.push('Year must be a valid 4-digit number (e.g. 2024).');
      }
    }
    if (editForm.trackNumber.trim()) {
      const trackNum = parseInt(editForm.trackNumber.trim(), 10);
      if (isNaN(trackNum) || trackNum < 0) {
        errors.push('Track number must be a non-negative number.');
      }
    }
    if (editForm.discNumber.trim()) {
      const discNum = parseInt(editForm.discNumber.trim(), 10);
      if (isNaN(discNum) || discNum < 0) {
        errors.push('Disc number must be a non-negative number.');
      }
    }
    setEditValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSaveEdit = async () => {
    if (!editingFile) return;
    if (!validateEditForm()) return;

    setIsSavingEdit(true);
    try {
      const trackNumber = editForm.trackNumber.trim() ? parseInt(editForm.trackNumber.trim(), 10) : null;
      const discNumber = editForm.discNumber.trim() ? parseInt(editForm.discNumber.trim(), 10) : null;

      await updateAudioMetadata(editingFile.id, {
        title: editForm.title.trim(),
        artist: editForm.artist.trim(),
        album_artist: editForm.albumArtist.trim() || null,
        album: editForm.album.trim() || 'Unknown Album',
        genre: editForm.genre.trim() || 'Unknown Genre',
        genres: [editForm.genre.trim() || 'Unknown Genre'],
        year: editForm.year.trim() || null,
        track_number: trackNumber,
        disc_number: discNumber,
        comments: editForm.comments.trim() || null,
      });
      setEditingFile(null);
    } catch (err) {
      console.error('[PlaylistVault] Failed to update metadata:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Restore original embedded metadata
  const handleRestoreOriginal = () => {
    if (!editingFile?.original_metadata) return;
    const orig = editingFile.original_metadata;
    setEditForm((prev) => ({
      ...prev,
      title: orig.title || editingFile.filename,
      artist: orig.artist || 'Unknown Artist',
      album: orig.album || 'Unknown Album',
      genre: orig.genre || 'Unknown Genre',
      year: orig.year || '',
      trackNumber: orig.track_number !== undefined && orig.track_number !== null ? String(orig.track_number) : '',
    }));
  };

  // Batch Metadata Updates
  const handleBatchUpdate = async () => {
    if (selectedIds.size === 0) return;
    try {
      const updates: any = {};
      if (batchForm.artist.trim()) updates.artist = batchForm.artist.trim();
      if (batchForm.album.trim()) updates.album = batchForm.album.trim();
      if (batchForm.genre.trim()) {
        updates.genre = batchForm.genre.trim();
        updates.genres = [batchForm.genre.trim()];
      }
      if (batchForm.year.trim()) updates.year = batchForm.year.trim();

      for (const id of selectedIds) {
        await updateAudioMetadata(id, updates);
      }
      setIsBatchEditOpen(false);
      setBatchForm({ artist: '', album: '', genre: '', year: '' });
      setSelectedIds(new Set());
    } catch (err) {
      console.error('[PlaylistVault] Failed to execute batch metadata update:', err);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      for (const id of selectedIds) {
        await deleteAudioFile(id);
      }
      setSelectedIds(new Set());
      setIsDeletingBulk(false);
    } catch (err) {
      console.error('[PlaylistVault] Failed to delete audio files in bulk:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Add Selected to Custom Collection
  const handleAddSelectedToCollection = async () => {
    if (!targetCollectionId || selectedIds.size === 0) return;
    try {
      for (const audioId of selectedIds) {
        await addTrackToCollection(targetCollectionId, audioId);
      }
      setIsAddToCollectionOpen(false);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('[PlaylistVault] Failed to add tracks to collection:', err);
    }
  };

  // Create Collection
  const handleCreateCollection = async () => {
    if (!collectionForm.name.trim()) return;
    try {
      await createCollection(collectionForm.name, collectionForm.description);
      setIsCreateCollectionOpen(false);
      setCollectionForm({ name: '', description: '' });
    } catch (err) {
      console.error('[PlaylistVault] Failed to create collection:', err);
    }
  };

  // File Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      importAudioFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-spotify-secondary">Authorized Audio Library</h1>
          <p className="text-xs text-spotify-on-surface mt-1">
            Local-first audio collection legally possessed or authorized by you. Metadata editing, playlist grouping, and
            queue management.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept="audio/*,.mp3,.flac,.wav,.m4a,.aac,.ogg,.opus,.aiff,.aif"
            className="hidden"
          />
          <Button
            variant="secondary"
            onClick={() => setIsCreateCollectionOpen(true)}
            className="flex items-center gap-1.5 text-xs text-spotify-secondary"
          >
            <FolderPlus className="h-4 w-4" />
            New Collection
          </Button>

          <Button
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-spotify-accent text-spotify-base hover:brightness-105 text-xs"
          >
            <UploadCloud className="h-4 w-4" />
            Import Audio Files
          </Button>
        </div>
      </div>

      {/* Storage Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-spotify-surface border-spotify-surface-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-spotify-surface-border/50 text-spotify-accent">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-spotify-on-surface">Total Files</p>
              <p className="text-xl font-bold text-spotify-secondary">{storageStats.totalFiles}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-spotify-surface border-spotify-surface-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-spotify-surface-border/50 text-spotify-accent">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-spotify-on-surface">Storage Used</p>
              <p className="text-xl font-bold text-spotify-secondary">{formatBytes(storageStats.totalBytes)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-spotify-surface border-spotify-surface-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-spotify-surface-border/50 text-spotify-accent">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-spotify-on-surface">Unique Artists</p>
              <p className="text-xl font-bold text-spotify-secondary">{storageStats.uniqueArtists}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-spotify-surface border-spotify-surface-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-spotify-surface-border/50 text-spotify-accent">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-spotify-on-surface">Genres</p>
              <p className="text-xl font-bold text-spotify-secondary">{storageStats.uniqueGenres}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Upload Queue Banner if Active */}
      {queue.length > 0 && (
        <Card className="p-3 bg-spotify-surface border-spotify-surface-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-spotify-accent" />
            <span className="font-semibold text-spotify-secondary">
              Ingesting {queue.length} files...
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={cancelUploads}>
              Cancel
            </Button>
            <Button variant="secondary" size="sm" onClick={clearCompletedUploads}>
              Clear
            </Button>
          </div>
        </Card>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            importAudioFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-spotify-accent bg-spotify-accent/10'
            : 'border-spotify-surface-border bg-spotify-surface/40 hover:border-spotify-on-surface/50'
        }`}
      >
        <UploadCloud className="h-7 w-7 text-spotify-accent mx-auto mb-1.5" />
        <p className="text-xs font-semibold text-spotify-secondary">
          Drag and drop audio files here, or click to browse
        </p>
        <p className="text-[11px] text-spotify-on-surface mt-0.5">
          Supports MP3, FLAC, WAV, M4A, AAC, OGG, OPUS, AIFF (up to 250 MB per file)
        </p>
      </div>

      {/* View Mode Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-spotify-surface-border pb-2">
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'tracks', label: 'All Tracks', icon: Music2 },
              { id: 'artists', label: 'Artists', icon: Users },
              { id: 'albums', label: 'Albums', icon: Disc3 },
              { id: 'genres', label: 'Genres', icon: Tag },
              { id: 'collections', label: `Collections (${collections.length})`, icon: FolderHeart },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setViewMode(tab.id);
                  setSelectedArtistFilter(null);
                  setSelectedAlbumFilter(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-spotify-secondary text-spotify-base'
                    : 'bg-spotify-surface text-spotify-on-surface hover:text-spotify-secondary'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {viewMode === 'tracks' && filteredFiles.length > 0 && (
          <Button
            variant="primary"
            size="sm"
            onClick={handlePlayAllFiltered}
            className="flex items-center gap-1.5 bg-spotify-accent text-spotify-base text-xs py-1"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Play All
          </Button>
        )}
      </div>

      {/* Active Filter Indicators */}
      {(selectedArtistFilter || selectedAlbumFilter || selectedCollectionFilter) && (
        <div className="flex items-center gap-2 p-2 bg-spotify-surface/80 rounded border border-spotify-surface-border text-xs text-spotify-secondary">
          <span>Active filter:</span>
          {selectedArtistFilter && (
            <Badge variant="info">Artist: {selectedArtistFilter}</Badge>
          )}
          {selectedAlbumFilter && (
            <Badge variant="info">Album: {selectedAlbumFilter}</Badge>
          )}
          {selectedCollectionFilter && (
            <Badge variant="info">
              Collection: {collections.find((c) => c.id === selectedCollectionFilter)?.name}
            </Badge>
          )}
          <button
            onClick={() => {
              setSelectedArtistFilter(null);
              setSelectedAlbumFilter(null);
              setSelectedCollectionFilter(null);
            }}
            className="ml-auto text-[11px] text-spotify-accent hover:underline flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Clear Filter
          </button>
        </div>
      )}

      {/* VIEWS */}

      {/* 1. TRACKS VIEW */}
      {viewMode === 'tracks' && (
        <div className="space-y-4">
          {/* Controls: Search, Genre, Format, Sorting */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-spotify-on-surface" />
              <input
                type="text"
                placeholder="Search by title, artist, album, filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-spotify-surface border border-spotify-surface-border rounded-full pl-9 pr-4 py-1.5 text-xs text-spotify-secondary placeholder-spotify-on-surface focus:outline-none focus:border-spotify-accent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-spotify-on-surface hover:text-spotify-secondary"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Genre Filter */}
              <div className="flex items-center gap-1.5 text-xs text-spotify-on-surface">
                <Filter className="h-3.5 w-3.5" />
                <span>Genre:</span>
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="bg-spotify-surface border border-spotify-surface-border rounded px-2 py-1 text-xs text-spotify-secondary focus:outline-none focus:border-spotify-accent"
                >
                  {availableGenres.map((g) => (
                    <option key={g} value={g}>
                      {g === 'all' ? 'All Genres' : g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Format Filter */}
              <div className="flex items-center gap-1.5 text-xs text-spotify-on-surface">
                <span>Format:</span>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="bg-spotify-surface border border-spotify-surface-border rounded px-2 py-1 text-xs text-spotify-secondary focus:outline-none focus:border-spotify-accent"
                >
                  {availableFormats.map((f) => (
                    <option key={f} value={f}>
                      {f === 'all' ? 'All Formats' : f.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-1 text-xs text-spotify-on-surface">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-spotify-surface border border-spotify-surface-border rounded px-2 py-1 text-xs text-spotify-secondary focus:outline-none focus:border-spotify-accent"
                >
                  <option value="date">Date Added</option>
                  <option value="title">Title</option>
                  <option value="artist">Artist</option>
                  <option value="album">Album</option>
                  <option value="duration">Duration</option>
                  <option value="size">File Size</option>
                </select>
                <button
                  onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="px-1.5 py-1 bg-spotify-surface border border-spotify-surface-border rounded text-xs text-spotify-secondary hover:border-spotify-accent"
                  title="Toggle Sort Order"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>

          {/* Tracks Table */}
          {isLoading ? (
            <div className="p-12 text-center text-spotify-on-surface">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-spotify-accent" />
              <p className="text-xs">Loading local audio library...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-spotify-surface-border rounded-lg bg-spotify-surface/20">
              <FileAudio className="h-10 w-10 text-spotify-on-surface mx-auto mb-3 opacity-60" />
              <h3 className="text-sm font-semibold text-spotify-secondary">No audio files found</h3>
              <p className="text-xs text-spotify-on-surface mt-1 max-w-sm mx-auto">
                {searchQuery || selectedGenre !== 'all' || selectedFormat !== 'all'
                  ? 'Try adjusting your search query or filters.'
                  : 'Import your legally possessed audio files above to extract metadata and begin organizing your music.'}
              </p>
            </div>
          ) : (
            <div className="border border-spotify-surface-border rounded-lg overflow-hidden bg-spotify-surface/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-spotify-surface-border text-spotify-on-surface uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3 w-10 text-center">
                        <button onClick={toggleSelectAll} className="p-0.5 text-spotify-on-surface hover:text-spotify-secondary">
                          {selectedIds.size === filteredFiles.length && filteredFiles.length > 0 ? (
                            <CheckSquare className="h-4 w-4 text-spotify-accent" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </th>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-4">Title</th>
                      <th className="py-2.5 px-4">Artist</th>
                      <th className="py-2.5 px-4 hidden md:table-cell">Album</th>
                      <th className="py-2.5 px-4 hidden lg:table-cell">Genre</th>
                      <th className="py-2.5 px-4">Format</th>
                      <th className="py-2.5 px-4 hidden sm:table-cell">Size</th>
                      <th className="py-2.5 px-4 text-right">
                        <Clock className="h-3.5 w-3.5 inline" />
                      </th>
                      <th className="py-2.5 px-4 text-center w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-spotify-surface-border/40">
                    {filteredFiles.map((file) => {
                      const isCurrentlyPlaying =
                        playerState.currentAudioFileId === file.id && playerState.isPlaying;
                      const isSelected = selectedIds.has(file.id);

                      return (
                        <tr
                          key={file.id}
                          className={`hover:bg-spotify-surface-border/30 transition-colors group ${
                            isSelected ? 'bg-spotify-surface-border/20' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => toggleSelectOne(file.id)}
                              className="p-0.5 text-spotify-on-surface hover:text-spotify-secondary"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4 text-spotify-accent" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          </td>

                          {/* Play Button */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handlePlayFile(file)}
                              className="h-7 w-7 rounded-full flex items-center justify-center transition-all bg-transparent group-hover:bg-spotify-accent text-spotify-on-surface group-hover:text-spotify-base"
                              title="Play Track"
                            >
                              <Play
                                className={`h-3.5 w-3.5 ml-0.5 ${
                                  isCurrentlyPlaying ? 'text-spotify-accent fill-spotify-accent' : ''
                                }`}
                              />
                            </button>
                          </td>

                          {/* Title & Artwork */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-3">
                              {file.artwork_data_url ? (
                                <img
                                  src={file.artwork_data_url}
                                  alt={file.title}
                                  className="h-8 w-8 rounded object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded bg-spotify-surface-border flex items-center justify-center text-spotify-on-surface flex-shrink-0">
                                  <Music2 className="h-3.5 w-3.5" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p
                                  className={`font-semibold truncate max-w-[200px] sm:max-w-xs ${
                                    isCurrentlyPlaying ? 'text-spotify-accent' : 'text-spotify-secondary'
                                  }`}
                                >
                                  {file.title}
                                </p>
                                <p className="text-[10px] text-spotify-on-surface truncate max-w-[200px] sm:max-w-xs">
                                  {file.filename}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Artist */}
                          <td className="py-2.5 px-4 text-spotify-secondary truncate max-w-[140px]">
                            {file.artist}
                          </td>

                          {/* Album */}
                          <td className="py-2.5 px-4 text-spotify-on-surface truncate max-w-[140px] hidden md:table-cell">
                            {file.album}
                          </td>

                          {/* Genre */}
                          <td className="py-2.5 px-4 hidden lg:table-cell">
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-spotify-surface-border text-spotify-secondary">
                              {file.genre || 'Unknown'}
                            </span>
                          </td>

                          {/* Format */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="neutral">{file.codec}</Badge>
                              {file.bitrate_kbps && (
                                <span className="text-[10px] text-spotify-on-surface hidden xl:inline">
                                  {file.bitrate_kbps}k
                                </span>
                              )}
                            </div>
                          </td>

                          {/* File Size */}
                          <td className="py-2.5 px-4 text-spotify-on-surface text-xs hidden sm:table-cell">
                            {formatBytes(file.file_size_bytes)}
                          </td>

                          {/* Duration */}
                          <td className="py-2.5 px-4 text-right font-mono text-xs text-spotify-on-surface">
                            {formatDuration(file.duration_ms)}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100">
                              {selectedCollectionFilter && (
                                <button
                                  onClick={() => removeTrackFromCollection(selectedCollectionFilter, file.id)}
                                  className="p-1 rounded hover:bg-spotify-surface text-spotify-on-surface hover:text-spotify-warning transition-colors"
                                  title="Remove from this collection"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => openEditModal(file)}
                                className="p-1 rounded hover:bg-spotify-surface text-spotify-on-surface hover:text-spotify-secondary transition-colors"
                                title="Edit Metadata Tags"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingFile(file)}
                                className="p-1 rounded hover:bg-spotify-surface text-spotify-on-surface hover:text-spotify-error transition-colors"
                                title="Delete Audio File"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. ARTISTS VIEW */}
      {viewMode === 'artists' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {artistsGrouped.map((a) => (
            <Card
              key={a.artist}
              onClick={() => {
                setSelectedArtistFilter(a.artist);
                setViewMode('tracks');
              }}
              className="p-4 bg-spotify-surface hover:bg-spotify-surface-border/40 transition-colors cursor-pointer border-spotify-surface-border text-center space-y-2 group"
            >
              <div className="w-20 h-20 rounded-full bg-spotify-surface-border mx-auto flex items-center justify-center overflow-hidden text-spotify-on-surface group-hover:scale-105 transition-transform">
                {a.artwork ? (
                  <img src={a.artwork} alt={a.artist} className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-8 h-8" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-spotify-secondary truncate">{a.artist}</p>
                <p className="text-[11px] text-spotify-on-surface">
                  {a.count} {a.count === 1 ? 'track' : 'tracks'} • {formatDuration(a.totalDurationMs)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 3. ALBUMS VIEW */}
      {viewMode === 'albums' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {albumsGrouped.map((alb) => (
            <Card
              key={`${alb.album}-${alb.artist}`}
              onClick={() => {
                setSelectedAlbumFilter(alb.album);
                setViewMode('tracks');
              }}
              className="p-3 bg-spotify-surface hover:bg-spotify-surface-border/40 transition-colors cursor-pointer border-spotify-surface-border space-y-2 group"
            >
              <div className="w-full aspect-square rounded bg-spotify-surface-border flex items-center justify-center overflow-hidden text-spotify-on-surface">
                {alb.artwork ? (
                  <img src={alb.artwork} alt={alb.album} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <Disc3 className="w-10 h-10" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-spotify-secondary truncate">{alb.album}</p>
                <p className="text-[11px] text-spotify-on-surface truncate">{alb.artist}</p>
                <p className="text-[10px] text-spotify-on-surface/80">
                  {alb.count} tracks {alb.year ? `• ${alb.year}` : ''}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 4. GENRES VIEW */}
      {viewMode === 'genres' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {availableGenres
            .filter((g) => g !== 'all')
            .map((genre) => {
              const genreFiles = audioFiles.filter(
                (f) => f.genre === genre || f.genres?.includes(genre)
              );
              return (
                <Card
                  key={genre}
                  onClick={() => {
                    setSelectedGenre(genre);
                    setViewMode('tracks');
                  }}
                  className="p-4 bg-spotify-surface hover:bg-spotify-surface-border/40 transition-colors cursor-pointer border-spotify-surface-border space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <Tag className="w-5 h-5 text-spotify-accent" />
                    <Badge variant="neutral">{genreFiles.length} tracks</Badge>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-spotify-secondary">{genre}</h3>
                    <p className="text-[10px] text-spotify-on-surface">Click to view all tracks</p>
                  </div>
                </Card>
              );
            })}
        </div>
      )}

      {/* 5. CUSTOM COLLECTIONS VIEW */}
      {viewMode === 'collections' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-spotify-secondary">Your Custom Local Playlists</h3>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateCollectionOpen(true)}
              className="bg-spotify-accent text-spotify-base text-xs"
            >
              + Create Collection
            </Button>
          </div>

          {collections.length === 0 ? (
            <div className="p-10 text-center border border-dashed border-spotify-surface-border rounded-lg bg-spotify-surface/20">
              <FolderHeart className="h-8 w-8 text-spotify-on-surface mx-auto mb-2 opacity-50" />
              <p className="text-xs text-spotify-secondary font-semibold">No custom collections yet</p>
              <p className="text-[11px] text-spotify-on-surface mt-1">
                Create collections to organize your local music for custom ZIP exports and offline listening.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {collections.map((col) => (
                <Card key={col.id} className="p-4 bg-spotify-surface border-spotify-surface-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderHeart className="w-5 h-5 text-spotify-accent" />
                      <h4 className="text-xs font-bold text-spotify-secondary truncate max-w-[160px]">
                        {col.name}
                      </h4>
                    </div>
                    <button
                      onClick={() => deleteCollection(col.id)}
                      className="p-1 text-spotify-on-surface hover:text-spotify-error"
                      title="Delete Collection"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {col.description && (
                    <p className="text-[11px] text-spotify-on-surface line-clamp-2">{col.description}</p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-spotify-surface-border text-xs">
                    <span className="text-[10px] text-spotify-on-surface">
                      {col.audio_file_ids.length} {col.audio_file_ids.length === 1 ? 'file' : 'files'}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedCollectionFilter(col.id);
                        setViewMode('tracks');
                      }}
                      className="text-[10px] py-1 px-2.5"
                    >
                      View Tracks
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FLOATING MULTI-SELECT ACTION BAR */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-spotify-surface border border-spotify-accent/40 rounded-full px-5 py-2.5 shadow-2xl flex items-center gap-3 backdrop-blur-md">
          <span className="text-xs font-semibold text-spotify-secondary">
            {selectedIds.size} {selectedIds.size === 1 ? 'track' : 'tracks'} selected
          </span>
          <div className="h-4 w-px bg-spotify-surface-border" />
          <Button
            variant="primary"
            size="sm"
            onClick={handlePlaySelected}
            className="bg-spotify-accent text-spotify-base text-xs py-1"
          >
            <Play className="w-3 h-3 fill-current mr-1" />
            Play Selected
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsBatchEditOpen(true)}
            className="text-xs py-1"
          >
            <Edit3 className="w-3 h-3 mr-1" />
            Batch Edit
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAddToCollectionOpen(true)}
            className="text-xs py-1"
          >
            <FolderPlus className="w-3 h-3 mr-1" />
            Add to Collection
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsDeletingBulk(true)}
            className="text-xs py-1 text-spotify-error hover:border-spotify-error"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Delete
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1 text-spotify-on-surface hover:text-spotify-secondary ml-1"
            title="Deselect All"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ENHANCED METADATA EDITOR MODAL */}
      {editingFile && (
        <Modal
          isOpen={true}
          onClose={() => setEditingFile(null)}
          title="Inspect & Edit Audio Metadata"
          className="max-w-lg"
        >
          <div className="space-y-4">
            {/* Technical Specifications */}
            <div className="p-3 bg-spotify-surface-border/20 rounded border border-spotify-surface-border text-xs space-y-1.5">
              <p className="font-semibold text-spotify-secondary flex items-center gap-1.5">
                <FileAudio className="h-3.5 w-3.5 text-spotify-accent" />
                Technical Attributes
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-spotify-on-surface">
                <p>Format / Codec: <span className="text-spotify-secondary">{editingFile.codec}</span></p>
                <p>Size: <span className="text-spotify-secondary">{formatBytes(editingFile.file_size_bytes)}</span></p>
                <p>Bitrate: <span className="text-spotify-secondary">{editingFile.bitrate_kbps ? `${editingFile.bitrate_kbps} kbps` : 'Variable'}</span></p>
                <p>Sample Rate: <span className="text-spotify-secondary">{editingFile.sample_rate_hz ? `${editingFile.sample_rate_hz} Hz` : 'N/A'}</span></p>
                <p>Channels: <span className="text-spotify-secondary">{editingFile.channels === 2 ? 'Stereo' : editingFile.channels === 1 ? 'Mono' : editingFile.channels || 'N/A'}</span></p>
                <p>Duration: <span className="text-spotify-secondary">{formatDuration(editingFile.duration_ms)}</span></p>
              </div>
              <div className="pt-1 border-t border-spotify-surface-border/40">
                <p className="text-[10px] text-spotify-on-surface font-mono truncate">
                  SHA-256: {editingFile.file_hash}
                </p>
              </div>
            </div>

            {/* Validation Errors Box */}
            {editValidationErrors.length > 0 && (
              <div className="p-2.5 bg-spotify-error/15 border border-spotify-error/40 rounded text-xs text-spotify-error space-y-1">
                {editValidationErrors.map((err, idx) => (
                  <p key={idx}>• {err}</p>
                ))}
              </div>
            )}

            {/* Editable Tags Form */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-spotify-secondary mb-1">Track Title *</label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Track Title"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-spotify-secondary mb-1">Artist *</label>
                  <Input
                    value={editForm.artist}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, artist: e.target.value }))}
                    placeholder="Artist Name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-spotify-secondary mb-1">Album Artist</label>
                  <Input
                    value={editForm.albumArtist}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, albumArtist: e.target.value }))}
                    placeholder="Album Artist"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-spotify-secondary mb-1">Album</label>
                <Input
                  value={editForm.album}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, album: e.target.value }))}
                  placeholder="Album Title"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-spotify-secondary mb-1">Genre</label>
                  <Input
                    value={editForm.genre}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, genre: e.target.value }))}
                    placeholder="Genre"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-spotify-secondary mb-1">Year</label>
                  <Input
                    value={editForm.year}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, year: e.target.value }))}
                    placeholder="e.g. 2024"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-spotify-secondary mb-1">Track #</label>
                  <Input
                    value={editForm.trackNumber}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, trackNumber: e.target.value }))}
                    placeholder="e.g. 1"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-spotify-surface-border">
              {editingFile.original_metadata ? (
                <button
                  type="button"
                  onClick={handleRestoreOriginal}
                  className="text-xs text-spotify-on-surface hover:text-spotify-accent flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore Original Tags
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setEditingFile(null)} disabled={isSavingEdit}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="bg-spotify-accent text-spotify-base"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* BATCH EDIT METADATA MODAL */}
      {isBatchEditOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsBatchEditOpen(false)}
          title={`Batch Edit ${selectedIds.size} Selected Tracks`}
          className="max-w-md"
        >
          <div className="space-y-4">
            <p className="text-xs text-spotify-on-surface">
              Fields left blank will keep their existing values on all selected tracks.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-spotify-secondary mb-1">Artist</label>
                <Input
                  value={batchForm.artist}
                  onChange={(e) => setBatchForm((prev) => ({ ...prev, artist: e.target.value }))}
                  placeholder="Leave blank to keep existing"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-spotify-secondary mb-1">Album</label>
                <Input
                  value={batchForm.album}
                  onChange={(e) => setBatchForm((prev) => ({ ...prev, album: e.target.value }))}
                  placeholder="Leave blank to keep existing"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-spotify-secondary mb-1">Genre</label>
                  <Input
                    value={batchForm.genre}
                    onChange={(e) => setBatchForm((prev) => ({ ...prev, genre: e.target.value }))}
                    placeholder="e.g. Rock"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-spotify-secondary mb-1">Year</label>
                  <Input
                    value={batchForm.year}
                    onChange={(e) => setBatchForm((prev) => ({ ...prev, year: e.target.value }))}
                    placeholder="e.g. 2024"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-spotify-surface-border">
              <Button variant="secondary" onClick={() => setIsBatchEditOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleBatchUpdate} className="bg-spotify-accent text-spotify-base">
                Apply to {selectedIds.size} Tracks
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* CREATE COLLECTION MODAL */}
      {isCreateCollectionOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsCreateCollectionOpen(false)}
          title="Create New Custom Collection"
          className="max-w-md"
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-spotify-secondary mb-1">Collection Name *</label>
              <Input
                value={collectionForm.name}
                onChange={(e) => setCollectionForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Roadtrip Favorites"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-spotify-secondary mb-1">Description (Optional)</label>
              <Input
                value={collectionForm.description}
                onChange={(e) => setCollectionForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-spotify-surface-border">
              <Button variant="secondary" onClick={() => setIsCreateCollectionOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateCollection}
                disabled={!collectionForm.name.trim()}
                className="bg-spotify-accent text-spotify-base"
              >
                Create
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ADD SELECTED TO COLLECTION MODAL */}
      {isAddToCollectionOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddToCollectionOpen(false)}
          title="Add Tracks to Collection"
          className="max-w-md"
        >
          <div className="space-y-3">
            {collections.length === 0 ? (
              <p className="text-xs text-spotify-on-surface">
                No collections available. Create a collection first.
              </p>
            ) : (
              <div>
                <label className="block text-xs font-medium text-spotify-secondary mb-1">Select Target Collection</label>
                <select
                  value={targetCollectionId}
                  onChange={(e) => setTargetCollectionId(e.target.value)}
                  className="w-full bg-spotify-surface border border-spotify-surface-border rounded p-2 text-xs text-spotify-secondary focus:outline-none focus:border-spotify-accent"
                >
                  <option value="">-- Choose a collection --</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.audio_file_ids.length} tracks)
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-spotify-surface-border">
              <Button variant="secondary" onClick={() => setIsAddToCollectionOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAddSelectedToCollection}
                disabled={!targetCollectionId}
                className="bg-spotify-accent text-spotify-base"
              >
                Add {selectedIds.size} Tracks
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* DELETE SINGLE FILE CONFIRMATION MODAL */}
      {deletingFile && (
        <Modal
          isOpen={true}
          onClose={() => setDeletingFile(null)}
          title="Delete Local Audio File"
          className="max-w-sm"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-spotify-error">
              <AlertCircle className="h-6 w-6 flex-shrink-0" />
              <p className="text-sm font-semibold text-spotify-secondary">
                Permanently delete "{deletingFile.title}"?
              </p>
            </div>
            <p className="text-xs text-spotify-on-surface">
              This permanently removes the binary audio data from your browser's local storage. This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setDeletingFile(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await deleteAudioFile(deletingFile.id);
                    setDeletingFile(null);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="bg-spotify-error text-white"
              >
                {isDeleting ? 'Deleting...' : 'Delete File'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* DELETE BULK CONFIRMATION MODAL */}
      {isDeletingBulk && (
        <Modal
          isOpen={true}
          onClose={() => setIsDeletingBulk(false)}
          title={`Delete ${selectedIds.size} Audio Files`}
          className="max-w-sm"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-spotify-error">
              <AlertCircle className="h-6 w-6 flex-shrink-0" />
              <p className="text-sm font-semibold text-spotify-secondary">
                Delete {selectedIds.size} audio files permanently?
              </p>
            </div>
            <p className="text-xs text-spotify-on-surface">
              This will permanently delete the binary audio data for all selected files from your local IndexedDB storage.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setIsDeletingBulk(false)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="bg-spotify-error text-white"
              >
                {isDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Files`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
