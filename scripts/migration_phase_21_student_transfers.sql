-- ==========================================
-- MIGRATION PHASE 21: STUDENT TRANSFERS
-- Funcionalidad de traspaso de estudiante entre grupos
-- sin pérdida de historial académico.
--
-- PRINCIPIO DE SEGURIDAD:
--   - NO elimina estudiantes
--   - NO duplica registros
--   - NO modifica asistencia, notas ni cotidiano
--   - Solo actualiza students.group_id
--   - Registra auditoría en student_transfers
--
-- Ejecutar en el SQL Editor de Supabase
-- ==========================================

-- ─────────────────────────────────────────
-- 1. TABLA DE AUDITORÍA DE TRASPASOS
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_transfers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    from_group_id BIGINT NOT NULL,
    to_group_id BIGINT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT,
    transferred_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índice para consultas rápidas por estudiante
CREATE INDEX IF NOT EXISTS idx_student_transfers_student 
ON public.student_transfers(student_id);

-- Índice para consultas por docente
CREATE INDEX IF NOT EXISTS idx_student_transfers_owner 
ON public.student_transfers(owner_id);

-- ─────────────────────────────────────────
-- 2. RLS PARA TABLA DE TRASPASOS
-- ─────────────────────────────────────────

ALTER TABLE public.student_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Docentes pueden gestionar sus traspasos" ON public.student_transfers;
CREATE POLICY "Docentes pueden gestionar sus traspasos"
ON public.student_transfers FOR ALL
USING (owner_id = auth.uid()) 
WITH CHECK (owner_id = auth.uid());

-- ─────────────────────────────────────────
-- 3. FUNCIÓN RPC: TRASPASO ATÓMICO SEGURO
-- ─────────────────────────────────────────
-- Valida ownership, registra auditoría y 
-- actualiza group_id en una sola transacción.

CREATE OR REPLACE FUNCTION public.transfer_student(
    p_student_id BIGINT,
    p_to_group_id BIGINT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner UUID;
    v_from_group BIGINT;
    v_student_name TEXT;
    v_from_group_name TEXT;
    v_to_group_name TEXT;
BEGIN
    -- 1. Obtener el usuario autenticado
    v_owner := auth.uid();
    IF v_owner IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
    END IF;

    -- 2. Verificar que el estudiante pertenece al docente actual
    SELECT group_id, name 
    INTO v_from_group, v_student_name
    FROM public.students
    WHERE id = p_student_id AND owner_id = v_owner;

    IF v_from_group IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Estudiante no encontrado o no le pertenece');
    END IF;

    -- 3. No permitir traspaso al mismo grupo
    IF v_from_group = p_to_group_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'El estudiante ya está en ese grupo');
    END IF;

    -- 4. Verificar que el grupo destino pertenece al docente actual
    SELECT name INTO v_to_group_name
    FROM public.groups
    WHERE id = p_to_group_id AND owner_id = v_owner;

    IF v_to_group_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Grupo destino no válido o no le pertenece');
    END IF;

    -- 5. Obtener nombre del grupo origen para la respuesta
    SELECT name INTO v_from_group_name
    FROM public.groups
    WHERE id = v_from_group;

    -- 6. Registrar el traspaso en la tabla de auditoría
    INSERT INTO public.student_transfers (
        student_id, from_group_id, to_group_id, owner_id, reason
    ) VALUES (
        p_student_id, v_from_group, p_to_group_id, v_owner, p_reason
    );

    -- 7. Actualizar el grupo del estudiante (ÚNICA modificación a datos existentes)
    UPDATE public.students
    SET group_id = p_to_group_id
    WHERE id = p_student_id AND owner_id = v_owner;

    -- 8. Retornar resultado exitoso con contexto
    RETURN jsonb_build_object(
        'success', true,
        'student_name', v_student_name,
        'from_group_id', v_from_group,
        'from_group_name', COALESCE(v_from_group_name, 'Desconocido'),
        'to_group_id', p_to_group_id,
        'to_group_name', v_to_group_name
    );
END;
$$;

-- Documentación
COMMENT ON FUNCTION public.transfer_student IS 
'Traslada un estudiante de un grupo a otro de forma atómica y segura.
Valida ownership del estudiante y grupo destino.
Registra auditoría en student_transfers.
Solo modifica students.group_id — no toca asistencia, notas ni cotidiano.';

-- ─────────────────────────────────────────
-- 4. VERIFICACIÓN
-- ─────────────────────────────────────────

SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'student_transfers'
ORDER BY ordinal_position;

SELECT '✅ Fase 21 completada — Tabla student_transfers y RPC transfer_student creados' AS status;
