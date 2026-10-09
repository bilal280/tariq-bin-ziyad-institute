ALTER TABLE public.student_exams
  ADD COLUMN IF NOT EXISTS exam_status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS exam_kind text NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS stage_name text,
  ADD COLUMN IF NOT EXISTS manual_start boolean NOT NULL DEFAULT false;

ALTER TABLE public.student_exams
  DROP CONSTRAINT IF EXISTS student_exams_exam_status_check,
  ADD CONSTRAINT student_exams_exam_status_check
    CHECK (exam_status IN ('queued', 'in_progress', 'completed')),
  DROP CONSTRAINT IF EXISTS student_exams_exam_kind_check,
  ADD CONSTRAINT student_exams_exam_kind_check
    CHECK (exam_kind IN ('regular', 'milestone')),
  DROP CONSTRAINT IF EXISTS student_exams_attempt_number_check,
  ADD CONSTRAINT student_exams_attempt_number_check
    CHECK (attempt_number BETWEEN 1 AND 4 OR attempt_number BETWEEN 100 AND 199 OR attempt_number = 200),
  DROP CONSTRAINT IF EXISTS student_exams_unique_attempt,
  ADD CONSTRAINT student_exams_unique_attempt
    UNIQUE NULLS NOT DISTINCT (
      student_id,
      juz_number,
      tamhidi_stage,
      tilawah_section,
      hifd_section,
      attempt_number,
      exam_kind,
      stage_name
    );

CREATE INDEX IF NOT EXISTS idx_student_exams_queue
  ON public.student_exams (created_at)
  WHERE exam_status IN ('queued', 'in_progress');

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_exams_one_active_per_student
  ON public.student_exams (student_id)
  WHERE exam_status IN ('queued', 'in_progress');