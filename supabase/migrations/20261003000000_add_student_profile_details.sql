ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS birth_year INTEGER,
  ADD COLUMN IF NOT EXISTS detailed_level TEXT,
  ADD COLUMN IF NOT EXISTS family_status TEXT,
  ADD COLUMN IF NOT EXISTS school_schedule TEXT;

ALTER TABLE public.discontinued_students
  ADD COLUMN IF NOT EXISTS birth_year INTEGER,
  ADD COLUMN IF NOT EXISTS detailed_level TEXT,
  ADD COLUMN IF NOT EXISTS family_status TEXT,
  ADD COLUMN IF NOT EXISTS school_schedule TEXT;

UPDATE public.students
SET birth_year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - age
WHERE birth_year IS NULL AND age >= 0;

UPDATE public.discontinued_students
SET birth_year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - age
WHERE birth_year IS NULL AND age >= 0;

ALTER TABLE public.students
  DROP COLUMN IF EXISTS age;

ALTER TABLE public.discontinued_students
  DROP COLUMN IF EXISTS age;

CREATE OR REPLACE FUNCTION public.move_student_to_discontinued(
  p_student_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_record RECORD;
BEGIN
  SELECT * INTO v_student_record
  FROM public.students
  WHERE id = p_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  INSERT INTO public.discontinued_students (
    id,
    student_number,
    name,
    birth_year,
    photo_url,
    circle_id,
    level,
    detailed_level,
    family_status,
    school_schedule,
    contact_number,
    contact_number_2,
    notes,
    discontinued_reason,
    original_created_at
  ) VALUES (
    v_student_record.id,
    v_student_record.student_number,
    v_student_record.name,
    v_student_record.birth_year,
    v_student_record.photo_url,
    v_student_record.circle_id,
    v_student_record.level,
    v_student_record.detailed_level,
    v_student_record.family_status,
    v_student_record.school_schedule,
    v_student_record.contact_number,
    v_student_record.contact_number_2,
    v_student_record.notes,
    p_reason,
    v_student_record.created_at
  );

  DELETE FROM student_general_points_summary WHERE student_id = p_student_id;
  DELETE FROM student_general_points_log WHERE student_id = p_student_id;
  DELETE FROM public.students WHERE id = p_student_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_student_from_discontinued(
  p_student_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_record RECORD;
BEGIN
  SELECT * INTO v_student_record
  FROM public.discontinued_students
  WHERE id = p_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Discontinued student not found';
  END IF;

  INSERT INTO public.students (
    id,
    student_number,
    name,
    birth_year,
    photo_url,
    circle_id,
    level,
    detailed_level,
    family_status,
    school_schedule,
    contact_number,
    contact_number_2,
    notes,
    created_at
  ) VALUES (
    v_student_record.id,
    v_student_record.student_number,
    v_student_record.name,
    v_student_record.birth_year,
    v_student_record.photo_url,
    v_student_record.circle_id,
    v_student_record.level,
    v_student_record.detailed_level,
    v_student_record.family_status,
    v_student_record.school_schedule,
    v_student_record.contact_number,
    v_student_record.contact_number_2,
    v_student_record.notes,
    v_student_record.original_created_at
  );

  DELETE FROM public.discontinued_students WHERE id = p_student_id;

  RETURN true;
END;
$$;