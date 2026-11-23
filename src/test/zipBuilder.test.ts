import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildZipArchive, ZipExportCancelledError } from '../lib/export/zipBuilder';
import { ExportOptionsConfig, ExportProgress, ExportTrackItem } from '../lib/export/types';
import { StoredAudioFile } from '../lib/audio/types';

describe('Real ZIP Generation Engine (Phase 6)', () => {
  const binaryPayload1 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0xff, 0xfb, 0x90, 0x64]);
  const binaryPayload2 = new Uint8Array([0x66, 0x4c, 0x61, 0x43, 0x00, 0x00, 0x00, 0x22, 0x10, 0x00, 0x10, 0x00, 0x00, 0x00]);

  const audioBlob1 = new Blob([binaryPayload1], { type: 'audio/mpeg' });
  const audioBlob2 = new Blob([binaryPayload2], { type: 'audio/flac' });

  const dummyAudio1: StoredAudioFile = {
    id: 'f-1',
    user_id: 'u-1',
    filename: 'song1.mp3',
    original_name: 'song1.mp3',
    file_size_bytes: binaryPayload1.byteLength,
    mime_type: 'audio/mpeg',
    file_hash: 'hash-song-1',
    duration_ms: 180000,
    title: 'Electronic Dreams',
    artist: 'Kraftwerk',
    album: 'Computer World',
    genre: 'Electronic',
    genres: ['Electronic'],
    track_number: 1,
    disc_number: 1,
    year: '1981',
    bitrate_kbps: 320,
    sample_rate_hz: 44100,
    channels: 2,
    codec: 'MP3',
    artwork_data_url: null,
    blob: audioBlob1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const dummyAudio2: StoredAudioFile = {
    ...dummyAudio1,
    id: 'f-2',
    filename: 'song2.flac',
    file_size_bytes: binaryPayload2.byteLength,
    file_hash: 'hash-song-2',
    title: 'Pocket Calculator',
    codec: 'FLAC',
    blob: audioBlob2,
  };

  const config: ExportOptionsConfig = {
    sourceType: 'spotify_playlist',
    sourceId: 'pl-synth',
    sourceName: 'Synth Masters',
    folderStructure: 'playlist_track',
    filenamePattern: 'track_artist_title',
    includeAudioFiles: true,
    includeCsv: true,
    includeJson: true,
    includePlaylistJson: true,
    includeReadme: true,
  };

  const exportTracks: ExportTrackItem[] = [
    {
      trackId: 'tr-1',
      title: 'Electronic Dreams',
      artist: 'Kraftwerk',
      album: 'Computer World',
      genre: 'Electronic',
      year: '1981',
      trackNumber: 1,
      discNumber: 1,
      durationMs: 180000,
      spotifyTrackId: 'sp-1',
      audioFileId: 'f-1',
      audioFile: dummyAudio1,
      matchConfidence: 96,
      matchStatus: 'confirmed',
      status: 'ready',
      issues: [],
      originalFilename: 'song1.mp3',
      exportedFilename: '01 - Kraftwerk - Electronic Dreams.mp3',
      exportedPath: 'Synth Masters/01 - Kraftwerk - Electronic Dreams.mp3',
      fileSizeBytes: binaryPayload1.byteLength,
      codec: 'MP3',
      fileHash: 'hash-song-1',
    },
    {
      trackId: 'tr-2',
      title: 'Pocket Calculator',
      artist: 'Kraftwerk',
      album: 'Computer World',
      genre: 'Electronic',
      year: '1981',
      trackNumber: 2,
      discNumber: 1,
      durationMs: 210000,
      spotifyTrackId: 'sp-2',
      audioFileId: 'f-2',
      audioFile: dummyAudio2,
      matchConfidence: 94,
      matchStatus: 'confirmed',
      status: 'ready',
      issues: [],
      originalFilename: 'song2.flac',
      exportedFilename: '02 - Kraftwerk - Pocket Calculator.flac',
      exportedPath: 'Synth Masters/02 - Kraftwerk - Pocket Calculator.flac',
      fileSizeBytes: binaryPayload2.byteLength,
      codec: 'FLAC',
      fileHash: 'hash-song-2',
    },
  ];

  it('generates a real ZIP archive with bit-exact audio binaries and structured manifests', async () => {
    const progressUpdates: ExportProgress[] = [];

    const result = await buildZipArchive({
      tracks: exportTracks,
      config,
      onProgress: (p) => progressUpdates.push(p),
    });

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.filename).toBe('Synth Masters.zip');
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1].percent).toBe(100);

    // CRITICAL: Unpack the generated ZIP using JSZip to verify real file structure
    const unzipped = await JSZip.loadAsync(result.blob);

    // 1. Verify Audio Files Exist inside the archive
    const audioEntry1 = unzipped.file('Synth Masters/01 - Kraftwerk - Electronic Dreams.mp3');
    expect(audioEntry1).not.toBeNull();

    const audioEntry2 = unzipped.file('Synth Masters/02 - Kraftwerk - Pocket Calculator.flac');
    expect(audioEntry2).not.toBeNull();

    // 2. CRITICAL: Verify bit-for-bit audio byte integrity (No recompression / byte loss)
    const extractedBytes1 = await audioEntry1!.async('uint8array');
    expect(extractedBytes1).toEqual(binaryPayload1);

    const extractedBytes2 = await audioEntry2!.async('uint8array');
    expect(extractedBytes2).toEqual(binaryPayload2);

    // 3. Verify metadata.json
    const metaJsonEntry = unzipped.file('metadata.json');
    expect(metaJsonEntry).not.toBeNull();
    const metaJsonStr = await metaJsonEntry!.async('string');
    const parsedMeta = JSON.parse(metaJsonStr);
    expect(parsedMeta.archive_name).toBe('Synth Masters');
    expect(parsedMeta.total_tracks).toBe(2);
    expect(parsedMeta.tracks[0].title).toBe('Electronic Dreams');
    expect(parsedMeta.tracks[1].title).toBe('Pocket Calculator');

    // 4. Verify metadata.csv
    const metaCsvEntry = unzipped.file('metadata.csv');
    expect(metaCsvEntry).not.toBeNull();
    const metaCsvStr = await metaCsvEntry!.async('string');
    expect(metaCsvStr.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM
    expect(metaCsvStr).toContain('Kraftwerk');
    expect(metaCsvStr).toContain('Pocket Calculator');

    // 5. Verify playlist.json
    const playlistJsonEntry = unzipped.file('playlist.json');
    expect(playlistJsonEntry).not.toBeNull();
    const playlistJsonStr = await playlistJsonEntry!.async('string');
    const parsedPlaylist = JSON.parse(playlistJsonStr);
    expect(parsedPlaylist.name).toBe('Synth Masters');
    expect(parsedPlaylist.tracks).toHaveLength(2);

    // 6. Verify README.txt
    const readmeEntry = unzipped.file('README.txt');
    expect(readmeEntry).not.toBeNull();
    const readmeStr = await readmeEntry!.async('string');
    expect(readmeStr).toContain('OFFLINE STANDALONE USAGE GUARANTEE');
  });

  it('throws an error if no ready audio files are available and includeAudioFiles is true', async () => {
    const unreadyTracks: ExportTrackItem[] = [
      {
        ...exportTracks[0],
        status: 'unmatched',
        audioFile: undefined,
      },
    ];

    await expect(
      buildZipArchive({
        tracks: unreadyTracks,
        config,
      })
    ).rejects.toThrow('No ready audio files available to package in the ZIP archive.');
  });

  it('supports cancellation cleanly through AbortSignal without corrupting state', async () => {
    const abortController = new AbortController();
    abortController.abort(); // already aborted

    await expect(
      buildZipArchive({
        tracks: exportTracks,
        config,
        signal: abortController.signal,
      })
    ).rejects.toThrow(ZipExportCancelledError);
  });
});
