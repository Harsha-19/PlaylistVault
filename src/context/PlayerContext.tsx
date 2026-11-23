/**
 * Phase 5 — Advanced Audio Player Context
 * 
 * Manages persistent HTML5 Audio playback, queue operations, previous/next track,
 * repeat (off/all/one), shuffle, volume memory, error recovery, and Blob URL lifecycle cleanup.
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AudioPlaybackState, PlayableTrackItem, RepeatMode } from '../types';

interface PlayerContextType {
  state: AudioPlaybackState;
  playTrack: (options: {
    audioUrl?: string;
    blob?: Blob;
    title: string;
    artist: string;
    album?: string;
    albumArt?: string;
    codec?: string;
    trackId?: string;
    audioFileId?: string;
    durationMs?: number;
  }) => void;
  playQueue: (items: PlayableTrackItem[], startIndex?: number) => void;
  addToQueue: (item: PlayableTrackItem) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const createdBlobUrlsRef = useRef<Set<string>>(new Set());
  const previousVolumeRef = useRef<number>(0.8);

  const [state, setState] = useState<AudioPlaybackState>({
    currentTrackId: null,
    currentAudioFileId: null,
    title: '',
    artist: '',
    album: undefined,
    albumArt: undefined,
    codec: undefined,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isMuted: false,
    audioUrl: null,
    repeatMode: 'off',
    shuffle: false,
    queue: [],
    queueIndex: -1,
  });

  // State refs to access up-to-date values inside audio event listeners
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Clean up object URLs
  const revokeBlobUrl = useCallback((url: string | null) => {
    if (url && url.startsWith('blob:') && createdBlobUrlsRef.current.has(url)) {
      try {
        URL.revokeObjectURL(url);
        createdBlobUrlsRef.current.delete(url);
      } catch (err) {
        console.warn('[PlaylistVault] Failed to revoke blob URL:', err);
      }
    }
  }, []);

  // Internal helper to load and play an audio source
  const loadAndPlay = useCallback(
    (options: {
      audioUrl?: string;
      blob?: Blob;
      title: string;
      artist: string;
      album?: string;
      albumArt?: string;
      codec?: string;
      trackId?: string;
      audioFileId?: string;
      durationMs?: number;
      queueIndex?: number;
    }) => {
      if (!audioRef.current) return;

      let finalUrl = options.audioUrl || null;

      // If a raw Blob is provided, generate an object URL and register it for cleanup
      if (options.blob) {
        try {
          const generated = URL.createObjectURL(options.blob);
          createdBlobUrlsRef.current.add(generated);
          finalUrl = generated;
        } catch (err) {
          console.error('[PlaylistVault] Failed to create blob URL for playback:', err);
        }
      }

      if (!finalUrl) {
        console.warn('[PlaylistVault] No valid audio URL or blob provided for playback.');
        return;
      }

      // Revoke previous active blob URL if changing tracks
      if (activeBlobUrlRef.current && activeBlobUrlRef.current !== finalUrl) {
        revokeBlobUrl(activeBlobUrlRef.current);
      }
      activeBlobUrlRef.current = finalUrl;

      audioRef.current.src = finalUrl;
      audioRef.current.load();
      audioRef.current.volume = stateRef.current.isMuted ? 0 : stateRef.current.volume;
      audioRef.current.muted = stateRef.current.isMuted;

      audioRef.current
        .play()
        .then(() => {
          setState((prev) => ({
            ...prev,
            audioUrl: finalUrl,
            title: options.title,
            artist: options.artist,
            album: options.album,
            albumArt: options.albumArt,
            codec: options.codec,
            currentTrackId: options.trackId ?? null,
            currentAudioFileId: options.audioFileId ?? null,
            queueIndex: options.queueIndex !== undefined ? options.queueIndex : prev.queueIndex,
            isPlaying: true,
          }));
        })
        .catch((err) => {
          console.warn('[PlaylistVault] Playback error or browser user gesture required:', err);
          setState((prev) => ({ ...prev, isPlaying: false }));
        });
    },
    [revokeBlobUrl]
  );

  // Play next track in queue
  const nextTrack = useCallback(() => {
    const { queue, queueIndex, repeatMode, shuffle } = stateRef.current;
    if (queue.length === 0) return;

    let nextIndex = queueIndex + 1;

    if (shuffle) {
      // Pick random index other than current if queue > 1
      if (queue.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * queue.length);
        } while (nextIndex === queueIndex);
      } else {
        nextIndex = 0;
      }
    } else if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0; // Wrap around to first track
      } else {
        // End of queue in repeat 'off' mode
        setState((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
        return;
      }
    }

    const nextItem = queue[nextIndex];
    if (nextItem) {
      loadAndPlay({
        audioUrl: nextItem.audioUrl,
        blob: nextItem.blob,
        title: nextItem.title,
        artist: nextItem.artist,
        album: nextItem.album,
        albumArt: nextItem.albumArt,
        codec: nextItem.codec,
        trackId: nextItem.trackId,
        audioFileId: nextItem.audioFileId,
        durationMs: nextItem.durationMs,
        queueIndex: nextIndex,
      });
    }
  }, [loadAndPlay]);

  // Play previous track in queue
  const previousTrack = useCallback(() => {
    const { queue, queueIndex, currentTime } = stateRef.current;

    // If more than 3 seconds in, restart current track like Spotify
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
      setState((prev) => ({ ...prev, currentTime: 0 }));
      return;
    }

    if (queue.length === 0) return;

    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1; // Wrap around
    }

    const prevItem = queue[prevIndex];
    if (prevItem) {
      loadAndPlay({
        audioUrl: prevItem.audioUrl,
        blob: prevItem.blob,
        title: prevItem.title,
        artist: prevItem.artist,
        album: prevItem.album,
        albumArt: prevItem.albumArt,
        codec: prevItem.codec,
        trackId: prevItem.trackId,
        audioFileId: prevItem.audioFileId,
        durationMs: prevItem.durationMs,
        queueIndex: prevIndex,
      });
    }
  }, [loadAndPlay]);

  // Set up HTML5 Audio Element & Listeners
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setState((prev) => ({ ...prev, currentTime: audio.currentTime }));
    };

    const onDurationChange = () => {
      setState((prev) => ({ ...prev, duration: audio.duration || 0 }));
    };

    const onEnded = () => {
      const { repeatMode } = stateRef.current;
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        nextTrack();
      }
    };

    const onError = () => {
      console.warn('[PlaylistVault] Audio decoding/network error detected.');
      setState((prev) => ({ ...prev, isPlaying: false }));
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    const createdBlobUrls = createdBlobUrlsRef.current;

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);

      // Clean up all generated blob URLs on unmount
      createdBlobUrls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
      createdBlobUrls.clear();
      audioRef.current = null;
    };
  }, [nextTrack]);

  // Public: Play single track
  const playTrack = useCallback(
    (options: {
      audioUrl?: string;
      blob?: Blob;
      title: string;
      artist: string;
      album?: string;
      albumArt?: string;
      codec?: string;
      trackId?: string;
      audioFileId?: string;
      durationMs?: number;
    }) => {
      const newItem: PlayableTrackItem = {
        id: options.audioFileId || options.trackId || `track-${Date.now()}`,
        title: options.title,
        artist: options.artist,
        album: options.album,
        albumArt: options.albumArt,
        codec: options.codec,
        audioUrl: options.audioUrl,
        blob: options.blob,
        audioFileId: options.audioFileId,
        trackId: options.trackId,
        durationMs: options.durationMs || 0,
      };

      setState((prev) => ({
        ...prev,
        queue: [newItem],
        queueIndex: 0,
      }));

      loadAndPlay({ ...options, queueIndex: 0 });
    },
    [loadAndPlay]
  );

  // Public: Play entire queue starting at specific index
  const playQueue = useCallback(
    (items: PlayableTrackItem[], startIndex = 0) => {
      if (!items || items.length === 0) return;
      const validIndex = Math.max(0, Math.min(startIndex, items.length - 1));

      setState((prev) => ({
        ...prev,
        queue: items,
        queueIndex: validIndex,
      }));

      const target = items[validIndex];
      loadAndPlay({
        audioUrl: target.audioUrl,
        blob: target.blob,
        title: target.title,
        artist: target.artist,
        album: target.album,
        albumArt: target.albumArt,
        codec: target.codec,
        trackId: target.trackId,
        audioFileId: target.audioFileId,
        durationMs: target.durationMs,
        queueIndex: validIndex,
      });
    },
    [loadAndPlay]
  );

  const addToQueue = useCallback((item: PlayableTrackItem) => {
    setState((prev) => ({
      ...prev,
      queue: [...prev.queue, item],
    }));
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setState((prev) => {
      const updated = [...prev.queue];
      updated.splice(index, 1);
      let newIndex = prev.queueIndex;
      if (index < prev.queueIndex) {
        newIndex--;
      } else if (index === prev.queueIndex && newIndex >= updated.length) {
        newIndex = updated.length - 1;
      }
      return {
        ...prev,
        queue: updated,
        queueIndex: newIndex,
      };
    });
  }, []);

  const clearQueue = useCallback(() => {
    setState((prev) => ({
      ...prev,
      queue: prev.queueIndex >= 0 && prev.queue[prev.queueIndex] ? [prev.queue[prev.queueIndex]] : [],
      queueIndex: 0,
    }));
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && stateRef.current.audioUrl) {
      audioRef.current.play().then(() => {
        setState((prev) => ({ ...prev, isPlaying: true }));
      });
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (stateRef.current.isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [pause, resume]);

  const seek = useCallback((seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setState((prev) => ({ ...prev, currentTime: seconds }));
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    if (clamped > 0) {
      previousVolumeRef.current = clamped;
    }
    setState((prev) => ({ ...prev, volume: clamped, isMuted: clamped === 0 }));
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    const nextMuted = !stateRef.current.isMuted;
    audioRef.current.muted = nextMuted;

    if (nextMuted) {
      setState((prev) => ({ ...prev, isMuted: true }));
    } else {
      const restoreVol = previousVolumeRef.current || 0.8;
      audioRef.current.volume = restoreVol;
      setState((prev) => ({ ...prev, isMuted: false, volume: restoreVol }));
    }
  }, []);

  const toggleRepeat = useCallback(() => {
    setState((prev) => {
      let nextMode: RepeatMode = 'off';
      if (prev.repeatMode === 'off') nextMode = 'all';
      else if (prev.repeatMode === 'all') nextMode = 'one';
      else if (prev.repeatMode === 'one') nextMode = 'off';
      return { ...prev, repeatMode: nextMode };
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setState((prev) => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const value = {
    state,
    playTrack,
    playQueue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    nextTrack,
    previousTrack,
    pause,
    resume,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
