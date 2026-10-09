ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS cohort SMALLINT NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'circles_cohort_check'
      AND conrelid = 'public.circles'::regclass
  ) THEN
    ALTER TABLE public.circles
      ADD CONSTRAINT circles_cohort_check CHECK (cohort BETWEEN 1 AND 3);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.teacher_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  cohort SMALLINT NOT NULL CHECK (cohort BETWEEN 1 AND 3),
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'unexcused_absence')),
  check_in_time TIME WITHOUT TIME ZONE,
  late_minutes INTEGER NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, cohort, attendance_date)
);

ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'teacher_attendance'
      AND policyname = 'Allow all operations on teacher attendance'
  ) THEN
    CREATE POLICY "Allow all operations on teacher attendance"
      ON public.teacher_attendance
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date
  ON public.teacher_attendance(attendance_date);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher_date
  ON public.teacher_attendance(teacher_id, attendance_date);

CREATE TRIGGER update_teacher_attendance_updated_at
  BEFORE UPDATE ON public.teacher_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();