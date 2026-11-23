export class SpotifyApiError extends Error {
  public status: number;
  public retryAfter?: number;

  constructor(message: string, status: number = 500, retryAfter?: number) {
    super(message);
    this.name = 'SpotifyApiError';
    this.status = status;
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, SpotifyApiError.prototype);
  }
}

export class SpotifyAuthError extends Error {
  public reason?: string;

  constructor(message: string, reason?: string) {
    super(message);
    this.name = 'SpotifyAuthError';
    this.reason = reason;
    Object.setPrototypeOf(this, SpotifyAuthError.prototype);
  }
}

export class RateLimitError extends SpotifyApiError {
  public retryAfterSeconds: number;

  constructor(retryAfterSeconds: number = 5) {
    super(
      `Spotify API rate limit reached. Please wait ${retryAfterSeconds}s before retrying.`,
      429,
      retryAfterSeconds
    );
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class PlaylistParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlaylistParseError';
    Object.setPrototypeOf(this, PlaylistParseError.prototype);
  }
}
