import { describe, it, expect } from 'vitest';
import { computeAudioFileHash } from '../lib/audio/hashing';

describe('Audio Content Hashing Service', () => {
  it('returns standard empty hash for empty file or blob', async () => {
    const empty = new Blob([]);
    const hash = await computeAudioFileHash(empty);
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('generates a 64-character lowercase hex string for small files', async () => {
    const file = new File(['sample audio binary bytes 123456'], 'track.mp3', { type: 'audio/mpeg' });
    const hash = await computeAudioFileHash(file);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces identical hashes for identical content', async () => {
    const content = 'The exact same audio file bytes repeated for consistency testing.';
    const fileA = new File([content], 'original.flac', { type: 'audio/flac' });
    const fileB = new File([content], 'renamed_copy.flac', { type: 'audio/flac' });

    const hashA = await computeAudioFileHash(fileA);
    const hashB = await computeAudioFileHash(fileB);

    expect(hashA).toBe(hashB);
  });

  it('produces different hashes for different audio content', async () => {
    const fileA = new File(['audio content variant 1'], 'track1.mp3', { type: 'audio/mpeg' });
    const fileB = new File(['audio content variant 2'], 'track2.mp3', { type: 'audio/mpeg' });

    const hashA = await computeAudioFileHash(fileA);
    const hashB = await computeAudioFileHash(fileB);

    expect(hashA).not.toBe(hashB);
  });
});
