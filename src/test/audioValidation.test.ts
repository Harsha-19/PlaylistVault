import { describe, it, expect } from 'vitest';
import {
  validateAudioFile,
  getFileExtension,
  getFormatKey,
  AudioValidationError,
  SUPPORTED_AUDIO_FORMATS,
  MAX_AUDIO_FILE_SIZE_BYTES,
} from '../lib/audio/validation';

describe('Audio Validation Service', () => {
  it('extracts file extension and format key correctly', () => {
    expect(getFileExtension('track.mp3')).toBe('.mp3');
    expect(getFileExtension('SONG.FLAC')).toBe('.flac');
    expect(getFileExtension('my.archive.song.wav')).toBe('.wav');
    expect(getFileExtension('noextension')).toBe('');

    expect(getFormatKey('test.opus')).toBe('opus');
    expect(getFormatKey('AUDIO.AIFF')).toBe('aiff');
  });

  it('recognizes all mandatory supported formats', () => {
    const requiredFormats = ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'aiff'];
    requiredFormats.forEach((fmt) => {
      expect(SUPPORTED_AUDIO_FORMATS[fmt]).toBeDefined();
    });
  });

  it('rejects empty files (0 bytes)', async () => {
    const emptyFile = new File([], 'empty.mp3', { type: 'audio/mpeg' });
    await expect(validateAudioFile(emptyFile)).rejects.toThrow(AudioValidationError);
    await expect(validateAudioFile(emptyFile)).rejects.toThrow('empty');
  });

  it('rejects files exceeding the 250 MB size limit', async () => {
    const oversizedFile = new File([''], 'huge.wav', { type: 'audio/wav' });
    Object.defineProperty(oversizedFile, 'size', { value: MAX_AUDIO_FILE_SIZE_BYTES + 1024 });

    await expect(validateAudioFile(oversizedFile)).rejects.toThrow(AudioValidationError);
    await expect(validateAudioFile(oversizedFile)).rejects.toThrow('exceeds maximum allowed limit');
  });

  it('rejects unsupported file formats', async () => {
    const txtFile = new File(['hello'], 'document.txt', { type: 'text/plain' });
    await expect(validateAudioFile(txtFile)).rejects.toThrow(AudioValidationError);
    await expect(validateAudioFile(txtFile)).rejects.toThrow('Unsupported audio format');

    const exeFile = new File(['binary'], 'virus.exe', { type: 'application/octet-stream' });
    await expect(validateAudioFile(exeFile)).rejects.toThrow(AudioValidationError);
  });

  it('validates genuine MP3 and M4A files', async () => {
    const mp3File = new File(['dummy audio content bytes'], 'song.mp3', { type: 'audio/mpeg' });
    const result = await validateAudioFile(mp3File);
    expect(result.isValid).toBe(true);
    expect(result.format.name).toBe('MP3');
  });

  it('validates genuine WAV header signature', async () => {
    // RIFF (4) + length (4) + WAVE (4)
    const riffHeader = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x24, 0x00, 0x00, 0x00, // file length
      0x57, 0x41, 0x56, 0x45, // "WAVE"
    ]);
    const wavFile = new File([riffHeader], 'test.wav', { type: 'audio/wav' });
    const result = await validateAudioFile(wavFile);
    expect(result.isValid).toBe(true);
    expect(result.format.name).toBe('WAV');
  });

  it('rejects WAV file with corrupted signature', async () => {
    const badHeader = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]);
    const badWav = new File([badHeader], 'fake.wav', { type: 'audio/wav' });
    await expect(validateAudioFile(badWav)).rejects.toThrow(AudioValidationError);
    await expect(validateAudioFile(badWav)).rejects.toThrow('valid WAV signature');
  });
});
