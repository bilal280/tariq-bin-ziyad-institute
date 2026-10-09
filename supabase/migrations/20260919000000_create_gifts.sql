-- كتالوج الهدايا: الاسم، السعر بالنجوم، وصورة الهدية فقط
CREATE TABLE IF NOT EXISTS public.gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  star_price INTEGER NOT NULL CHECK (star_price > 0),
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view gifts"
  ON public.gifts FOR SELECT USING (true);

CREATE POLICY "App can manage gifts"
  ON public.gifts FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_gifts_star_price ON public.gifts(star_price);

-- الصور ترفع إلى bucket الصور الموجود في التطبيق
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-photos', 'student-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can view gift images'
  ) THEN
    CREATE POLICY "Public can view gift images"
      ON storage.objects FOR SELECT USING (bucket_id = 'student-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'App can upload gift images'
  ) THEN
    CREATE POLICY "App can upload gift images"
      ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'student-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'App can delete gift images'
  ) THEN
    CREATE POLICY "App can delete gift images"
      ON storage.objects FOR DELETE USING (bucket_id = 'student-photos');
  END IF;
END $$;

COMMENT ON TABLE public.gifts IS 'Public gift catalog priced in student stars';