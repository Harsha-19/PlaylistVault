/**
 * Phase 3 — In-Browser Audio Metadata Extraction
 * 
 * Uses official ESM `music-metadata` to read embedded ID3v1/ID3v2, Vorbis, FLAC,
 * MP4, and RIFF tags directly from browser File and Blob objects.
 */

import { parseBlob, selectCover } from 'music-metadata';
import { ExtractedAudioMetadata } from './types';
import { getFormatKey } from './validation';

/**
 * Converts a Uint8Array / Buffer into a Base64 data URL.
 */
function uint8ArrayToDataUrl(data: Uint8Array, mimeType: string): string {
  let binary = '';
  const len = data.byteLength;
  // Process in chunks to avoid call stack limits with String.fromCharCode
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = data.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const base64 = btoa(binary);
  return `data:${mimeType || 'image/jpeg'};base64,${base64}`;
}

/**
 * Heuristically splits a filename (e.g. "Daft Punk - One More Time.mp3")
 * into title and artist when embedded tags are missing.
 */
function parseFilenameFallback(filename: string): { title: string; artist: string } {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '').trim();
  
  if (nameWithoutExt.includes(' - ')) {
    const parts = nameWithoutExt.split(' - ');
    if (parts.length >= 2) {
      return {
        artist: parts[0].trim(),
        title: parts.slice(1).join(' - ').trim(),
      };
    }
  }

  return {
    title: nameWithoutExt || 'Untitled Track',
    artist: 'Unknown Artist',
  };
}

/**
 * Extracts embedded metadata from an audio file.
 */
export async function extractAudioMetadata(file: File): Promise<ExtractedAudioMetadata> {
  const fallback = parseFilenameFallback(file.name);
  const formatKey = getFormatKey(file.name);

  try {
    const parsed = await parseBlob(file, { duration: true, skipCovers: false });
    const { common, format } = parsed;

    // 1. Primary tags
    const title = common.title?.trim() || fallback.title;
    const artist =
      common.artist?.trim() ||
      common.artists?.join(', ').trim() ||
      fallback.artist;
    const albumArtist = common.albumartist?.trim() || undefined;
    const album = common.album?.trim() || 'Unknown Album';

    // 2. Genre extraction (music-metadata returns an array of strings)
    const genres = Array.isArray(common.genre)
      ? common.genre.map((g) => g.trim()).filter(Boolean)
      : [];
    const genre = genres.length > 0 ? genres[0] : 'Unknown Genre';

    // 3. Track and Disc numbering
    const trackNumber = common.track?.no ?? null;
    const discNumber = common.disk?.no ?? null;

    // 4. Year / Release Date
    let year: string | null = null;
    if (common.year) {
      year = common.year.toString();
    } else if (common.date) {
      year = common.date.substring(0, 4);
    }

    // 5. Technical Audio Attributes
    const durationMs = format.duration ? Math.round(format.duration * 1000) : 0;
    const bitrateKbps = format.bitrate ? Math.round(format.bitrate / 1000) : null;
    const sampleRateHz = format.sampleRate ?? null;
    const channels = format.numberOfChannels ?? null;
    const codec = format.codec || formatKey.toUpperCase();

    // 6. Artwork Extraction
    let artworkDataUrl: string | null = null;
    if (common.picture && common.picture.length > 0) {
      const cover = selectCover(common.picture);
      if (cover && cover.data) {
        artworkDataUrl = uint8ArrayToDataUrl(cover.data, cover.format || 'image/jpeg');
      }
    }

    return {
      title,
      artist,
      albumArtist,
      album,
      genre,
      genres,
      trackNumber,
      discNumber,
      year,
      durationMs,
      bitrateKbps,
      sampleRateHz,
      channels,
      codec,
      fileSizeBytes: file.size,
      artworkDataUrl,
    };
  } catch (error) {
    console.warn(`[PlaylistVault] Metadata parser notice for "${file.name}":`, error);

    // Graceful fallback when file has no parseable tags or custom headers
    return {
      title: fallback.title,
      artist: fallback.artist,
      album: 'Local Uploads',
      genre: 'Unknown Genre',
      genres: [],
      trackNumber: null,
      discNumber: null,
      year: null,
      durationMs: 0,
      bitrateKbps: null,
      sampleRateHz: null,
      channels: null,
      codec: formatKey.toUpperCase(),
      fileSizeBytes: file.size,
      artworkDataUrl: null,
    };
  }
}
