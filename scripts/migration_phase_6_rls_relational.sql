-- ==========================================
-- PHASE 6: RLS LOCKDOWN (PILOT JULIO)
-- ==========================================
-- This script activates Row Level Security (RLS) on all tables
-- and ensures that users can only access their own data.

-- 1. Enable RLS on all critical tables
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE anecdotal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_work_scores ENABLE ROW LEVEL SECURITY;

-- 2. Clean up any existing permissive policies
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON groups;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON students;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON attendance_lessons;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON anecdotal_records;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON schedules;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON grades;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON daily_work_scores;

-- 3. Create NEW secure policies (Owner check)
-- Groups: Direct owner check
CREATE POLICY "Docentes pueden gestionar sus propios grupos" 
ON groups FOR ALL 
USING (owner_id = auth.uid()) 
WITH CHECK (owner_id = auth.uid());

-- Students: Direct owner check (synced with groups)
CREATE POLICY "Docentes pueden gestionar sus propios estudiantes" 
ON students FOR ALL 
USING (owner_id = auth.uid()) 
WITH CHECK (owner_id = auth.uid());

-- Attendance: Direct owner check (propagated from students)
CREATE POLICY "Docentes pueden gestionar su propia asistencia" 
ON attendance_lessons FOR ALL 
USING (owner_id = auth.uid()) 
WITH CHECK (owner_id = auth.uid());

-- Anecdotal: Direct owner check (propagated from students)
CREATE POLICY "Docentes pueden gestionar su propio anecdotario" 
ON anecdotal_records FOR ALL 
USING (owner_id = auth.uid()) 
WITH CHECK (owner_id = auth.uid());

-- Schedules: Direct owner check (propagated from groups)
CREATE POLICY "Docentes pueden gestionar sus propios horarios" 
ON schedules FOR ALL 
USING (owner_id = auth.uid()) 
WITH CHECK (owner_id = auth.uid());

-- Academic Grades / Evaluations
CREATE POLICY "Docentes pueden gestionar sus propias notas" 
ON grades FOR ALL 
USING (owner_id = auth.uid()) 
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Docentes pueden gestionar su trabajo cotidiano" 
ON daily_work_scores FOR ALL 
USING (owner_id = auth.uid()) 
WITH CHECK (owner_id = auth.uid());

-- 4. Verify RLS activation
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
