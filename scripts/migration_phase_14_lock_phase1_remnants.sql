-- ==========================================
-- MIGRACIÓN FASE 14: BLOQUEO DE TABLAS DE RESPALDO (FASE 1)
-- ==========================================

-- Las advertencias de Supabase provienen de la primera generación
-- de respaldos que se hicieron (que no tienen el sufijo _v3).
-- Aplicaremos el candado RLS maestro a estas tablas antiguas para 
-- silenciar definitivamente al "Security Advisor" y cerrar la brecha.

ALTER TABLE IF EXISTS public.bak_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bak_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bak_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bak_anecdotal ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bak_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bak_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bak_daily_work ENABLE ROW LEVEL SECURITY;

SELECT 'FASE 14: RESPALDOS ANTIGUOS SELLADOS.' as status;
