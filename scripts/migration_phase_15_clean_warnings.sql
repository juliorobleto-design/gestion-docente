-- ==========================================
-- MIGRACIÓN FASE 15: LIMPIEZA DE ADVERTENCIAS (LINTER)
-- ==========================================

-- 1. SOLUCIÓN: "Function Search Path Mutable"
-- Especificar explícitamente el search_path en las funciones de triggers
-- para evitar vulnerabilidades de escalamiento de privilegios.
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.actualizar_updated_at() SET search_path = public;

-- 2. SOLUCIÓN: "RLS Policy Always True"
-- Borraremos CUALQUIER política vieja permisiva que haya quedado viva 
-- por accidente en el pasado, y restauraremos UNICAMENTE la política 
-- de candado estricto (owner_id).
DO $$ 
DECLARE 
    pol text; 
BEGIN 
    -- Limpieza total en anecdotal_records
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'anecdotal_records' AND schemaname = 'public' 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.anecdotal_records', pol); 
    END LOOP; 
    
    -- Limpieza total en attendance_lessons
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'attendance_lessons' AND schemaname = 'public' 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.attendance_lessons', pol); 
    END LOOP; 
END $$;

-- Recrear estrictamente las correctas:
CREATE POLICY "Docentes pueden gestionar su propio anecdotario" 
ON public.anecdotal_records FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Docentes pueden gestionar su propia asistencia" 
ON public.attendance_lessons FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

SELECT 'FASE 15: Advertencias de Código Limpias.' as status;
