-- ==========================================
-- FASE 1: RESPALDO MULTI-CAPA Y AUDITORÍA
-- PROYECTO: GESTIÓN DOCENTE
-- ==========================================

-- 1. Snapshot de Seguridad (Tablas bak_*)
-- ------------------------------------------

DROP TABLE IF EXISTS public.bak_groups;
DROP TABLE IF EXISTS public.bak_students;
DROP TABLE IF EXISTS public.bak_attendance;
DROP TABLE IF EXISTS public.bak_anecdotal;
DROP TABLE IF EXISTS public.bak_schedules;
DROP TABLE IF EXISTS public.bak_users;
DROP TABLE IF EXISTS public.bak_grades;
DROP TABLE IF EXISTS public.bak_daily_work;

-- Snapshot de tablas confirmadas
CREATE TABLE public.bak_groups AS SELECT * FROM public.groups;
CREATE TABLE public.bak_students AS SELECT * FROM public.students;
CREATE TABLE public.bak_attendance AS SELECT * FROM public.attendance_lessons;
CREATE TABLE public.bak_anecdotal AS SELECT * FROM public.anecdotal_records;
CREATE TABLE public.bak_schedules AS SELECT * FROM public.schedules;
CREATE TABLE public.bak_users AS SELECT * FROM public.users;
CREATE TABLE public.bak_grades AS SELECT * FROM public.grades;
CREATE TABLE public.bak_daily_work AS SELECT * FROM public.daily_work_scores;

-- 2. Registro de Auditoría
-- ------------------------------------------
SELECT 'AUDITORÍA PRE-MIGRACIÓN' as reporte;

SELECT 
  'Grupos' as tabla, (SELECT COUNT(*) FROM public.groups) as registros UNION ALL
  SELECT 'Estudiantes', (SELECT COUNT(*) FROM public.students) UNION ALL
  SELECT 'Asistencia', (SELECT COUNT(*) FROM public.attendance_lessons) UNION ALL
  SELECT 'Anecdotario', (SELECT COUNT(*) FROM public.anecdotal_records) UNION ALL
  SELECT 'Horarios', (SELECT COUNT(*) FROM public.schedules) UNION ALL
  SELECT 'Notas (Grades)', (SELECT COUNT(*) FROM public.grades) UNION ALL
  SELECT 'Cotidiano (Daily Work)', (SELECT COUNT(*) FROM public.daily_work_scores) UNION ALL
  SELECT 'Usuarios Legacy', (SELECT COUNT(*) FROM public.users);

-- 3. Instrucciones de Backup Externo
-- ------------------------------------------
-- [IMPORTANTE] El usuario debe ir al Dashboard de Supabase:
-- 1. Table Editor -> Seleccionar tabla -> Export -> CSV.
-- o usar: pg_dump --schema=public --clean --if-exists --no-owner --no-privileges > backup_gestion_docente.sql
