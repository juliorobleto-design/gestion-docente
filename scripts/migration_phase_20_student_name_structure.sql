-- ==========================================
-- MIGRATION PHASE 20: STUDENT NAME STRUCTURE (MEP)
-- Agrega campos separados para nombres y apellidos
-- alineados al formato del MEP:
--   Apellido 1 > Apellido 2 > Nombres
--
-- PRINCIPIO DE SEGURIDAD:
--   - NO elimina el campo "name"
--   - NO modifica datos existentes
--   - Solo agrega 3 columnas nullable
--
-- Ejecutar en el SQL Editor de Supabase
-- ==========================================

-- 1. Agregar columnas nuevas (nullable, sin default)
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name1 text,
  ADD COLUMN IF NOT EXISTS last_name2 text;

-- 2. Comentarios documentales para claridad en la BD
COMMENT ON COLUMN students.first_name IS 'Nombres del estudiante (ej: Juan Carlos). Formato MEP.';
COMMENT ON COLUMN students.last_name1 IS 'Primer apellido del estudiante (ej: Pérez). Formato MEP.';
COMMENT ON COLUMN students.last_name2 IS 'Segundo apellido del estudiante (ej: Mora). Formato MEP.';
COMMENT ON COLUMN students.name IS 'Nombre completo legado. Se mantiene por compatibilidad. En nuevos registros se auto-genera como: Apellido1 Apellido2 Nombres.';

-- 3. Verificación
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'students'
  AND column_name IN ('name', 'first_name', 'last_name1', 'last_name2')
ORDER BY ordinal_position;

SELECT '✅ Fase 20 completada — Campos first_name, last_name1, last_name2 agregados a students' AS status;
