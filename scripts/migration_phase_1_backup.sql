-- ==========================================
-- FASE 1: RESPALDO TOTAL DE DATOS
-- PROYECTO: GESTIÓN DOCENTE
-- ==========================================

-- 1. Snapshot de Seguridad (Tablas bak_*)
-- ------------------------------------------

-- Limpiar backups previos si existen (opcional/seguridad)
DROP TABLE IF EXISTS public.bak_groups;
DROP TABLE IF EXISTS public.bak_students;
DROP TABLE IF EXISTS public.bak_attendance;
DROP TABLE IF EXISTS public.bak_anecdotal;
DROP TABLE IF EXISTS public.bak_schedules;
DROP TABLE IF EXISTS public.bak_users;
DROP TABLE IF EXISTS public.bak_grades;
DROP TABLE IF EXISTS public.bak_daily_work;

-- Crear snapshots exactos
CREATE TABLE public.bak_groups AS SELECT * FROM public.groups;
CREATE TABLE public.bak_students AS SELECT * FROM public.students;
CREATE TABLE public.bak_attendance AS SELECT * FROM public.attendance_lessons;
CREATE TABLE public.bak_anecdotal AS SELECT * FROM public.anecdotal_records;
CREATE TABLE public.bak_schedules AS SELECT * FROM public.schedules;
CREATE TABLE public.bak_users AS SELECT * FROM public.users;
CREATE TABLE public.bak_grades AS SELECT * FROM public.grades;
CREATE TABLE public.bak_daily_work AS SELECT * FROM public.daily_work_scores;

-- 2. Reporte de Auditoría Inicial
-- ------------------------------------------

SELECT 'RESUMEN DE REGISTROS PRE-MIGRACIÓN' as reporte;

SELECT 
  (SELECT COUNT(*) FROM public.groups) as total_groups,
  (SELECT COUNT(*) FROM public.students) as total_students,
  (SELECT COUNT(*) FROM public.attendance_lessons) as total_attendance,
  (SELECT COUNT(*) FROM public.anecdotal_records) as total_anecdotal,
  (SELECT COUNT(*) FROM public.schedules) as total_schedules,
  (SELECT COUNT(*) FROM public.users) as total_users;

-- 3. Verificación de Integridad
-- ------------------------------------------
-- Comparar conteos para confirmar snapshot exitoso
SELECT 
  CASE WHEN (SELECT COUNT(*) FROM public.groups) = (SELECT COUNT(*) FROM public.bak_groups) THEN 'OK' ELSE 'FALLO' END as status_groups,
  CASE WHEN (SELECT COUNT(*) FROM public.students) = (SELECT COUNT(*) FROM public.bak_students) THEN 'OK' ELSE 'FALLO' END as status_students;
