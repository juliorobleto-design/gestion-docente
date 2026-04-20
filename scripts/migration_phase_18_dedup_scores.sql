-- ==========================================
-- MIGRACIÓN FASE 18: DEDUPLICACIÓN DE NOTAS COTIDIANAS
-- ==========================================
-- Diagnóstico: Al no existir una restricción única por estudiante y periodo,
-- pueden haberse generado registros duplicados "fantasma". Al recargar la página,
-- el registro viejo (con 1 columna) sobreescribía en pantalla al registro nuevo (con 3 columnas).

-- 1. Eliminar duplicados reteniendo solo el que ha sido actualizado más recientemente o tiene más datos
WITH duplicates AS (
    SELECT id, 
           ROW_NUMBER() OVER(PARTITION BY student_id, period ORDER BY updated_at DESC, id DESC) as rn
    FROM public.daily_work_scores
)
DELETE FROM public.daily_work_scores
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- 2. Reforzar el esquema añadiendo la restricción única que faltaba
ALTER TABLE public.daily_work_scores 
ADD CONSTRAINT daily_work_scores_student_period_key UNIQUE (student_id, period);

-- 3. Refrescar el caché
NOTIFY pgrst, 'reload schema';

SELECT 'FASE 18: DUPLICADOS ELIMINADOS Y RESTRICCION UNICA APLICADA' as status;
