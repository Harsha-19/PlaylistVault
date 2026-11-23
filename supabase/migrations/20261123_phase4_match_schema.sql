-- ============================================================================
-- PLAYLISTVAULT — PHASE 4 MIGRATION: Track Matching & Conflict Management
-- Adds unique constraint on (playlist_id, track_id) to ensure atomic match state
-- and adds performance indexes for match queries.
-- ============================================================================

-- Ensure track_matches has a unique constraint per playlist and track
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_playlist_track_match'
  ) THEN
    ALTER TABLE public.track_matches
      ADD CONSTRAINT unique_playlist_track_match UNIQUE (playlist_id, track_id);
  END IF;
END $$;

-- Performance index for fast playlist match lookup
CREATE INDEX IF NOT EXISTS idx_matches_playlist_track 
  ON public.track_matches(playlist_id, track_id);

-- Performance index for checking audio file reuse across matches
CREATE INDEX IF NOT EXISTS idx_matches_audio_file_status 
  ON public.track_matches(audio_file_id, status);
