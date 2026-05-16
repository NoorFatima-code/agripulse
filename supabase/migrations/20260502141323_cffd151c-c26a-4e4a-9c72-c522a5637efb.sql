-- Add UI mode preference to profiles (simple vs pro)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ui_mode TEXT NOT NULL DEFAULT 'pro' CHECK (ui_mode IN ('simple', 'pro'));

-- Storage bucket for crop photos uploaded by farmers
INSERT INTO storage.buckets (id, name, public)
VALUES ('crop-photos', 'crop-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read crop photos (public bucket for AI diagnosis display)
CREATE POLICY "Crop photos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'crop-photos');

-- Authenticated users can upload to their own folder
CREATE POLICY "Users upload own crop photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'crop-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own crop photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'crop-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own crop photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'crop-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Table to log voice/photo conversations & quick crop reports for farmers
CREATE TABLE IF NOT EXISTS public.farm_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'voice' CHECK (kind IN ('voice','photo','manual')),
  crop TEXT,
  note TEXT,
  ai_response TEXT,
  image_url TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.farm_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reports"
ON public.farm_reports FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users create own reports"
ON public.farm_reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own reports"
ON public.farm_reports FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own reports"
ON public.farm_reports FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_farm_reports_user ON public.farm_reports(user_id, created_at DESC);