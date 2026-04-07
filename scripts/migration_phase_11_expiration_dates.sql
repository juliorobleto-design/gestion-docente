-- MIGRACIÓN FASE 11: ACCESOS TEMPORALES (VENCIMIENTOS)
-- OBJETIVO: Permitir que ciertos usuarios tengan un límite de tiempo para acceder a la plataforma.

-- 1. Añadir columna opcional de fecha de vencimiento
alter table authorized_users 
add column if not exists expires_at timestamptz;

-- 2. Actualizar la función de validación (RPC)
-- Incluye la comprobación de la fecha: 
-- SI expires_at es NULL (Ilimitado) O SI expires_at es mayor que ahora (Vigente).
create or replace function is_email_authorized(input_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  exists_user boolean;
begin
  -- Validación básica
  if input_email is null or length(trim(input_email)) = 0 then
    return false;
  end if;

  -- Normalización
  normalized := lower(trim(input_email));

  -- Verificación en la tabla (Solo autoriza si está activo y no ha vencido)
  select exists (
    select 1
    from authorized_users
    where email_normalized = normalized
      and is_active = true
      and (expires_at is null or expires_at > now())
  )
  into exists_user;

  return exists_user;
end;
$$;

-- Nota: Si el usuario ya existe y deseas ponerle vencimiento, simplemente edita la columna expires_at en el Table Editor de Supabase.
