-- ==========================================
-- MIGRATION PHASE 19: GRADES UNIQUE CONSTRAINT
-- Necesario para que el upsert de Notas funcione
-- Ejecutar en el SQL Editor de Supabase
-- ==========================================

-- 1. Eliminar duplicados si existen (mantener el más reciente)
DELETE FROM grades a
USING grades b
WHERE a.student_id = b.student_id
  AND a.rubric_id = b.rubric_id
  AND a.group_id = b.group_id
  AND a.period = b.period
  AND a.id < b.id;

-- 2. Crear el constraint UNIQUE necesario para upsert
ALTER TABLE public.grades
ADD CONSTRAINT grades_student_rubric_group_period_key 
UNIQUE (student_id, rubric_id, group_id, period);

SELECT '✅ Constraint UNIQUE creado en grades — el upsert ya funcionará' as status;
