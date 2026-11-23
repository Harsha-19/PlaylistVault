import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  ListMusic,
  Cpu,
  Archive,
  Music2,
  Search,
  ExternalLink,
  RefreshCw,
  Trash2,
  Loader2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Playlist, Track } from '../types';
import { getPlaylistDetails, deletePlaylist } from '../lib/repository/playlistRepository';
import { useSpotify } from '../context/SpotifyContext';
import { formatDuration, formatDate } from '../lib/utils';

export function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { refreshPlaylistData, isConnected } = useSpotify();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getPlaylistDetails(id);
      if (data) {
        setPlaylist(data.playlist);
        setTracks(data.tracks);
      } else {
        setPlaylist(null);
        setTracks([]);
      }
    } catch (err) {
      console.error('Error fetching playlist details:', err);
      setErrorMessage('Failed to load playlist data.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    if (!playlist || isRefreshing) return;
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      await refreshPlaylistData(playlist.id);
      await loadData();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to refresh metadata from Spotify.'
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (!playlist) return;
    try {
      await deletePlaylist(playlist.id);
      navigate('/playlists');
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
  };

  // Calculate total playlist duration
  const totalDurationMs = useMemo(() => {
    return tracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);
  }, [tracks]);

  const formattedTotalDuration = useMemo(() => {
    const totalMinutes = Math.floor(totalDurationMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
  }, [totalDurationMs]);

  // Search filter
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const query = searchQuery.toLowerCase();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.artist.toLowerCase().includes(query) ||
        (t.album && t.album.toLowerCase().includes(query))
    );
  }, [tracks, searchQuery]);

  if (isLoading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-center">
        <Loader2 className="w-8 h-8 animate-spin text-spotify-primary mb-3" />
        <p className="text-xs text-spotify-on-surface">Loading playlist metadata...</p>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="space-y-6">
        <Button
          variant="tertiary"
          size="sm"
          onClick={() => navigate('/playlists')}
          className="flex items-center gap-1.5 text-xs text-spotify-on-surface hover:text-spotify-secondary"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Playlists
        </Button>
        <Card className="p-12 text-center space-y-4">
          <Music2 className="w-12 h-12 text-spotify-on-surface mx-auto" />
          <h2 className="text-lg font-bold text-spotify-secondary">Playlist Not Found</h2>
          <p className="text-xs text-spotify-on-surface max-w-sm mx-auto">
            The playlist you are looking for may have been removed or does not belong to your account.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/playlists')}>
            View All Playlists
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Back Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="tertiary"
          size="sm"
          onClick={() => navigate('/playlists')}
          className="flex items-center gap-1.5 text-xs text-spotify-on-surface hover:text-spotify-secondary"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Playlists
        </Button>

        {playlist.external_url && (
          <a
            href={playlist.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-spotify-on-surface hover:text-spotify-primary font-semibold transition-colors"
          >
            <span>View on Spotify</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Hero Playlist Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end gap-6 bg-gradient-to-b from-spotify-surface to-spotify-neutral p-6 rounded-md border border-spotify-border/40">
        <div className="w-48 h-48 rounded-sm bg-spotify-surface-elevated shadow-2xl flex-shrink-0 overflow-hidden flex items-center justify-center border border-spotify-border/60">
          {playlist.image_url ? (
            <img
              src={playlist.image_url}
              alt={playlist.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <ListMusic className="w-20 h-20 text-spotify-on-surface" />
          )}
        </div>

        <div className="space-y-3 flex-1 min-w-0">
          <span className="text-xs uppercase font-bold text-spotify-secondary tracking-widest block">
            Spotify Playlist
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold text-spotify-secondary tracking-tight truncate">
            {playlist.name}
          </h1>
          {playlist.description && (
            <p className="text-xs text-spotify-on-surface line-clamp-2 max-w-2xl leading-relaxed">
              {playlist.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-spotify-secondary font-semibold">
            <span>By {playlist.owner_name || 'Spotify Curator'}</span>
            <span>•</span>
            <span>{tracks.length} tracks</span>
            {totalDurationMs > 0 && (
              <>
                <span>•</span>
                <span>{formattedTotalDuration}</span>
              </>
            )}
            <span>•</span>
            <span className="text-spotify-on-surface/80">
              Synced {formatDate(playlist.updated_at || playlist.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Error alert banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-md bg-spotify-error/15 border border-spotify-error/30 text-xs text-spotify-error flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Sync Error: </span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-spotify-border/40">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/match')}
            className="gap-2"
          >
            <Cpu className="w-4 h-4" />
            Match Audio Files
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/export')}
            className="gap-2"
          >
            <Archive className="w-4 h-4" />
            Export Archive
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || !isConnected}
            isLoading={isRefreshing}
            className="gap-2"
            title={!isConnected ? 'Connect Spotify in Settings to synchronize' : 'Refresh metadata from Spotify'}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isRefreshing ? 'Syncing...' : 'Sync with Spotify'}</span>
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => setIsDeleteModalOpen(true)}
            className="text-spotify-error hover:text-spotify-error/80 gap-1.5 text-xs font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Playlist
          </Button>
        </div>
      </div>

      {/* Track Search Filter */}
      <div className="max-w-md">
        <Input
          placeholder="Filter tracks by title, artist, or album..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* Tracks Table */}
      <Card className="p-0 overflow-hidden border border-spotify-border/50">
        {filteredTracks.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Music2 className="w-10 h-10 text-spotify-on-surface mx-auto" />
            <h4 className="font-bold text-sm text-spotify-secondary">
              {searchQuery ? 'No tracks match your search' : 'No tracks in this playlist'}
            </h4>
            <p className="text-xs text-spotify-on-surface max-w-sm mx-auto">
              {searchQuery
                ? 'Try searching with a different track title, artist, or album.'
                : 'This playlist currently has no tracks available from Spotify.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-spotify-secondary min-w-[650px]">
              <thead className="bg-spotify-surface-highlight text-spotify-on-surface text-[11px] uppercase tracking-wider border-b border-spotify-border/40">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Title & Artist</th>
                  <th className="py-3 px-4">Album</th>
                  <th className="py-3 px-4 hidden md:table-cell">Release</th>
                  <th className="py-3 px-4 text-right w-24">
                    <Clock className="w-3.5 h-3.5 ml-auto" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-spotify-border/20 text-xs">
                {filteredTracks.map((track) => (
                  <tr
                    key={track.id}
                    className="hover:bg-spotify-surface/70 transition-colors group"
                  >
                    <td className="py-3 px-4 text-center text-spotify-on-surface font-mono">
                      {track.track_number}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {track.cover_art_url ? (
                          <img
                            src={track.cover_art_url}
                            alt={track.album || track.title}
                            className="w-10 h-10 rounded-sm object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-sm bg-spotify-surface-elevated flex items-center justify-center flex-shrink-0">
                            <Music2 className="w-5 h-5 text-spotify-on-surface" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-spotify-secondary truncate flex items-center gap-1.5">
                            <span className="truncate">{track.title}</span>
                            {track.explicit && (
                              <Badge variant="neutral" size="sm" className="text-[9px] px-1 py-0 font-bold uppercase">
                                E
                              </Badge>
                            )}
                          </div>
                          <div className="text-spotify-on-surface text-[11px] truncate">
                            {track.artist}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-spotify-on-surface truncate max-w-xs">
                      {track.album || '—'}
                    </td>

                    <td className="py-3 px-4 text-spotify-on-surface truncate hidden md:table-cell">
                      {track.release_date ? (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-spotify-on-surface/60" />
                          <span>{track.release_date}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="py-3 px-4 text-right text-spotify-on-surface font-mono">
                      {formatDuration(track.duration_ms)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Playlist"
        description="Are you sure you want to remove this playlist from PlaylistVault? This action cannot be undone."
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-spotify-on-surface leading-relaxed">
            Removing <strong className="text-spotify-secondary">{playlist.name}</strong> will also remove its associated track metadata records from your vault. Your uploaded audio files will remain safe in your library.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-spotify-border/40">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
