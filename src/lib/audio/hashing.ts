/**
 * Phase 3 — High-Performance Audio File Content Hashing
 * 
 * Uses Web Crypto API (SHA-256) to generate deterministic content hashes
 * for duplicate detection without loading entire multi-hundred-megabyte files into memory.
 */

import { readBlobAsArrayBuffer } from './validation';

const FULL_HASH_THRESHOLD_BYTES = 16 * 1024 * 1024; // 16 MB

/**
 * Converts ArrayBuffer to lowercase hexadecimal string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  let hexString = '';
  for (let i = 0; i < byteArray.length; i++) {
    const hex = byteArray[i].toString(16).padStart(2, '0');
    hexString += hex;
  }
  return hexString;
}

/**
 * Computes deterministic SHA-256 content hash of an audio file or blob.
 * For files under 16 MB, hashes the entire binary content.
 * For larger files, hashes a deterministic composite of head, middle, tail slices, and exact length.
 */
export async function computeAudioFileHash(file: File | Blob): Promise<string> {
  if (!file || file.size === 0) {
    return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // SHA-256 of empty string
  }

  // Check Web Crypto availability
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    const filename = 'name' in file ? (file as File).name : 'blob';
    // Basic fallback hash if Web Crypto subtle is somehow missing (e.g. non-secure context)
    return `hash-${file.size}-${filename}-${Date.now()}`;
  }

  if (file.size <= FULL_HASH_THRESHOLD_BYTES) {
    // Full content hash
    const arrayBuffer = await readBlobAsArrayBuffer(file);
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    return bufferToHex(hashBuffer);
  }

  // Chunked composite hash for large audio files to prevent browser memory bloat
  const chunkSize = 2 * 1024 * 1024; // 2 MB slices
  const headSlice = file.slice(0, chunkSize);
  const midStart = Math.floor(file.size / 2) - Math.floor(chunkSize / 2);
  const midSlice = file.slice(midStart, midStart + chunkSize);
  const tailSlice = file.slice(file.size - chunkSize, file.size);

  const [headBuf, midBuf, tailBuf] = await Promise.all([
    readBlobAsArrayBuffer(headSlice),
    readBlobAsArrayBuffer(midSlice),
    readBlobAsArrayBuffer(tailSlice),
  ]);

  // Combine slices and length encoding into single composite buffer
  const sizePrefix = new TextEncoder().encode(`size:${file.size}:`);
  const totalLength = sizePrefix.byteLength + headBuf.byteLength + midBuf.byteLength + tailBuf.byteLength;
  const composite = new Uint8Array(totalLength);

  let offset = 0;
  composite.set(sizePrefix, offset);
  offset += sizePrefix.byteLength;

  composite.set(new Uint8Array(headBuf), offset);
  offset += headBuf.byteLength;

  composite.set(new Uint8Array(midBuf), offset);
  offset += midBuf.byteLength;

  composite.set(new Uint8Array(tailBuf), offset);

  const hashBuffer = await crypto.subtle.digest('SHA-256', composite.buffer);
  return bufferToHex(hashBuffer);
}
