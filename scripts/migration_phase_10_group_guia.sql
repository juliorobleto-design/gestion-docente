-- PHASE 10: GROUP PROFESSOR GUIA
-- Añadir campos para profesor guía directamente en la tabla de grupos

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS guia_name TEXT;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS guia_phone TEXT;

COMMENT ON COLUMN public.groups.guia_name IS 'Nombre del profesor guía de la sección';
COMMENT ON COLUMN public.groups.guia_phone IS 'Teléfono del profesor guía de la sección';

SELECT 'FASE 10: CONFIGURACIÓN DE GUÍA EN GRUPOS COMPLETADA' as status;
