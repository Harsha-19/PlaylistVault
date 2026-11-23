import { describe, it, expect } from 'vitest';
import { extractAudioMetadata } from '../lib/audio/metadata';

describe('Audio Metadata Extraction Service', () => {
  it('heuristically parses artist and title from standard filename when tags are missing', async () => {
    const file = new File(['mock audio stream'], 'Daft Punk - One More Time.mp3', { type: 'audio/mpeg' });
    const metadata = await extractAudioMetadata(file);

    expect(metadata.title).toBe('One More Time');
    expect(metadata.artist).toBe('Daft Punk');
    expect(metadata.codec).toBe('MP3');
    expect(metadata.fileSizeBytes).toBe(file.size);
  });

  it('falls back cleanly when filename has no artist delimiter', async () => {
    const file = new File(['mock bytes'], 'Starlight.flac', { type: 'audio/flac' });
    const metadata = await extractAudioMetadata(file);

    expect(metadata.title).toBe('Starlight');
    expect(metadata.artist).toBe('Unknown Artist');
    expect(metadata.codec).toBe('FLAC');
  });

  it('handles multiple hyphens in song title correctly', async () => {
    const file = new File(['bytes'], 'Queen - Bohemian Rhapsody - Remastered 2011.mp3', { type: 'audio/mpeg' });
    const metadata = await extractAudioMetadata(file);

    expect(metadata.artist).toBe('Queen');
    expect(metadata.title).toBe('Bohemian Rhapsody - Remastered 2011');
  });

  it('safely handles corrupt or unrecognized audio files without throwing', async () => {
    const corruptFile = new File(['corrupt binary garbage data'], 'broken.ogg', { type: 'audio/ogg' });
    const metadata = await extractAudioMetadata(corruptFile);

    expect(metadata).toBeDefined();
    expect(metadata.title).toBe('broken');
    expect(metadata.codec).toBe('OGG');
    expect(metadata.genre).toBe('Unknown Genre');
  });
});
