ALTER TABLE public.student_attendance
  DROP CONSTRAINT IF EXISTS student_attendance_status_check;

ALTER TABLE public.student_attendance
  ADD CONSTRAINT student_attendance_status_check
  CHECK (status IN ('present', 'absent', 'late', 'excused'));