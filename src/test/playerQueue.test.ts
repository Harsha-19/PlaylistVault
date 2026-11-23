import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { PlayerProvider, usePlayer } from '../context/PlayerContext';
import { PlayableTrackItem } from '../types';

describe('PlayerContext & Queue Engine (Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(PlayerProvider, null, children);

  const mockItem1: PlayableTrackItem = {
    id: 't-1',
    title: 'Track One',
    artist: 'Artist A',
    album: 'Album X',
    audioUrl: 'https://example.com/audio1.mp3',
    durationMs: 180000,
    audioFileId: 'f-1',
    codec: 'mp3',
  };

  const mockItem2: PlayableTrackItem = {
    id: 't-2',
    title: 'Track Two',
    artist: 'Artist B',
    album: 'Album Y',
    audioUrl: 'https://example.com/audio2.mp3',
    durationMs: 200000,
    audioFileId: 'f-2',
    codec: 'mp3',
  };

  const mockItem3: PlayableTrackItem = {
    id: 't-3',
    title: 'Track Three',
    artist: 'Artist C',
    album: 'Album Z',
    audioUrl: 'https://example.com/audio3.mp3',
    durationMs: 240000,
    audioFileId: 'f-3',
    codec: 'flac',
  };

  it('initializes with default playback state', () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.volume).toBe(0.8);
    expect(result.current.state.isMuted).toBe(false);
    expect(result.current.state.repeatMode).toBe('off');
    expect(result.current.state.shuffle).toBe(false);
    expect(result.current.state.queue).toEqual([]);
    expect(result.current.state.queueIndex).toBe(-1);
  });

  it('plays a single track and updates state and single-item queue', async () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    await act(async () => {
      result.current.playTrack({
        title: 'Single Song',
        artist: 'Solo Artist',
        album: 'Solo Album',
        audioUrl: 'https://example.com/single.mp3',
        audioFileId: 'file-single',
        durationMs: 120000,
      });
    });

    expect(result.current.state.title).toBe('Single Song');
    expect(result.current.state.artist).toBe('Solo Artist');
    expect(result.current.state.isPlaying).toBe(true);
    expect(result.current.state.queue).toHaveLength(1);
    expect(result.current.state.queueIndex).toBe(0);
    expect(result.current.state.queue[0].title).toBe('Single Song');
  });

  it('plays a multi-track queue and sets current index', async () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    await act(async () => {
      result.current.playQueue([mockItem1, mockItem2, mockItem3], 1);
    });

    expect(result.current.state.queue).toHaveLength(3);
    expect(result.current.state.queueIndex).toBe(1);
    expect(result.current.state.title).toBe('Track Two');
    expect(result.current.state.artist).toBe('Artist B');
    expect(result.current.state.isPlaying).toBe(true);
  });

  it('adds and removes tracks from queue with proper index adjusting', async () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    await act(async () => {
      result.current.playQueue([mockItem1, mockItem2], 1);
    });
    expect(result.current.state.queueIndex).toBe(1);

    // Add mockItem3 to end
    act(() => {
      result.current.addToQueue(mockItem3);
    });
    expect(result.current.state.queue).toHaveLength(3);
    expect(result.current.state.queue[2].title).toBe('Track Three');
    expect(result.current.state.queueIndex).toBe(1);

    // Remove index 0 (which is before current index 1)
    act(() => {
      result.current.removeFromQueue(0);
    });
    expect(result.current.state.queue).toHaveLength(2);
    // Queue index should adjust down from 1 to 0
    expect(result.current.state.queueIndex).toBe(0);
    expect(result.current.state.queue[0].title).toBe('Track Two');
  });

  it('clears queue preserving currently playing track', async () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    await act(async () => {
      result.current.playQueue([mockItem1, mockItem2, mockItem3], 1);
    });

    act(() => {
      result.current.clearQueue();
    });

    expect(result.current.state.queue).toHaveLength(1);
    expect(result.current.state.queue[0].title).toBe('Track Two');
    expect(result.current.state.queueIndex).toBe(0);
  });

  it('advances to next track and handles end-of-queue in repeat "off" mode', async () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    await act(async () => {
      result.current.playQueue([mockItem1, mockItem2], 0);
    });
    expect(result.current.state.queueIndex).toBe(0);

    // Next track moves to index 1
    await act(async () => {
      result.current.nextTrack();
    });
    expect(result.current.state.queueIndex).toBe(1);
    expect(result.current.state.title).toBe('Track Two');

    // Next track at end of queue with repeat 'off' stops playback
    await act(async () => {
      result.current.nextTrack();
    });
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('wraps around to start in repeat "all" mode when advancing at end of queue', async () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    await act(async () => {
      result.current.playQueue([mockItem1, mockItem2], 1);
    });

    // Set repeat mode to 'all'
    act(() => {
      result.current.toggleRepeat(); // off -> all
    });
    expect(result.current.state.repeatMode).toBe('all');

    // Next track from index 1 should wrap to index 0
    await act(async () => {
      result.current.nextTrack();
    });
    expect(result.current.state.queueIndex).toBe(0);
    expect(result.current.state.title).toBe('Track One');
  });

  it('cycles repeat mode correctly (off -> all -> one -> off)', () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    expect(result.current.state.repeatMode).toBe('off');

    act(() => {
      result.current.toggleRepeat();
    });
    expect(result.current.state.repeatMode).toBe('all');

    act(() => {
      result.current.toggleRepeat();
    });
    expect(result.current.state.repeatMode).toBe('one');

    act(() => {
      result.current.toggleRepeat();
    });
    expect(result.current.state.repeatMode).toBe('off');
  });

  it('toggles shuffle mode', () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    expect(result.current.state.shuffle).toBe(false);
    act(() => {
      result.current.toggleShuffle();
    });
    expect(result.current.state.shuffle).toBe(true);
    act(() => {
      result.current.toggleShuffle();
    });
    expect(result.current.state.shuffle).toBe(false);
  });

  it('manages volume and mute memory', () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    // Set custom volume
    act(() => {
      result.current.setVolume(0.4);
    });
    expect(result.current.state.volume).toBe(0.4);
    expect(result.current.state.isMuted).toBe(false);

    // Toggle mute -> volume remains stored in ref, isMuted becomes true
    act(() => {
      result.current.toggleMute();
    });
    expect(result.current.state.isMuted).toBe(true);

    // Unmute -> restores 0.4
    act(() => {
      result.current.toggleMute();
    });
    expect(result.current.state.isMuted).toBe(false);
    expect(result.current.state.volume).toBe(0.4);
  });

  it('creates and revokes Blob object URLs properly during playback switches', async () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    const blobA = new Blob(['audio-data-a'], { type: 'audio/mpeg' });
    const blobB = new Blob(['audio-data-b'], { type: 'audio/mpeg' });

    await act(async () => {
      result.current.playTrack({
        title: 'Blob Track A',
        artist: 'Artist A',
        blob: blobA,
      });
    });

    expect(URL.createObjectURL).toHaveBeenCalledWith(blobA);

    await act(async () => {
      result.current.playTrack({
        title: 'Blob Track B',
        artist: 'Artist B',
        blob: blobB,
      });
    });

    expect(URL.createObjectURL).toHaveBeenCalledWith(blobB);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
