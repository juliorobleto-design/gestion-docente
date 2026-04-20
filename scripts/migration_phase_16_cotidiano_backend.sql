-- ==========================================
-- MIGRACIÓN FASE 16: BACKEND COTIDIANO (MATRIZ EXCEL)
-- ==========================================

-- 1. CREACIÓN DE GAVETA DE MEMORIA (Columnas dinámicas por Grupo y Período)
CREATE TABLE IF NOT EXISTS public.cotidiano_columns_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id BIGINT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    period VARCHAR(20) NOT NULL CHECK (period IN ('semester1', 'semester2')),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    columns_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(group_id, period)
);

-- 2. BLOQUEO DE SEGURIDAD (RLS)
ALTER TABLE public.cotidiano_columns_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Docentes gestionan sus config cotidiano"
ON public.cotidiano_columns_config FOR ALL
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Triggers de actualización de fecha
DROP TRIGGER IF EXISTS trg_set_update_cotidiano_cfg ON public.cotidiano_columns_config;
CREATE TRIGGER trg_set_update_cotidiano_cfg
BEFORE UPDATE ON public.cotidiano_columns_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 3. EXPANSIÓN TABLA ACTUAL (Inyección JSON para Celdas)
-- Agregamos la capacidad de guardar la nota específica de cada celda ("Cotidiano 1", "Cotidiano 2")
-- sin romper el total ("score") que usan los Reportes.
ALTER TABLE public.daily_work_scores 
ADD COLUMN IF NOT EXISTS matrix_cells JSONB DEFAULT '{}'::jsonb;

-- El RLS de daily_work_scores ya existe desde la Fase 9, por lo que está blindado automáticamente.

SELECT 'FASE 16: ESTRUCTURA MATRIZ COTIDIANO HABILITADA' as status;
