import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  VolumeX,
  Volume1,
  Music2,
  ListMusic,
  X,
  Trash2,
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { formatDuration } from '../../lib/utils';
import { Badge } from '../ui/Badge';

export function PlayerBar() {
  const {
    state,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    nextTrack,
    previousTrack,
    toggleRepeat,
    toggleShuffle,
    removeFromQueue,
    clearQueue,
    playQueue,
  } = usePlayer();

  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const hasAudio = Boolean(state.audioUrl);
  const queueLength = state.queue.length;

  return (
    <>
      <div className="h-20 bg-spotify-base border-t border-spotify-surface-border px-4 flex items-center justify-between z-40 select-none relative">
        {/* Left: Track Information */}
        <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
          <div className="w-12 h-12 rounded bg-spotify-surface border border-spotify-surface-border flex items-center justify-center overflow-hidden flex-shrink-0">
            {state.albumArt ? (
              <img
                src={state.albumArt}
                alt={state.title || 'Track Artwork'}
                className="w-full h-full object-cover"
              />
            ) : (
              <Music2 className="w-5 h-5 text-spotify-on-surface" />
            )}
          </div>
          <div className="truncate pr-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-spotify-secondary truncate">
                {state.title || 'No Audio Selected'}
              </p>
              {state.codec && <Badge variant="neutral">{state.codec}</Badge>}
            </div>
            <p className="text-[11px] text-spotify-on-surface truncate">
              {state.artist || 'Select an uploaded audio file or track'}
            </p>
          </div>
        </div>

        {/* Center: Playback Controls & Progress Bar */}
        <div className="flex flex-col items-center gap-1.5 w-2/4 max-w-xl">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Shuffle Button */}
            <button
              type="button"
              onClick={toggleShuffle}
              disabled={queueLength <= 1}
              className={`p-1.5 rounded-full transition-colors disabled:opacity-30 ${
                state.shuffle ? 'text-spotify-accent' : 'text-spotify-on-surface hover:text-spotify-secondary'
              }`}
              title={state.shuffle ? 'Shuffle Enabled' : 'Enable Shuffle'}
              aria-label="Toggle shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            {/* Previous Track Button */}
            <button
              type="button"
              onClick={previousTrack}
              disabled={!hasAudio}
              className="p-1.5 rounded-full text-spotify-on-surface hover:text-spotify-secondary transition-colors disabled:opacity-30"
              title="Previous Track"
              aria-label="Previous track"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            {/* Play / Pause Primary Button */}
            <button
              type="button"
              onClick={togglePlay}
              disabled={!hasAudio}
              className="w-8 h-8 rounded-full bg-spotify-secondary hover:bg-spotify-accent text-spotify-base flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              title={state.isPlaying ? 'Pause' : 'Play'}
              aria-label={state.isPlaying ? 'Pause' : 'Play'}
            >
              {state.isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            {/* Next Track Button */}
            <button
              type="button"
              onClick={nextTrack}
              disabled={!hasAudio}
              className="p-1.5 rounded-full text-spotify-on-surface hover:text-spotify-secondary transition-colors disabled:opacity-30"
              title="Next Track"
              aria-label="Next track"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            {/* Repeat Mode Button */}
            <button
              type="button"
              onClick={toggleRepeat}
              className={`p-1.5 rounded-full transition-colors ${
                state.repeatMode !== 'off'
                  ? 'text-spotify-accent'
                  : 'text-spotify-on-surface hover:text-spotify-secondary'
              }`}
              title={
                state.repeatMode === 'one'
                  ? 'Repeat One Track'
                  : state.repeatMode === 'all'
                  ? 'Repeat All Tracks'
                  : 'Enable Repeat'
              }
              aria-label="Toggle repeat"
            >
              {state.repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>

          {/* Progress Seek Bar */}
          <div className="flex items-center gap-2 w-full text-[10px] text-spotify-on-surface font-mono">
            <span>{formatDuration(state.currentTime * 1000)}</span>
            <div className="relative flex-1 flex items-center group">
              <input
                type="range"
                min={0}
                max={state.duration || 100}
                step={0.1}
                value={state.currentTime}
                onChange={handleSeekChange}
                disabled={!hasAudio}
                className="w-full h-1 bg-spotify-surface-border rounded-lg appearance-none cursor-pointer accent-spotify-accent group-hover:h-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Seek track"
              />
            </div>
            <span>{formatDuration(state.duration * 1000)}</span>
          </div>
        </div>

        {/* Right: Volume & Queue Tools */}
        <div className="flex items-center justify-end gap-3 w-1/4 min-w-[200px]">
          {/* Queue Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsQueueOpen((prev) => !prev)}
            className={`relative p-1.5 rounded-full transition-colors ${
              isQueueOpen ? 'text-spotify-accent' : 'text-spotify-on-surface hover:text-spotify-secondary'
            }`}
            title="Toggle Playback Queue"
            aria-label="Toggle queue"
          >
            <ListMusic className="w-4 h-4" />
            {queueLength > 0 && (
              <span className="absolute -top-1 -right-1 px-1 bg-spotify-accent text-spotify-base font-bold text-[9px] rounded-full">
                {queueLength}
              </span>
            )}
          </button>

          {/* Mute Button */}
          <button
            type="button"
            onClick={toggleMute}
            disabled={!hasAudio}
            className="text-spotify-on-surface hover:text-spotify-secondary transition-colors p-1 rounded-full disabled:opacity-40"
            title={state.isMuted ? 'Unmute' : 'Mute'}
            aria-label={state.isMuted ? 'Unmute' : 'Mute'}
          >
            {state.isMuted || state.volume === 0 ? (
              <VolumeX className="w-4 h-4 text-spotify-error" />
            ) : state.volume < 0.5 ? (
              <Volume1 className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* Volume Slider */}
          <div className="w-20">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={state.isMuted ? 0 : state.volume}
              onChange={handleVolumeChange}
              className="w-full h-1 bg-spotify-surface-border rounded-lg appearance-none cursor-pointer accent-spotify-secondary hover:accent-spotify-accent transition-all"
              aria-label="Volume slider"
            />
          </div>
        </div>
      </div>

      {/* Slide-out Queue Panel / Drawer */}
      {isQueueOpen && (
        <div className="fixed bottom-20 right-4 w-80 max-h-96 bg-spotify-surface/95 border border-spotify-surface-border rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden backdrop-blur-md">
          {/* Queue Header */}
          <div className="p-3 border-b border-spotify-surface-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-spotify-accent" />
              <span className="text-xs font-bold text-spotify-secondary">
                Play Queue ({queueLength})
              </span>
            </div>
            <div className="flex items-center gap-1">
              {queueLength > 1 && (
                <button
                  onClick={clearQueue}
                  className="p-1 text-spotify-on-surface hover:text-spotify-error transition-colors"
                  title="Clear Queue"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsQueueOpen(false)}
                className="p-1 text-spotify-on-surface hover:text-spotify-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Queue Items List */}
          <div className="overflow-y-auto flex-1 divide-y divide-spotify-surface-border/40 p-1">
            {queueLength === 0 ? (
              <div className="p-6 text-center text-spotify-on-surface text-xs">
                Queue is empty. Play a track from your library to populate the queue.
              </div>
            ) : (
              state.queue.map((item, idx) => {
                const isCurrent = idx === state.queueIndex;

                return (
                  <div
                    key={`${item.id}-${idx}`}
                    className={`p-2 rounded flex items-center justify-between gap-2 text-xs transition-colors group ${
                      isCurrent ? 'bg-spotify-surface-border/50 text-spotify-accent' : 'hover:bg-spotify-surface-border/20 text-spotify-secondary'
                    }`}
                  >
                    <button
                      onClick={() => playQueue(state.queue, idx)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                    >
                      <div className="w-7 h-7 rounded bg-spotify-surface flex items-center justify-center flex-shrink-0 text-spotify-on-surface">
                        {item.albumArt ? (
                          <img src={item.albumArt} alt={item.title} className="w-full h-full object-cover rounded" />
                        ) : (
                          <Music2 className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold truncate ${isCurrent ? 'text-spotify-accent' : 'text-spotify-secondary'}`}>
                          {item.title}
                        </p>
                        <p className="text-[10px] text-spotify-on-surface truncate">
                          {item.artist}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] text-spotify-on-surface font-mono">
                        {formatDuration(item.durationMs)}
                      </span>
                      {queueLength > 1 && (
                        <button
                          onClick={() => removeFromQueue(idx)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-spotify-on-surface hover:text-spotify-error transition-all"
                          title="Remove from queue"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}
