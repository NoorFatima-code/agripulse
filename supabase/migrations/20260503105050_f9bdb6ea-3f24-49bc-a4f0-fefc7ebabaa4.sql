
CREATE TABLE public.farm_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  crop text NOT NULL,
  soil text,
  area_ha numeric NOT NULL DEFAULT 1,
  flow_lpm numeric NOT NULL DEFAULT 1500, -- liters per minute the farmer's pump/drip delivers
  sowing_date date,
  language text NOT NULL DEFAULT 'en',
  last_watered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.farm_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own fields" ON public.farm_fields
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own fields" ON public.farm_fields
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own fields" ON public.farm_fields
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own fields" ON public.farm_fields
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_farm_fields_updated_at
  BEFORE UPDATE ON public.farm_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_farm_fields_user ON public.farm_fields(user_id);
