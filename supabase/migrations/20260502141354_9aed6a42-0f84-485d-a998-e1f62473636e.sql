-- Replace public-read with authenticated-only listing; objects remain accessible by direct public URL because the bucket is public.
DROP POLICY IF EXISTS "Crop photos are publicly readable" ON storage.objects;

CREATE POLICY "Crop photos readable by authenticated users"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'crop-photos');