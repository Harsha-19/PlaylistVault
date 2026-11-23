-- ========================================================================
-- PLAYLISTVAULT: POSTGRESQL RELATIONAL SCHEMA & ROW LEVEL SECURITY (RLS)
-- ========================================================================

-- Ensure pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------
-- 1. PROFILES TABLE (Linked to auth.users)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ------------------------------------------------------------------------
-- 2. PLAYLISTS TABLE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spotify_playlist_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  owner_name TEXT,
  external_url TEXT,
  total_tracks INTEGER DEFAULT 0,
  snapshot_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_spotify_playlist UNIQUE (user_id, spotify_playlist_id)
);

CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON public.playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlists_spotify_id ON public.playlists(spotify_playlist_id);

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own playlists"
  ON public.playlists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own playlists"
  ON public.playlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own playlists"
  ON public.playlists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own playlists"
  ON public.playlists FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------
-- 3. TRACKS TABLE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  spotify_track_id TEXT,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  duration_ms INTEGER DEFAULT 0,
  track_number INTEGER DEFAULT 1,
  disc_number INTEGER DEFAULT 1,
  isrc TEXT,
  preview_url TEXT,
  cover_art_url TEXT,
  genres TEXT[] DEFAULT '{}',
  explicit BOOLEAN DEFAULT FALSE,
  release_date TEXT,
  is_local BOOLEAN DEFAULT FALSE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_playlist_track_pos UNIQUE (playlist_id, track_number)
);

CREATE INDEX IF NOT EXISTS idx_tracks_playlist_id ON public.tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_spotify_id ON public.tracks(spotify_track_id);
CREATE INDEX IF NOT EXISTS idx_tracks_title_artist ON public.tracks(title, artist);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tracks belonging to their playlists"
  ON public.tracks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = tracks.playlist_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tracks to their playlists"
  ON public.tracks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = tracks.playlist_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tracks in their playlists"
  ON public.tracks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = tracks.playlist_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tracks in their playlists"
  ON public.tracks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = tracks.playlist_id AND p.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------
-- 4. AUDIO FILES TABLE (User's authorized uploaded files)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audio_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  file_hash TEXT,
  duration_ms INTEGER,
  title TEXT,
  artist TEXT,
  album TEXT,
  genre TEXT,
  year TEXT,
  bitrate_kbps INTEGER,
  sample_rate_hz INTEGER,
  channels INTEGER,
  storage_path TEXT,
  is_cloud_stored BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_files_user_id ON public.audio_files(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_files_hash ON public.audio_files(file_hash);

ALTER TABLE public.audio_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audio files"
  ON public.audio_files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audio files"
  ON public.audio_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own audio files"
  ON public.audio_files FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audio files"
  ON public.audio_files FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------
-- 5. TRACK MATCHES TABLE (Joins Playlist Tracks to Audio Files)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.track_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  audio_file_id UUID NOT NULL REFERENCES public.audio_files(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('auto', 'manual')) DEFAULT 'auto',
  confidence_score NUMERIC(5, 2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100) DEFAULT 0.00,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'pending', 'rejected')) DEFAULT 'confirmed',
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  CONSTRAINT unique_track_audio_match UNIQUE (track_id, audio_file_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_playlist_id ON public.track_matches(playlist_id);
CREATE INDEX IF NOT EXISTS idx_matches_track_id ON public.track_matches(track_id);
CREATE INDEX IF NOT EXISTS idx_matches_audio_id ON public.track_matches(audio_file_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_id ON public.track_matches(user_id);

ALTER TABLE public.track_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own track matches"
  ON public.track_matches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own track matches"
  ON public.track_matches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own track matches"
  ON public.track_matches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own track matches"
  ON public.track_matches FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------
-- 6. EXPORT ARCHIVES TABLE (Export history and cloud archive references)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.export_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  playlist_id UUID REFERENCES public.playlists(id) ON DELETE SET NULL,
  archive_name TEXT NOT NULL,
  total_tracks INTEGER NOT NULL DEFAULT 0,
  total_matched_audio INTEGER NOT NULL DEFAULT 0,
  total_size_bytes BIGINT NOT NULL DEFAULT 0,
  formats_included TEXT[] DEFAULT '{"audio", "csv", "json"}',
  storage_path TEXT,
  download_count INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'in_progress')) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exports_user_id ON public.export_archives(user_id);

ALTER TABLE public.export_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own export archives"
  ON public.export_archives FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own export archives"
  ON public.export_archives FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own export archives"
  ON public.export_archives FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own export archives"
  ON public.export_archives FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------
-- 7. AUTOMATIC PROFILE CREATION TRIGGER
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
