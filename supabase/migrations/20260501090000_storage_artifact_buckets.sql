INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('project-assets', 'project-assets', false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf']),
  ('onboarding-uploads', 'onboarding-uploads', false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/json']),
  ('bookkeeping-exports', 'bookkeeping-exports', false, 52428800, ARRAY['text/csv', 'application/json', 'application/pdf', 'application/zip']),
  ('audit-proofs', 'audit-proofs', false, 52428800, ARRAY['application/json', 'application/pdf', 'text/plain', 'application/zip'])
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['text/csv', 'application/json']
WHERE id = 'zkas-datasets';

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/json']
WHERE id = 'zkas-identities';

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['application/json', 'text/plain']
WHERE id = 'zkas-runs';

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['application/json', 'text/markdown', 'application/pdf']
WHERE id = 'monthly-cycle-reports';
