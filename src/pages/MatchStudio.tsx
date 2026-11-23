import { useState, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RotateCcw,
  Search,
  Check,
  X,
  Play,
  Music2,
  ChevronDown,
  ChevronUp,
  Layers,
  FileAudio,
  CheckCheck,
  Info,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useMatch } from '../context/MatchContext';
import { useAudio } from '../context/AudioContext';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../lib/utils';
import { Track } from '../types';
import { StoredAudioFile } from '../lib/audio/types';
import { MatchingEngine } from '../lib/matching/engine';
import { Link } from 'react-router-dom';

export function MatchStudio() {
  const {
    availablePlaylists,
    selectedPlaylistId,
    setSelectedPlaylistId,
    matchItems,
    stats,
    isMatching,
    runAutoMatch,
    manualPair,
    confirmMatch,
    unmatch,
    bulkConfirmHighConfidence,
    resetMatches,
  } = useMatch();

  const { audioFiles } = useAudio();
  const { playTrack, state: playerState } = usePlayer();

  // Filters & Search
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'pending' | 'unmatched'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Expanded Breakdowns
  const [candidateModalTrack, setCandidateModalTrack] = useState<Track | null>(null);
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');
  const [expandedScoreTrackId, setExpandedScoreTrackId] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Filtered match items
  const filteredItems = useMemo(() => {
    return matchItems.filter((item) => {
      // Status filter
      if (filter === 'confirmed') {
        if (!item.match || item.match.status !== 'confirmed') return false;
      } else if (filter === 'pending') {
        if (!item.match || item.match.status !== 'pending') return false;
      } else if (filter === 'unmatched') {
        if (item.match && item.match.status !== 'rejected') return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.track.title.toLowerCase().includes(q);
        const matchesArtist = item.track.artist.toLowerCase().includes(q);
        const matchesAudio = item.audioFile?.title.toLowerCase().includes(q) || item.audioFile?.filename.toLowerCase().includes(q);
        if (!matchesTitle && !matchesArtist && !matchesAudio) return false;
      }

      return true;
    });
  }, [matchItems, filter, searchQuery]);

  // Ranked candidates for manual candidate picker modal
  const modalCandidates = useMemo(() => {
    if (!candidateModalTrack || audioFiles.length === 0) return [];

    let pool = audioFiles;
    if (candidateSearchQuery.trim()) {
      const q = candidateSearchQuery.toLowerCase();
      pool = pool.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.artist.toLowerCase().includes(q) ||
          f.album.toLowerCase().includes(q) ||
          f.filename.toLowerCase().includes(q)
      );
    }

    return MatchingEngine.rankAllCandidates(candidateModalTrack, pool);
  }, [candidateModalTrack, audioFiles, candidateSearchQuery]);

  // Audio Playback handler
  const handlePlayAudio = (file: StoredAudioFile) => {
    try {
      const audioUrl = URL.createObjectURL(file.blob);
      playTrack({
        audioUrl,
        title: file.title,
        artist: file.artist,
        albumArt: file.artwork_data_url || undefined,
        audioFileId: file.id,
      });
    } catch (err) {
      console.error('[PlaylistVault] Failed to create audio URL:', err);
    }
  };

  const handleSelectCandidate = async (audioFileId: string) => {
    if (!candidateModalTrack) return;
    await manualPair(candidateModalTrack.id, audioFileId);
    setCandidateModalTrack(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Playlist Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-spotify-secondary">Match Studio</h1>
          <p className="text-xs text-spotify-on-surface mt-1">
            Intelligent title, artist, and duration pairing between imported Spotify tracks and your local audio library.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Playlist Dropdown */}
          {availablePlaylists.length > 0 && (
            <select
              value={selectedPlaylistId || ''}
              onChange={(e) => setSelectedPlaylistId(e.target.value || null)}
              className="bg-spotify-surface border border-spotify-surface-border text-spotify-secondary rounded px-3 py-1.5 text-xs focus:outline-none focus:border-spotify-accent"
            >
              {availablePlaylists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} ({pl.total_tracks} tracks)
                </option>
              ))}
            </select>
          )}

          {stats.pendingCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={bulkConfirmHighConfidence}
              className="gap-1.5 text-xs text-spotify-secondary"
              title="Confirm all matches with score >= 80%"
            >
              <CheckCheck className="w-3.5 h-3.5 text-spotify-accent" />
              Confirm All (&gt;80%)
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsResetModalOpen(true)}
            className="gap-1.5 text-xs text-spotify-on-surface hover:text-spotify-error"
            title="Clear all matches for this playlist"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={runAutoMatch}
            disabled={isMatching || !selectedPlaylistId || audioFiles.length === 0}
            className="gap-2 bg-spotify-accent text-spotify-base hover:brightness-105"
          >
            <Sparkles className={`w-4 h-4 ${isMatching ? 'animate-spin' : ''}`} />
            {isMatching ? 'Matching...' : 'Run Auto-Match'}
          </Button>
        </div>
      </div>

      {/* Match Quality Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border border-spotify-accent/30 bg-spotify-surface">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-spotify-accent/15 text-spotify-accent flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-spotify-secondary">{stats.confirmedCount}</div>
              <p className="text-[11px] text-spotify-on-surface">Confirmed Matches</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border border-yellow-500/30 bg-spotify-surface">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-yellow-500/15 text-yellow-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-spotify-secondary">{stats.pendingCount}</div>
              <p className="text-[11px] text-spotify-on-surface">Pending Review</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border border-spotify-surface-border bg-spotify-surface">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-spotify-surface-border text-spotify-on-surface flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-spotify-secondary">{stats.unmatchedCount}</div>
              <p className="text-[11px] text-spotify-on-surface">Unmatched Tracks</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border border-spotify-surface-border bg-spotify-surface">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-spotify-surface-border text-spotify-secondary flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-spotify-secondary">{stats.matchPercentage}%</div>
              <p className="text-[11px] text-spotify-on-surface">Match Coverage</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Duplicate Assignment Warning Banner */}
      {stats.duplicateAssignmentsCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs text-yellow-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-yellow-400" />
          <p>
            Notice: Some audio files are matched to more than one track in this playlist. Check the flagged duplicate
            indicators below before exporting.
          </p>
        </div>
      )}

      {/* Empty States (No playlist imported or no audio uploaded) */}
      {availablePlaylists.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-spotify-surface-border bg-spotify-surface/40 space-y-3">
          <Music2 className="h-10 w-10 text-spotify-on-surface mx-auto opacity-50" />
          <h3 className="text-base font-semibold text-spotify-secondary">No Spotify Playlists Available</h3>
          <p className="text-xs text-spotify-on-surface max-w-sm mx-auto">
            Import a Spotify playlist first so Match Studio can pair its track metadata against your local audio files.
          </p>
          <div className="pt-2">
            <Link to="/playlists">
              <Button variant="primary" size="sm" className="bg-spotify-accent text-spotify-base">
                Go to Playlists
              </Button>
            </Link>
          </div>
        </Card>
      ) : audioFiles.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-spotify-surface-border bg-spotify-surface/40 space-y-3">
          <FileAudio className="h-10 w-10 text-spotify-on-surface mx-auto opacity-50" />
          <h3 className="text-base font-semibold text-spotify-secondary">No Local Audio Files Ingested</h3>
          <p className="text-xs text-spotify-on-surface max-w-sm mx-auto">
            Your authorized audio library is empty. Upload your authorized audio files in the Audio Library to start matching.
          </p>
          <div className="pt-2">
            <Link to="/audio">
              <Button variant="primary" size="sm" className="bg-spotify-accent text-spotify-base">
                Go to Audio Library
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Controls: Filter Tabs & Search Input */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-spotify-surface-border pb-3">
            {/* Tabs */}
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'all', label: `All (${matchItems.length})` },
                  { id: 'confirmed', label: `Confirmed (${stats.confirmedCount})` },
                  { id: 'pending', label: `Pending (${stats.pendingCount})` },
                  { id: 'unmatched', label: `Unmatched (${stats.unmatchedCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id as any)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    filter === tab.id
                      ? 'bg-spotify-secondary text-spotify-base'
                      : 'bg-spotify-surface text-spotify-on-surface hover:text-spotify-secondary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* In-Studio Search */}
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-spotify-on-surface" />
              <input
                type="text"
                placeholder="Filter tracks or matches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-spotify-surface border border-spotify-surface-border rounded-full pl-8 pr-3 py-1.5 text-xs text-spotify-secondary placeholder-spotify-on-surface focus:outline-none focus:border-spotify-accent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-spotify-on-surface hover:text-spotify-secondary"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Matches List */}
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-spotify-on-surface border border-dashed border-spotify-surface-border rounded-lg">
              <p className="text-xs">No tracks match your current filter criteria.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const track = item.track;
                const audio = item.audioFile;
                const match = item.match;
                const score = item.score;
                const isPlayingThisAudio =
                  audio && playerState.currentAudioFileId === audio.id && playerState.isPlaying;
                const isExpanded = expandedScoreTrackId === track.id;

                return (
                  <Card
                    key={track.id}
                    className={`p-4 border transition-colors ${
                      item.isDuplicateAssignment
                        ? 'border-yellow-500/40 bg-spotify-surface/90'
                        : match?.status === 'confirmed'
                        ? 'border-spotify-surface-border bg-spotify-surface/80'
                        : match?.status === 'pending'
                        ? 'border-yellow-500/20 bg-spotify-surface/80'
                        : 'border-spotify-surface-border/50 bg-spotify-surface/40'
                    }`}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                      {/* Left: Spotify Track (5 cols) */}
                      <div className="lg:col-span-5 flex items-center gap-3 min-w-0">
                        {track.cover_art_url ? (
                          <img
                            src={track.cover_art_url}
                            alt={track.title}
                            className="h-11 w-11 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded bg-spotify-surface-border flex items-center justify-center text-spotify-on-surface flex-shrink-0">
                            <Music2 className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-spotify-secondary truncate">{track.title}</p>
                          <p className="text-[11px] text-spotify-on-surface truncate">{track.artist}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-spotify-on-surface/80">
                            <span>{track.album || 'Unknown Album'}</span>
                            <span>•</span>
                            <span>{formatDuration(track.duration_ms)}</span>
                            {track.explicit && <Badge variant="neutral">Explicit</Badge>}
                          </div>
                        </div>
                      </div>

                      {/* Center: Match Confidence & Quality Status (3 cols) */}
                      <div className="lg:col-span-3 flex flex-col items-center justify-center text-center px-2">
                        {match && score ? (
                          <div className="w-full space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span
                                className={`font-bold ${
                                  score.confidenceScore >= 80
                                    ? 'text-spotify-accent'
                                    : score.confidenceScore >= 50
                                    ? 'text-yellow-400'
                                    : 'text-spotify-error'
                                }`}
                              >
                                {score.confidenceScore}% Match
                              </span>
                              <Badge
                                variant={
                                  match.status === 'confirmed'
                                    ? 'success'
                                    : match.status === 'pending'
                                    ? 'warning'
                                    : 'error'
                                }
                              >
                                {match.status === 'confirmed'
                                  ? 'Confirmed'
                                  : match.status === 'pending'
                                  ? 'Pending Review'
                                  : 'Rejected'}
                              </Badge>
                            </div>

                            {/* Progress Meter */}
                            <div className="w-full bg-spotify-surface-border rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  score.confidenceScore >= 80
                                    ? 'bg-spotify-accent'
                                    : score.confidenceScore >= 50
                                    ? 'bg-yellow-400'
                                    : 'bg-spotify-error'
                                }`}
                                style={{ width: `${score.confidenceScore}%` }}
                              />
                            </div>

                            {/* Score Breakdown Toggle */}
                            <button
                              onClick={() => setExpandedScoreTrackId(isExpanded ? null : track.id)}
                              className="text-[10px] text-spotify-on-surface hover:text-spotify-secondary flex items-center justify-center gap-1 mx-auto"
                            >
                              <span>Why this score?</span>
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>

                            {/* Duplicate Assignment Badge */}
                            {item.isDuplicateAssignment && (
                              <div className="inline-flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Reused in {item.duplicateTrackTitles?.length} tracks</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant="neutral">Unmatched</Badge>
                            <p className="text-[10px] text-spotify-on-surface">No high-confidence candidate</p>
                          </div>
                        )}
                      </div>

                      {/* Right: Matched Local Audio File & Actions (4 cols) */}
                      <div className="lg:col-span-4 flex items-center justify-between gap-3 min-w-0">
                        {audio ? (
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              onClick={() => handlePlayAudio(audio)}
                              className="h-8 w-8 rounded-full bg-spotify-surface-border hover:bg-spotify-accent text-spotify-on-surface hover:text-spotify-base flex items-center justify-center flex-shrink-0 transition-colors"
                              title="Preview Local Audio"
                            >
                              <Play
                                className={`h-3.5 w-3.5 ml-0.5 ${
                                  isPlayingThisAudio ? 'text-spotify-accent fill-spotify-accent' : ''
                                }`}
                              />
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-spotify-secondary truncate">{audio.title}</p>
                              <p className="text-[10px] text-spotify-on-surface truncate">{audio.filename}</p>
                              <div className="flex items-center gap-1.5 text-[10px] text-spotify-on-surface">
                                <Badge variant="neutral">{audio.codec}</Badge>
                                <span>{formatDuration(audio.duration_ms)}</span>
                                {score && (
                                  <span
                                    className={`font-mono ${
                                      Math.abs(score.durationDeltaSeconds) <= 2
                                        ? 'text-spotify-accent'
                                        : 'text-yellow-400'
                                    }`}
                                  >
                                    ({score.durationDeltaSeconds > 0 ? '+' : ''}
                                    {score.durationDeltaSeconds}s)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 text-left">
                            <p className="text-xs text-spotify-on-surface italic">No local file assigned</p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {match && match.status !== 'confirmed' && (
                            <button
                              onClick={() => confirmMatch(track.id)}
                              className="p-1.5 rounded bg-spotify-accent/15 hover:bg-spotify-accent text-spotify-accent hover:text-spotify-base transition-colors"
                              title="Confirm Match"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setCandidateModalTrack(track);
                              setCandidateSearchQuery('');
                            }}
                            className="text-xs px-2.5 py-1"
                          >
                            {audio ? 'Change' : 'Select Match'}
                          </Button>
                          {match && (
                            <button
                              onClick={() => unmatch(track.id)}
                              className="p-1.5 rounded hover:bg-spotify-surface-border text-spotify-on-surface hover:text-spotify-error transition-colors"
                              title="Unmatch Track"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Score Breakdown Box */}
                    {isExpanded && score && (
                      <div className="mt-3 pt-3 border-t border-spotify-surface-border/50 text-xs space-y-1.5 bg-spotify-base/40 p-3 rounded">
                        <p className="font-semibold text-spotify-secondary flex items-center gap-1.5">
                          <Info className="h-3.5 w-3.5 text-spotify-accent" />
                          Match Evidence Breakdown:
                        </p>
                        <ul className="space-y-1 text-spotify-on-surface">
                          {score.breakdown.map((item, idx) => (
                            <li key={idx} className="flex items-center justify-between text-[11px]">
                              <span>• {item.description}</span>
                              <span
                                className={`font-mono font-semibold ${
                                  item.points > 0 ? 'text-spotify-accent' : 'text-spotify-error'
                                }`}
                              >
                                {item.points > 0 ? `+${item.points}` : item.points}%
                              </span>
                            </li>
                          ))}
                        </ul>
                        {score.isVersionMismatch && (
                          <div className="mt-1 p-1.5 bg-spotify-error/10 border border-spotify-error/30 rounded text-[11px] text-spotify-error">
                            ⚠️ Warning: Version type variance detected ({score.notes || 'Incompatible version'}).
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Manual Candidate Selector Modal */}
      {candidateModalTrack && (
        <Modal
          isOpen={true}
          onClose={() => setCandidateModalTrack(null)}
          title="Manual Candidate Assignment"
          className="max-w-2xl"
        >
          <div className="space-y-4">
            {/* Target Spotify Track Info */}
            <div className="p-3 bg-spotify-surface-border/30 rounded border border-spotify-surface-border flex items-center gap-3">
              {candidateModalTrack.cover_art_url ? (
                <img
                  src={candidateModalTrack.cover_art_url}
                  alt={candidateModalTrack.title}
                  className="h-10 w-10 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded bg-spotify-surface flex items-center justify-center text-spotify-on-surface">
                  <Music2 className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-spotify-secondary truncate">{candidateModalTrack.title}</p>
                <p className="text-[11px] text-spotify-on-surface truncate">
                  {candidateModalTrack.artist} • {candidateModalTrack.album} • {formatDuration(candidateModalTrack.duration_ms)}
                </p>
              </div>
            </div>

            {/* Candidate Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-spotify-on-surface" />
              <input
                type="text"
                placeholder="Search local library by title, artist, album, filename..."
                value={candidateSearchQuery}
                onChange={(e) => setCandidateSearchQuery(e.target.value)}
                className="w-full bg-spotify-surface border border-spotify-surface-border rounded-full pl-9 pr-4 py-2 text-xs text-spotify-secondary placeholder-spotify-on-surface focus:outline-none focus:border-spotify-accent"
              />
            </div>

            {/* Candidate List Ranked by Algorithm */}
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {modalCandidates.length === 0 ? (
                <p className="p-6 text-center text-xs text-spotify-on-surface">
                  No matching audio files found in your local library.
                </p>
              ) : (
                modalCandidates.map(({ audioFile, score }) => {
                  const isPlayingCandidate =
                    playerState.currentAudioFileId === audioFile.id && playerState.isPlaying;

                  return (
                    <div
                      key={audioFile.id}
                      className="p-3 rounded border border-spotify-surface-border hover:border-spotify-accent/50 bg-spotify-surface/60 hover:bg-spotify-surface transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          onClick={() => handlePlayAudio(audioFile)}
                          className="h-8 w-8 rounded-full bg-spotify-surface-border hover:bg-spotify-accent text-spotify-on-surface hover:text-spotify-base flex items-center justify-center flex-shrink-0 transition-colors"
                          title="Audition Candidate"
                        >
                          <Play
                            className={`h-3.5 w-3.5 ml-0.5 ${
                              isPlayingCandidate ? 'text-spotify-accent fill-spotify-accent' : ''
                            }`}
                          />
                        </button>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-spotify-secondary truncate">{audioFile.title}</p>
                          <p className="text-[11px] text-spotify-on-surface truncate">
                            {audioFile.artist} • {audioFile.album} ({formatDuration(audioFile.duration_ms)})
                          </p>
                          <p className="text-[10px] text-spotify-on-surface/70 truncate">{audioFile.filename}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span
                          className={`text-xs font-bold font-mono ${
                            score.confidenceScore >= 80
                              ? 'text-spotify-accent'
                              : score.confidenceScore >= 50
                              ? 'text-yellow-400'
                              : 'text-spotify-on-surface'
                          }`}
                        >
                          {score.confidenceScore}%
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleSelectCandidate(audioFile.id)}
                          className="bg-spotify-accent text-spotify-base hover:brightness-105 text-xs py-1 px-3"
                        >
                          Assign
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-spotify-surface-border">
              <Button variant="secondary" onClick={() => setCandidateModalTrack(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsResetModalOpen(false)}
          title="Reset Match State"
          className="max-w-sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-spotify-on-surface">
              Are you sure you want to clear all matches for this playlist? This will remove both confirmed and pending
              matches. Your local audio files will remain safe in your library.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setIsResetModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await resetMatches();
                  setIsResetModalOpen(false);
                }}
                className="bg-spotify-error text-white"
              >
                Reset Matches
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
