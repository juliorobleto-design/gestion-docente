-- ==========================================
-- MIGRACIÓN FASE 17: HOTFIX DE COLUMNAS DE COTIDIANO
-- ==========================================
-- Diagnóstico: Supabase rechazaba el guardado porque estructuralmente 
-- la tabla `daily_work_scores` no poseía oficialmente la columna de registro 
-- para 'score' numérico ni 'total_points' tras limpiezas anteriores.

-- 1. Agregar columnas en caso de no existir
ALTER TABLE public.daily_work_scores 
ADD COLUMN IF NOT EXISTS score NUMERIC DEFAULT 0;

ALTER TABLE public.daily_work_scores 
ADD COLUMN IF NOT EXISTS total_points NUMERIC DEFAULT 40;

-- 2. Refrescar caché de la tabla para PostgREST
NOTIFY pgrst, 'reload schema';

SELECT 'FASE 17: COLUMNAS DE COTIDIANO AÑADIDAS Y CACHÉ RECARGADA' as status;
