/**
 * Phase 3 — Audio Format Validation & File Integrity
 */

import { SupportedAudioFormat } from './types';

export const MAX_AUDIO_FILE_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB per file limit for safe browser memory

export const SUPPORTED_AUDIO_FORMATS: Record<string, SupportedAudioFormat> = {
  mp3: {
    extension: '.mp3',
    mimeType: 'audio/mpeg',
    name: 'MP3',
    description: 'MPEG Layer-3 Audio',
  },
  flac: {
    extension: '.flac',
    mimeType: 'audio/flac',
    name: 'FLAC',
    description: 'Free Lossless Audio Codec',
  },
  wav: {
    extension: '.wav',
    mimeType: 'audio/wav',
    name: 'WAV',
    description: 'Waveform Audio File Format',
  },
  m4a: {
    extension: '.m4a',
    mimeType: 'audio/mp4',
    name: 'M4A',
    description: 'MPEG-4 Audio / AAC',
  },
  aac: {
    extension: '.aac',
    mimeType: 'audio/aac',
    name: 'AAC',
    description: 'Advanced Audio Coding',
  },
  ogg: {
    extension: '.ogg',
    mimeType: 'audio/ogg',
    name: 'OGG',
    description: 'Ogg Vorbis Audio',
  },
  opus: {
    extension: '.opus',
    mimeType: 'audio/opus',
    name: 'OPUS',
    description: 'Opus Interactive Audio Codec',
  },
  aiff: {
    extension: '.aiff',
    mimeType: 'audio/aiff',
    name: 'AIFF',
    description: 'Audio Interchange File Format',
  },
  aif: {
    extension: '.aif',
    mimeType: 'audio/aiff',
    name: 'AIFF',
    description: 'Audio Interchange File Format',
  },
};

export class AudioValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'AudioValidationError';
  }
}

/**
 * Reads ArrayBuffer from a Blob safely across browser and test environments.
 */
export async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Extracts normalized lowercase file extension with leading dot.
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return '';
  return filename.slice(lastDotIndex).toLowerCase();
}

/**
 * Extracts format key from filename.
 */
export function getFormatKey(filename: string): string {
  const ext = getFileExtension(filename);
  return ext.replace('.', '').toLowerCase();
}

/**
 * Validates whether an audio file is acceptable for upload.
 */
export async function validateAudioFile(file: File): Promise<{
  isValid: boolean;
  format: SupportedAudioFormat;
  normalizedMime: string;
}> {
  // 1. Check file existence and minimum size
  if (!file || file.size === 0) {
    throw new AudioValidationError('The selected file is empty (0 bytes).', 'EMPTY_FILE');
  }

  // 2. Check maximum size
  if (file.size > MAX_AUDIO_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new AudioValidationError(
      `File size (${sizeMb} MB) exceeds maximum allowed limit of 250 MB.`,
      'FILE_TOO_LARGE'
    );
  }

  // 3. Extension inspection
  const ext = getFileExtension(file.name);
  const formatKey = ext.replace('.', '');
  const format = SUPPORTED_AUDIO_FORMATS[formatKey];

  if (!format) {
    throw new AudioValidationError(
      `Unsupported audio format "${ext}". Supported formats: MP3, FLAC, WAV, M4A, AAC, OGG, OPUS, AIFF.`,
      'UNSUPPORTED_FORMAT'
    );
  }

  // 4. Quick Header / Magic Byte verification for known signatures
  try {
    const slice = await readBlobAsArrayBuffer(file.slice(0, 12));
    const bytes = new Uint8Array(slice);

    // Verify format signature if known
    if (formatKey === 'flac') {
      // "fLaC" in ASCII: 0x66, 0x4C, 0x61, 0x43
      const isFlac = bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43;
      if (!isFlac) {
        throw new AudioValidationError('File header does not match valid FLAC signature.', 'CORRUPTED_FILE');
      }
    } else if (formatKey === 'wav') {
      // "RIFF" ... "WAVE"
      const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
      const isWave = bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
      if (!isRiff || !isWave) {
        throw new AudioValidationError('File header does not match valid WAV signature.', 'CORRUPTED_FILE');
      }
    } else if (formatKey === 'ogg' || formatKey === 'opus') {
      // "OggS" in ASCII: 0x4F, 0x67, 0x67, 0x53
      const isOgg = bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
      if (!isOgg) {
        throw new AudioValidationError('File header does not match valid Ogg container signature.', 'CORRUPTED_FILE');
      }
    }
  } catch (err) {
    if (err instanceof AudioValidationError) throw err;
    // Non-fatal if header slice fails on unusual platforms; fallback to music-metadata validation
  }

  return {
    isValid: true,
    format,
    normalizedMime: file.type || format.mimeType,
  };
}
