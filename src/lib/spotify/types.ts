export interface SpotifyExternalUrls {
  spotify?: string;
}

export interface SpotifyImage {
  url: string;
  height?: number | null;
  width?: number | null;
}

export interface SpotifyOwner {
  id: string;
  display_name?: string | null;
  external_urls?: SpotifyExternalUrls;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  external_urls?: SpotifyExternalUrls;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  release_date?: string;
  external_urls?: SpotifyExternalUrls;
}

export interface SpotifyTrack {
  id: string | null;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  explicit: boolean;
  is_local?: boolean;
  disc_number?: number;
  track_number?: number;
  external_ids?: {
    isrc?: string;
  };
  external_urls?: SpotifyExternalUrls;
  preview_url?: string | null;
}

export interface SpotifyPlaylistTrackItem {
  added_at: string;
  is_local: boolean;
  track: SpotifyTrack | null;
}

export interface SpotifyPaginated<T> {
  href: string;
  items: T[];
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
}

export interface SpotifyPlaylistObject {
  id: string;
  name: string;
  description: string | null;
  images: SpotifyImage[];
  owner: SpotifyOwner;
  external_urls: SpotifyExternalUrls;
  public: boolean | null;
  collaborative: boolean;
  snapshot_id: string;
  tracks: SpotifyPaginated<SpotifyPlaylistTrackItem>;
}

export interface SpotifyUser {
  id: string;
  display_name: string | null;
  email?: string;
  images?: SpotifyImage[];
  external_urls?: SpotifyExternalUrls;
  product?: string;
}

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export interface SpotifySession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp in ms
  scope: string;
  user?: SpotifyUser;
}

export interface NormalizedPlaylistMetadata {
  spotifyPlaylistId: string;
  name: string;
  description: string;
  ownerName: string;
  imageUrl: string;
  externalUrl: string;
  totalTracks: number;
  snapshotId: string;
  isPublic: boolean | null;
  collaborative: boolean;
}

export interface NormalizedTrackMetadata {
  spotifyTrackId: string | null;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  trackNumber: number;
  discNumber: number;
  isrc: string | null;
  previewUrl: string | null;
  coverArtUrl: string | null;
  explicit: boolean;
  releaseDate: string | null;
  isLocal: boolean;
  addedAt: string;
}
