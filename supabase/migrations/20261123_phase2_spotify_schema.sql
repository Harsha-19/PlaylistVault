-- ========================================================================
-- PLAYLISTVAULT MIGRATION: Phase 2 Spotify Web API Integration
-- ========================================================================

-- 1. Ensure unique constraint on (user_id, spotify_playlist_id) for idempotent playlist re-imports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_spotify_playlist'
  ) THEN
    ALTER TABLE public.playlists
    ADD CONSTRAINT unique_user_spotify_playlist UNIQUE (user_id, spotify_playlist_id);
  END IF;
END $$;

-- 2. Add extra track metadata fields (explicit, release_date, is_local) if not existing
ALTER TABLE public.tracks
ADD COLUMN IF NOT EXISTS explicit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS release_date TEXT,
ADD COLUMN IF NOT EXISTS is_local BOOLEAN DEFAULT FALSE;

-- 3. Ensure unique constraint on (playlist_id, track_number) for deterministic track ordering and idempotent updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_playlist_track_pos'
  ) THEN
    ALTER TABLE public.tracks
    ADD CONSTRAINT unique_playlist_track_pos UNIQUE (playlist_id, track_number);
  END IF;
END $$;

-- 4. Create index on (playlist_id, spotify_track_id) for fast track lookups
CREATE INDEX IF NOT EXISTS idx_tracks_playlist_spotify ON public.tracks(playlist_id, spotify_track_id);
