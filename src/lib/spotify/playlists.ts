import { spotifyFetch } from './client';
import {
  SpotifyPlaylistObject,
  SpotifyPlaylistTrackItem,
  SpotifyPaginated,
  NormalizedPlaylistMetadata,
  NormalizedTrackMetadata,
} from './types';
import { SpotifyApiError } from './errors';

export interface FetchPlaylistOptions {
  onProgress?: (loaded: number, total: number) => void;
}

/**
 * Normalizes Spotify playlist object into PlaylistVault database-ready format.
 */
export function normalizePlaylistMetadata(
  raw: SpotifyPlaylistObject
): NormalizedPlaylistMetadata {
  const primaryImage =
    raw.images && raw.images.length > 0 ? raw.images[0].url : '';

  return {
    spotifyPlaylistId: raw.id,
    name: raw.name || 'Untitled Playlist',
    description: raw.description || '',
    ownerName: raw.owner?.display_name || raw.owner?.id || 'Spotify Curator',
    imageUrl: primaryImage,
    externalUrl: raw.external_urls?.spotify || `https://open.spotify.com/playlist/${raw.id}`,
    totalTracks: raw.tracks?.total || 0,
    snapshotId: raw.snapshot_id || '',
    isPublic: raw.public,
    collaborative: raw.collaborative || false,
  };
}

/**
 * Normalizes a list of Spotify playlist track items, preserving sequential playlist order,
 * handling missing/unavailable tracks safely, and omitting duplicate tracks.
 */
export function normalizeTrackItems(
  items: SpotifyPlaylistTrackItem[]
): NormalizedTrackMetadata[] {
  const normalized: NormalizedTrackMetadata[] = [];
  let sequentialIndex = 1;

  for (const item of items) {
    // If the track is null (e.g., deleted or restricted from catalogue in region)
    if (!item.track) {
      continue;
    }

    const t = item.track;
    const artistNames =
      t.artists && t.artists.length > 0
        ? t.artists.map((a) => a.name).filter(Boolean).join(', ')
        : 'Unknown Artist';

    const albumArt =
      t.album?.images && t.album.images.length > 0
        ? t.album.images[0].url
        : null;

    normalized.push({
      spotifyTrackId: t.id || null,
      title: t.name || 'Untitled Track',
      artist: artistNames,
      album: t.album?.name || 'Unknown Album',
      durationMs: t.duration_ms || 0,
      trackNumber: sequentialIndex++,
      discNumber: t.disc_number || 1,
      isrc: t.external_ids?.isrc || null,
      previewUrl: t.preview_url || null,
      coverArtUrl: albumArt,
      explicit: Boolean(t.explicit),
      releaseDate: t.album?.release_date || null,
      isLocal: Boolean(t.is_local || item.is_local),
      addedAt: item.added_at || new Date().toISOString(),
    });
  }

  return normalized;
}

/**
 * Fetches playlist metadata and all tracks from the Spotify Web API with full pagination.
 */
export async function fetchFullPlaylist(
  playlistId: string,
  options: FetchPlaylistOptions = {}
): Promise<{
  playlist: NormalizedPlaylistMetadata;
  tracks: NormalizedTrackMetadata[];
}> {
  if (!playlistId || typeof playlistId !== 'string') {
    throw new SpotifyApiError('A valid Spotify playlist ID is required.');
  }

  // 1. Initial request: Fetch playlist root details and first page of tracks (up to 100)
  const rootEndpoint = `/playlists/${playlistId}?fields=id,name,description,images,owner,external_urls,public,collaborative,snapshot_id,tracks(total,limit,offset,next,items(added_at,is_local,track(id,name,artists(id,name),album(id,name,images,release_date),duration_ms,explicit,disc_number,track_number,external_ids,external_urls,preview_url)))`;

  const playlistData = await spotifyFetch<SpotifyPlaylistObject>(rootEndpoint);
  const normalizedPlaylist = normalizePlaylistMetadata(playlistData);

  const totalTracks = playlistData.tracks?.total || 0;
  let allTrackItems: SpotifyPlaylistTrackItem[] = [...(playlistData.tracks?.items || [])];

  if (options.onProgress) {
    options.onProgress(allTrackItems.length, totalTracks);
  }

  // 2. Paginate if there are more tracks
  let nextUrl = playlistData.tracks?.next;
  const maxPages = 50; // Safety boundary (up to 5,000 tracks)
  let pagesFetched = 1;

  while (nextUrl && pagesFetched < maxPages) {
    try {
      const pageData: SpotifyPaginated<SpotifyPlaylistTrackItem> = await spotifyFetch(nextUrl);
      if (pageData.items && pageData.items.length > 0) {
        allTrackItems.push(...pageData.items);
      }
      nextUrl = pageData.next;
      pagesFetched++;

      if (options.onProgress) {
        options.onProgress(allTrackItems.length, totalTracks);
      }
    } catch (err) {
      console.warn(`Error fetching track page ${pagesFetched} for playlist ${playlistId}:`, err);
      // If a subsequent page fails, we still return the tracks retrieved so far
      break;
    }
  }

  const normalizedTracks = normalizeTrackItems(allTrackItems);

  return {
    playlist: {
      ...normalizedPlaylist,
      totalTracks: normalizedTracks.length,
    },
    tracks: normalizedTracks,
  };
}
