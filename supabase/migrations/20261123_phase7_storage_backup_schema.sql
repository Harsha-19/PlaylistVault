-- ========================================================================
-- PLAYLISTVAULT: PHASE 7 — SUPABASE STORAGE & CLOUD BACKUP SECURITY POLICIES
-- ========================================================================

-- 1. Create Private Storage Bucket for Export Archives
-- File size limit: 1 GB (1073741824 bytes); Private bucket; restricted to ZIP archives
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'export-archives',
  'export-archives',
  false,
  1073741824,
  ARRAY['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 1073741824,
  allowed_mime_types = ARRAY['application/zip', 'application/x-zip-compressed', 'application/octet-stream'];

-- 2. Storage RLS Policies (User Path Isolation: {userId}/{archiveId}/{filename}.zip)
-- Users can only select/download their own archives
CREATE POLICY "Users can download own export archives"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'export-archives'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can upload export archives to their own user folder
CREATE POLICY "Users can upload own export archives"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'export-archives'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own export archives
CREATE POLICY "Users can update own export archives"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'export-archives'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own export archives
CREATE POLICY "Users can delete own export archives"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'export-archives'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
