-- ==========================================
-- PHASE 9: MASTER SECURITY UNIFICATION
-- UNIFICACIÓN DE OWNERSHIP A UUID (owner_id)
-- ==========================================

-- 1. RESPALDO DE SEGURIDAD (FASE V3)
-- ------------------------------------------
DROP TABLE IF EXISTS public.bak_groups_v3;
DROP TABLE IF EXISTS public.bak_students_v3;
DROP TABLE IF EXISTS public.bak_schedules_v3;
DROP TABLE IF EXISTS public.bak_attendance_v3;
DROP TABLE IF EXISTS public.bak_anecdotal_v3;
DROP TABLE IF EXISTS public.bak_grades_v3;
DROP TABLE IF EXISTS public.bak_daily_work_v3;

CREATE TABLE public.bak_groups_v3 AS SELECT * FROM public.groups;
CREATE TABLE public.bak_students_v3 AS SELECT * FROM public.students;
CREATE TABLE public.bak_schedules_v3 AS SELECT * FROM public.schedules;
CREATE TABLE public.bak_attendance_v3 AS SELECT * FROM public.attendance_lessons;
CREATE TABLE public.bak_anecdotal_v3 AS SELECT * FROM public.anecdotal_records;
CREATE TABLE public.bak_grades_v3 AS SELECT * FROM public.grades;
CREATE TABLE public.bak_daily_work_v3 AS SELECT * FROM public.daily_work_scores;

-- 2. LIMPIEZA DE DATOS PARA MIGRACIÓN LIMPIA
-- ------------------------------------------
-- El usuario autorizó limpiar tablas de negocio para evitar conflictos de tipos.
TRUNCATE public.daily_work_scores CASCADE;
TRUNCATE public.grades CASCADE;
TRUNCATE public.anecdotal_records CASCADE;
TRUNCATE public.attendance_lessons CASCADE;
TRUNCATE public.schedules CASCADE;
TRUNCATE public.students CASCADE;
TRUNCATE public.groups CASCADE;

-- 3. UNIFICACIÓN DE COLUMNAS (ALINEACIÓN A owner_id UUID)
-- ------------------------------------------

-- Función auxiliar para limpiar columnas legacy
DO $$
BEGIN
    -- TABLA: groups
    -- Eliminar user_id y asegurar owner_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='groups' AND column_name='user_id') THEN
        ALTER TABLE public.groups DROP COLUMN user_id;
    END IF;
    ALTER TABLE public.groups ALTER COLUMN owner_id SET NOT NULL;

    -- TABLA: students
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='user_id') THEN
        ALTER TABLE public.students DROP COLUMN user_id;
    END IF;
    ALTER TABLE public.students ALTER COLUMN owner_id SET NOT NULL;

    -- TABLA: attendance_lessons
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance_lessons' AND column_name='user_id') THEN
        ALTER TABLE public.attendance_lessons DROP COLUMN user_id;
    END IF;
    ALTER TABLE public.attendance_lessons ALTER COLUMN owner_id SET NOT NULL;

    -- TABLA: anecdotal_records
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='anecdotal_records' AND column_name='user_id') THEN
        ALTER TABLE public.anecdotal_records DROP COLUMN user_id;
    END IF;
    ALTER TABLE public.anecdotal_records ALTER COLUMN owner_id SET NOT NULL;

    -- TABLA: schedules
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schedules' AND column_name='user_id') THEN
        ALTER TABLE public.schedules DROP COLUMN user_id;
    END IF;
    ALTER TABLE public.schedules ALTER COLUMN owner_id SET NOT NULL;

    -- TABLA: grades
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='grades' AND column_name='user_id') THEN
        ALTER TABLE public.grades DROP COLUMN user_id;
    END IF;
    ALTER TABLE public.grades ALTER COLUMN owner_id SET NOT NULL;

    -- TABLA: daily_work_scores
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_work_scores' AND column_name='user_id') THEN
        ALTER TABLE public.daily_work_scores DROP COLUMN user_id;
    END IF;
    ALTER TABLE public.daily_work_scores ALTER COLUMN owner_id SET NOT NULL;
END $$;

-- 4. VINCULACIÓN CON auth.users
-- ------------------------------------------
-- Añadir llaves foráneas explicitas para integridad referencial con Supabase Auth
ALTER TABLE public.groups ADD CONSTRAINT fk_groups_owner FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.students ADD CONSTRAINT fk_students_owner FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_lessons ADD CONSTRAINT fk_attendance_owner FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.anecdotal_records ADD CONSTRAINT fk_anecdotal_owner FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.schedules ADD CONSTRAINT fk_schedules_owner FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.grades ADD CONSTRAINT fk_grades_owner FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.daily_work_scores ADD CONSTRAINT fk_daily_work_owner FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. ACTUALIZACIÓN DE POLÍTICAS RLS
-- ------------------------------------------
-- Asegurar que todas las tablas tengan RLS habilitado y políticas basadas en owner_id

-- Función para recrear políticas de forma limpia
DO $$
BEGIN
    -- Ejemplo para groups
    DROP POLICY IF EXISTS "Docentes pueden gestionar sus propios grupos" ON groups;
    CREATE POLICY "Docentes pueden gestionar sus propios grupos" 
    ON groups FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

    -- Ejemplo para students
    DROP POLICY IF EXISTS "Docentes pueden gestionar sus propios estudiantes" ON students;
    CREATE POLICY "Docentes pueden gestionar sus propios estudiantes" 
    ON students FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

    -- Ejemplo para attendance
    DROP POLICY IF EXISTS "Docentes pueden gestionar su propia asistencia" ON attendance_lessons;
    CREATE POLICY "Docentes pueden gestionar su propia asistencia" 
    ON attendance_lessons FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

    -- Repetir para el resto...
    DROP POLICY IF EXISTS "Docentes pueden gestionar su propio anecdotario" ON anecdotal_records;
    CREATE POLICY "Docentes pueden gestionar su propio anecdotario" 
    ON anecdotal_records FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

    DROP POLICY IF EXISTS "Docentes pueden gestionar sus propios horarios" ON schedules;
    CREATE POLICY "Docentes pueden gestionar sus propios horarios" 
    ON schedules FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

    DROP POLICY IF EXISTS "Docentes pueden gestionar sus propias notas" ON grades;
    CREATE POLICY "Docentes pueden gestionar sus propias notas" 
    ON grades FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

    DROP POLICY IF EXISTS "Docentes pueden gestionar su trabajo cotidiano" ON daily_work_scores;
    CREATE POLICY "Docentes pueden gestionar su trabajo cotidiano" 
    ON daily_work_scores FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
END $$;

SELECT 'FASE 9: UNIFICACIÓN DE SEGURIDAD COMPLETADA' as status;
