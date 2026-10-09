-- فصل المختبرين عن جدول الأساتذة وربطهم بالاختبارات
CREATE TABLE IF NOT EXISTS public.lab_examiners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_examiners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App can read lab examiners"
  ON public.lab_examiners FOR SELECT USING (true);

CREATE POLICY "App can manage lab examiners"
  ON public.lab_examiners FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.student_exams
  ADD COLUMN IF NOT EXISTS lab_examiner_id UUID REFERENCES public.lab_examiners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lab_examiner_name TEXT;

CREATE INDEX IF NOT EXISTS idx_student_exams_lab_examiner_id
  ON public.student_exams(lab_examiner_id);

COMMENT ON COLUMN public.student_exams.teacher_name IS 'الأستاذ الذي سجّل الاختبار، وليس المختبر';
COMMENT ON COLUMN public.student_exams.lab_examiner_name IS 'اسم المختبر وقت تسجيل الاختبار للحفاظ على السجل التاريخي';