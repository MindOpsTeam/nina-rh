-- F10.5: bucket Storage 'resumes' (private) + RLS owner-scoped via path prefix.
-- Convenção de path: <user_id>/<contact_id>/<uuid>_<file_name>

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  10485760, -- 10 MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Policies p/ storage.objects: owner-scoped pelo PRIMEIRO segmento do path (user_id).
DROP POLICY IF EXISTS "resumes_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "resumes_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "resumes_owner_delete" ON storage.objects;

CREATE POLICY "resumes_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "resumes_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "resumes_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
