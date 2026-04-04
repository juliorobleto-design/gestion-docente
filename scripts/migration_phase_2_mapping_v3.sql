-- ==========================================
-- FASE 2: TABLA DE MAPEO EXPANDIDA
-- PROYECTO: GESTIÓN DOCENTE
-- ==========================================

-- 1. Crear Tabla de Mapeo (Estructura Final Solicitada)
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_migration_map (
  old_user_id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  email_real TEXT NOT NULL,
  display_name TEXT,
  new_auth_user_id UUID,
  migration_status TEXT DEFAULT 'pending', -- pending, sent, active, completed
  magic_link_sent_at TIMESTAMPTZ,
  first_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_old_user FOREIGN KEY (old_user_id) REFERENCES public.users(id)
);

-- 2. Insertar Docente Principal (JULIO)
-- ------------------------------------------
-- Mapear julio (ID 1) con su correo real confirmado.

INSERT INTO public.user_migration_map (old_user_id, username, email_real, display_name)
VALUES (1, 'julio', 'marketingiacr@gmail.com', 'Julio')
ON CONFLICT (old_user_id) DO UPDATE SET 
  email_real = EXCLUDED.email_real,
  display_name = EXCLUDED.display_name,
  migration_status = 'pending';

-- 3. Verificación de Mapeo
-- ------------------------------------------

SELECT 'ESTADO DE MAPEO PARA MIGRACIÓN' as reporte;

SELECT 
  old_user_id, 
  username, 
  email_real, 
  migration_status, 
  created_at 
FROM public.user_migration_map;

-- 4. Preparación de Ownership (Nuevas Columnas)
-- ------------------------------------------
-- Añadimos la columna UUID 'owner_id' a las tablas de negocio.
-- NOTA: Se usará UUID v4 para las políticas RLS.

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.attendance_lessons ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.anecdotal_records ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.daily_work_scores ADD COLUMN IF NOT EXISTS owner_id UUID;

SELECT 'FASE 2: MAPEO PREPARADO CON ÉXITO' as status;
