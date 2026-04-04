-- ==========================================
-- PHASE 8: ACADEMIC PERIODS (S1 / S2)
-- ==========================================

-- 1. Añadir columna period a las tablas académicas críticas
-- Usamos 'semester1' por defecto para no romper datos existentes.

ALTER TABLE attendance_lessons 
ADD COLUMN IF NOT EXISTS period VARCHAR(20) DEFAULT 'semester1' 
CHECK (period IN ('semester1', 'semester2'));

ALTER TABLE grades 
ADD COLUMN IF NOT EXISTS period VARCHAR(20) DEFAULT 'semester1' 
CHECK (period IN ('semester1', 'semester2'));

ALTER TABLE daily_work_scores 
ADD COLUMN IF NOT EXISTS period VARCHAR(20) DEFAULT 'semester1' 
CHECK (period IN ('semester1', 'semester2'));

ALTER TABLE anecdotal_records 
ADD COLUMN IF NOT EXISTS period VARCHAR(20) DEFAULT 'semester1' 
CHECK (period IN ('semester1', 'semester2'));

-- 2. Asegurar que los registros actuales tengan 'semester1'
UPDATE attendance_lessons SET period = 'semester1' WHERE period IS NULL;
UPDATE grades SET period = 'semester1' WHERE period IS NULL;
UPDATE daily_work_scores SET period = 'semester1' WHERE period IS NULL;
UPDATE anecdotal_records SET period = 'semester1' WHERE period IS NULL;

-- 3. Comentario de documentación
COMMENT ON COLUMN attendance_lessons.period IS 'Periodo académico: semester1 o semester2';
COMMENT ON COLUMN grades.period IS 'Periodo académico: semester1 o semester2';
COMMENT ON COLUMN daily_work_scores.period IS 'Periodo académico: semester1 o semester2';
COMMENT ON COLUMN anecdotal_records.period IS 'Periodo académico: semester1 o semester2';
