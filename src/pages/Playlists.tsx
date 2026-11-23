import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ListMusic,
  Plus,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Playlist } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSpotify, ImportProgressUpdate } from '../context/SpotifyContext';
import { getUserPlaylists } from '../lib/repository/playlistRepository';
import { parseSpotifyPlaylistUrl } from '../lib/spotify/playlistParser';

export function Playlists() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isConnected, connectSpotify, importPlaylist } = useSpotify();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [playlistInput, setPlaylistInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgressUpdate | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const loadPlaylists = useCallback(async () => {
    setIsLoading(true);
    try {
      const userId = user?.id || '00000000-0000-0000-0000-000000000001';
      const items = await getUserPlaylists(userId);
      setPlaylists(items);
    } catch (err) {
      console.error('Failed to load playlists:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  // Real-time validation of input
  const validationResult = playlistInput.trim()
    ? parseSpotifyPlaylistUrl(playlistInput)
    : null;

  const handleOpenModal = () => {
    setPlaylistInput('');
    setImportProgress(null);
    setImportError(null);
    setIsImportModalOpen(true);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validationResult || !validationResult.success || !validationResult.playlistId) {
      return;
    }

    if (!isConnected) {
      setImportError('Please connect your Spotify account first using OAuth PKCE.');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const saved = await importPlaylist(validationResult.playlistId, (update) => {
        setImportProgress(update);
      });

      await loadPlaylists();

      setTimeout(() => {
        setIsImportModalOpen(false);
        setIsImporting(false);
        setImportProgress(null);
        navigate(`/playlists/${saved.id}`);
      }, 1200);
    } catch (err) {
      setIsImporting(false);
      setImportError(
        err instanceof Error ? err.message : 'An error occurred during playlist import.'
      );
    }
  };

  const filteredPlaylists = playlists.filter((p) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      (p.owner_name && p.owner_name.toLowerCase().includes(query)) ||
      (p.description && p.description.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-spotify-secondary">Your Playlists</h1>
          <p className="text-xs text-spotify-on-surface mt-1">
            Imported Spotify playlist metadata ready for local audio matching and offline archiving.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenModal}
          className="gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Import Spotify Playlist
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="max-w-md">
        <Input
          placeholder="Filter playlists by title or curator..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* Playlist Grid / Loading / Empty State */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 animate-spin text-spotify-primary mb-3" />
          <p className="text-xs text-spotify-on-surface">Loading your vaulted playlists...</p>
        </div>
      ) : filteredPlaylists.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-spotify-border/80">
          <div className="w-16 h-16 rounded-full bg-spotify-surface-elevated text-spotify-on-surface flex items-center justify-center mb-4">
            <ListMusic className="w-8 h-8 text-spotify-primary" />
          </div>
          <h3 className="text-base font-bold text-spotify-secondary mb-1">
            {searchQuery ? 'No Matching Playlists Found' : 'No Spotify Playlists Imported Yet'}
          </h3>
          <p className="text-xs text-spotify-on-surface max-w-sm mb-6 leading-relaxed">
            {searchQuery
              ? `No playlists match "${searchQuery}". Clear your search query to see all playlists.`
              : 'Import official Spotify playlist metadata by URL or ID. Track names, artists, and album art will be loaded securely.'}
          </p>
          {searchQuery ? (
            <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
              Clear Search
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={handleOpenModal} className="gap-2">
              <Plus className="w-4 h-4" />
              Import First Playlist
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPlaylists.map((playlist) => (
            <Card
              key={playlist.id}
              variant="interactive"
              onClick={() => navigate(`/playlists/${playlist.id}`)}
              className="group flex flex-col justify-between"
            >
              <div>
                <div className="aspect-square w-full rounded-sm bg-spotify-surface-elevated overflow-hidden mb-3 border border-spotify-border/40">
                  {playlist.image_url ? (
                    <img
                      src={playlist.image_url}
                      alt={playlist.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-spotify-on-surface">
                      <ListMusic className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <h4 className="font-bold text-sm text-spotify-secondary truncate">
                  {playlist.name}
                </h4>
                <p className="text-xs text-spotify-on-surface line-clamp-2 mt-0.5">
                  {playlist.description || `Curated by ${playlist.owner_name || 'Spotify User'}`}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-spotify-border/40 flex items-center justify-between text-xs text-spotify-on-surface">
                <span>{playlist.total_tracks} tracks</span>
                <Badge variant="neutral" size="sm">
                  Ready to Match
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Import Playlist Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          if (!isImporting) setIsImportModalOpen(false);
        }}
        title="Import Spotify Playlist Metadata"
        description="Enter a public or authorized Spotify playlist URL, URI, or raw playlist ID."
      >
        <form onSubmit={handleImportSubmit} className="space-y-4">
          {/* Connection requirement check banner */}
          {!isConnected && (
            <div className="p-3.5 rounded-md bg-spotify-surface-highlight border border-yellow-500/30 flex items-start gap-3">
              <Link2 className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold text-spotify-secondary">Spotify Connection Required</span>
                <p className="text-spotify-on-surface">
                  To import metadata via the official Spotify Web API, connect your account via OAuth PKCE.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => connectSpotify('/playlists')}
                  className="mt-1 h-7 px-3 text-xs"
                >
                  Connect Spotify Now
                </Button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-spotify-secondary mb-1.5">
              Spotify Playlist Link or ID
            </label>
            <Input
              placeholder="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
              value={playlistInput}
              onChange={(e) => setPlaylistInput(e.target.value)}
              disabled={isImporting}
              autoFocus
              required
            />

            {/* Validation Feedback */}
            {validationResult && (
              <div className="mt-2 text-xs">
                {validationResult.success ? (
                  <div className="text-spotify-primary flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Valid playlist ID: <code className="font-mono">{validationResult.playlistId}</code></span>
                  </div>
                ) : (
                  <div className="text-spotify-error flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{validationResult.error}</span>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-spotify-on-surface mt-2 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-spotify-primary" />
              Only metadata is fetched. No audio files are downloaded or recorded.
            </p>
          </div>

          {/* Import Progress Section */}
          {importProgress && (
            <div className="p-3.5 rounded-md bg-spotify-surface-highlight border border-spotify-border/60 space-y-3">
              {/* Playlist Preview if available */}
              {importProgress.preview && (
                <div className="flex items-center gap-3 pb-2 border-b border-spotify-border/40">
                  {importProgress.preview.imageUrl ? (
                    <img
                      src={importProgress.preview.imageUrl}
                      alt={importProgress.preview.name}
                      className="w-10 h-10 rounded-sm object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-sm bg-spotify-surface flex items-center justify-center">
                      <ListMusic className="w-5 h-5 text-spotify-on-surface" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs text-spotify-secondary truncate">
                      {importProgress.preview.name}
                    </h5>
                    <p className="text-[11px] text-spotify-on-surface truncate">
                      By {importProgress.preview.owner}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs">
                {importProgress.status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-spotify-primary flex-shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 text-spotify-primary animate-spin flex-shrink-0" />
                )}
                <span className="text-spotify-secondary font-medium">
                  {importProgress.message}
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {importError && (
            <div className="p-3 rounded-md bg-spotify-error/15 border border-spotify-error/30 text-xs text-spotify-error flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Import Error</span>
                <span>{importError}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-spotify-border/40">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isImporting}
              onClick={() => setIsImportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!validationResult?.success || isImporting || !isConnected}
              isLoading={isImporting}
              className="gap-2"
            >
              <span>{isImporting ? 'Importing Metadata...' : 'Fetch Metadata'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
