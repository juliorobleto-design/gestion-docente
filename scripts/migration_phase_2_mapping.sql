-- ==========================================
-- FASE 2: TABLA DE MAPEO Y PREPARACIÓN
-- PROYECTO: GESTIÓN DOCENTE
-- ==========================================

-- 1. Crear Tabla de Mapeo
-- ------------------------------------------

DROP TABLE IF EXISTS public.user_migration_map;

CREATE TABLE public.user_migration_map (
  old_user_id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT,
  name TEXT,
  new_auth_user_id UUID,
  migration_status TEXT DEFAULT 'pending', -- pending, mapped, active
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insertar Docentes Actuales
-- ------------------------------------------
-- NOTA: Como 'username' no es un email en la tabla actual,
-- usaremos el valor por defecto configurado en la app o el nombre de usuario
-- como email base para la invitación de Magic Link.

INSERT INTO public.user_migration_map (old_user_id, username, email)
SELECT 
  id, 
  username, 
  CASE 
    WHEN username = 'julio' THEN 'usuario@mep.go.cr' -- Email por defecto detectado
    ELSE username || '@temporal.mep.go.cr' -- Fallback para otros usuarios
  END as email
FROM public.users;

-- 3. Verificación de Mapeo Inicial
-- ------------------------------------------

SELECT 'REPORTE DE MAPEO INICIAL' as reporte;

SELECT 
  old_user_id, 
  username, 
  email, 
  migration_status 
FROM public.user_migration_map;

-- 4. Preparación de Ownership (Nuevas Columnas)
-- ------------------------------------------
-- Añadimos las columnas UUID a las tablas de negocio sin activar RLS aún.

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

SELECT 'FASE 2 COMPLETADA CON ÉXITO' as status;
