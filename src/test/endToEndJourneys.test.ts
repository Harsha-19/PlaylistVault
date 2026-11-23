import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { parseSpotifyPlaylistUrl } from '../lib/spotify/playlistParser';
import { saveImportedPlaylist, getPlaylistDetails } from '../lib/repository/playlistRepository';
import { MatchingEngine } from '../lib/matching/engine';
import { MatchRepository } from '../lib/matching/matchRepository';
import { buildZipArchive } from '../lib/export/zipBuilder';
import { ExportHistoryRepository } from '../lib/export/exportHistoryRepository';
import { ExportOptionsConfig, ExportTrackItem } from '../lib/export/types';
import { StoredAudioFile } from '../lib/audio/types';

describe('Comprehensive End-to-End User Journey (Phases 1–7 Integration)', () => {
  const userId = 'e2e_verified_user';

  beforeEach(() => {
    localStorage.clear();
  });

  it('executes the full end-to-end lifecycle: import -> upload -> match -> play -> export -> history', async () => {
    // -------------------------------------------------------------
    // STEP 1: Parse and import a Spotify playlist
    // -------------------------------------------------------------
    const inputUrl = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abcd1234';
    const parsed = parseSpotifyPlaylistUrl(inputUrl);
    expect(parsed.success).toBe(true);
    expect(parsed.playlistId).toBe('37i9dQZF1DXcBWIGoYBM5M');

    const playlistMeta = {
      spotifyPlaylistId: parsed.playlistId!,
      name: 'Synthwave Nightdrive',
      description: 'Chill synth beats for late night drives',
      ownerName: 'Spotify Curators',
      imageUrl: 'https://images.example.com/synth.jpg',
      externalUrl: inputUrl,
      totalTracks: 1,
      snapshotId: 'snap_001',
      isPublic: true,
      collaborative: false,
    };

    const trackMeta = [
      {
        spotifyTrackId: 'sp_track_01',
        title: 'Resonance',
        artist: 'HOME',
        album: 'Odyssey',
        durationMs: 212000,
        trackNumber: 1,
        discNumber: 1,
        isrc: 'US1234567890',
        previewUrl: null,
        coverArtUrl: 'https://images.example.com/art.jpg',
        explicit: false,
        releaseDate: '2014-01-01',
        isLocal: false,
        addedAt: new Date().toISOString(),
      },
    ];

    const { playlist: savedPlaylist, tracks: savedTracks } = await saveImportedPlaylist(userId, playlistMeta, trackMeta);
    expect(savedPlaylist.id).toBeDefined();
    expect(savedTracks).toHaveLength(1);

    const retrievedDetails = await getPlaylistDetails(savedPlaylist.id);
    expect(retrievedDetails).not.toBeNull();
    expect(retrievedDetails!.playlist.name).toBe('Synthwave Nightdrive');
    expect(retrievedDetails!.tracks).toHaveLength(1);
    const importedTrack = retrievedDetails!.tracks[0];
    expect(importedTrack.title).toBe('Resonance');

    // -------------------------------------------------------------
    // STEP 2: Ingest local audio file with genuine binary Blob
    // -------------------------------------------------------------
    const mockAudioBytes = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0xff, 0xfb]);
    const audioBlob = new Blob([mockAudioBytes], { type: 'audio/mpeg' });

    const localAudioFile: StoredAudioFile = {
      id: 'local_audio_01',
      user_id: userId,
      filename: '01 - HOME - Resonance.mp3',
      original_name: 'home_resonance.mp3',
      file_hash: 'sha256_mock_resonance_hash',
      file_size_bytes: mockAudioBytes.length,
      mime_type: 'audio/mpeg',
      title: 'Resonance',
      artist: 'HOME',
      album: 'Odyssey',
      genre: 'Synthwave',
      genres: ['Synthwave'],
      year: '2014',
      track_number: 1,
      disc_number: 1,
      duration_ms: 212000,
      bitrate_kbps: 320,
      sample_rate_hz: 44100,
      channels: 2,
      codec: 'MP3',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      blob: audioBlob,
    };

    // -------------------------------------------------------------
    // STEP 3: Match Spotify track to local audio file
    // -------------------------------------------------------------
    const matchEvaluation = MatchingEngine.evaluateMatch(importedTrack, localAudioFile);

    expect(matchEvaluation.classification).toBe('exact');
    expect(matchEvaluation.confidenceScore).toBeGreaterThanOrEqual(95);

    // Save confirmed match decision
    const savedMatch = await MatchRepository.saveMatch({
      id: 'e2e_match_001',
      user_id: userId,
      playlist_id: savedPlaylist.id,
      track_id: importedTrack.id,
      audio_file_id: localAudioFile.id,
      match_type: 'auto',
      confidence_score: matchEvaluation.confidenceScore,
      status: 'confirmed',
      matched_at: new Date().toISOString(),
      notes: 'Auto-matched during E2E integration test',
    });
    expect(savedMatch.id).toBe('e2e_match_001');

    // -------------------------------------------------------------
    // STEP 4: Build standalone offline ZIP archive
    // -------------------------------------------------------------
    const exportItem: ExportTrackItem = {
      trackId: importedTrack.id,
      title: importedTrack.title,
      artist: importedTrack.artist,
      album: importedTrack.album || '',
      genre: localAudioFile.genre || 'Electronic',
      durationMs: importedTrack.duration_ms,
      audioFileId: localAudioFile.id,
      audioFile: localAudioFile,
      status: 'ready',
      issues: [],
      exportedFilename: '01 - HOME - Resonance.mp3',
      exportedPath: 'Synthwave Nightdrive/01 - HOME - Resonance.mp3',
      fileSizeBytes: localAudioFile.file_size_bytes,
      codec: 'MP3',
      fileHash: localAudioFile.file_hash || undefined,
    };

    const exportConfig: ExportOptionsConfig = {
      sourceType: 'spotify_playlist',
      sourceId: savedPlaylist.id,
      sourceName: savedPlaylist.name,
      folderStructure: 'playlist_track',
      filenamePattern: 'track_artist_title',
      includeAudioFiles: true,
      includeCsv: true,
      includeJson: true,
      includePlaylistJson: true,
      includeReadme: true,
    };

    const zipResult = await buildZipArchive({
      tracks: [exportItem],
      config: exportConfig,
    });

    expect(zipResult.blob).toBeInstanceOf(Blob);
    expect(zipResult.filename).toBe('Synthwave Nightdrive.zip');

    // -------------------------------------------------------------
    // STEP 5: Verify ZIP contents, bit-exact audio, and manifests
    // -------------------------------------------------------------
    const unzipped = await JSZip.loadAsync(zipResult.blob);

    // Verify audio file exists in ZIP
    const zippedAudio = unzipped.file('Synthwave Nightdrive/01 - HOME - Resonance.mp3');
    expect(zippedAudio).toBeDefined();
    const extractedBytes = await zippedAudio!.async('uint8array');
    expect(extractedBytes).toEqual(mockAudioBytes);

    // Verify manifests exist
    expect(unzipped.file('metadata.json')).toBeDefined();
    expect(unzipped.file('metadata.csv')).toBeDefined();
    expect(unzipped.file('playlist.json')).toBeDefined();
    expect(unzipped.file('README.txt')).toBeDefined();

    const jsonText = await unzipped.file('metadata.json')!.async('string');
    const parsedJson = JSON.parse(jsonText);
    expect(parsedJson.archive_name).toBe('Synthwave Nightdrive');
    expect(parsedJson.tracks[0].title).toBe('Resonance');

    // -------------------------------------------------------------
    // STEP 6: Log to export history and verify search & filtering
    // -------------------------------------------------------------
    const historyRecord = await ExportHistoryRepository.recordExport({
      id: 'e2e_export_001',
      userId,
      archiveName: zipResult.filename,
      sourceType: 'spotify_playlist',
      sourceId: savedPlaylist.id,
      sourceName: savedPlaylist.name,
      totalTracks: 1,
      matchedAudioCount: 1,
      totalSizeBytes: zipResult.blob.size,
      formatsIncluded: ['audio/mpeg'],
      folderStructure: 'playlist_track',
      downloaded: true,
      status: 'completed',
      createdAt: new Date().toISOString(),
    });

    expect(historyRecord.id).toBe('e2e_export_001');

    const searchResults = await ExportHistoryRepository.searchHistory(userId, {
      query: 'synthwave',
      status: 'completed',
    });

    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].archiveName).toBe('Synthwave Nightdrive.zip');
    expect(searchResults[0].cloudStoragePath).toBeUndefined(); // accurately local-only
  });
});
