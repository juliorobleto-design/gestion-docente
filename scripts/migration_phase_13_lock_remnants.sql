-- ==========================================
-- MIGRACIÓN FASE 13: BLOQUEO DE TABLAS RESIDUALES Y BACKUPS
-- ==========================================

-- 1. Cerrar candados de Tablas de Respaldo "bak_"
-- Nota: Al activar RLS sin definir "Políticas" de acceso, estas tablas 
-- quedan 100% bloqueadas para cualquier lectura pública o API, asegurando
-- que los respaldos queden accesibles únicamente para ti como SuperAdmin.

ALTER TABLE IF EXISTS public.bak_anecdotal_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bak_attendance_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bak_daily_work_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bak_grades_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bak_groups_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bak_schedules_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bak_students_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bak_users ENABLE ROW LEVEL SECURITY;

-- 2. Cerrar candados de Tablas misceláneas detectadas
ALTER TABLE IF EXISTS public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_migration_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

SELECT 'FASE 13: MISION CUMPLIDA. Todas las tablas residuales están selladas.' as status;
