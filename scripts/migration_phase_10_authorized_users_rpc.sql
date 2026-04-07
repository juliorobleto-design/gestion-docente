-- MIGRACIÓN FASE 10: CONTROL DE ACCESO (LISTA BLANCA)
-- OBJETIVO: Restringir el acceso solo a correos autorizados antes del Magic Link.

-- 1. Crear tabla de usuarios autorizados
create table if not exists authorized_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Índice único para evitar duplicados y acelerar búsquedas
create unique index if not exists idx_authorized_email
on authorized_users (email_normalized);

-- 3. Trigger para updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_updated_at on authorized_users;

create trigger trg_set_updated_at
before update on authorized_users
for each row
execute function set_updated_at();

-- 4. Activar RLS (Sin lectura pública)
alter table authorized_users enable row level security;
-- No se crean políticas SELECT públicas para proteger la lista de correos.

-- 5. Función RPC de validación (SECURITY DEFINER permite saltar RLS internamente)
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

  -- Normalización (Trim + Lowercase)
  normalized := lower(trim(input_email));

  -- Verificación en la tabla
  select exists (
    select 1
    from authorized_users
    where email_normalized = normalized
      and is_active = true
  )
  into exists_user;

  return exists_user;
end;
$$;

-- 6. Insertar usuarios beta autorizados (Lista depurada y corregida)
-- Se eliminan correos institucionales según requerimiento.
insert into authorized_users (email, email_normalized, notes)
values
('julio.robleto@gmail.com', 'julio.robleto@gmail.com', 'Administrador principal'),
('monetizamundolocura@gmail.com', 'monetizamundolocura@gmail.com', 'Usuario beta premium'),
('virpc33@yahoo.es', 'virpc33@yahoo.es', 'Docente beta'),
('ialejandragomez@gmail.com', 'ialejandragomez@gmail.com', 'Docente beta'),
('ricardicohdz@gmail.com', 'ricardicohdz@gmail.com', 'Docente beta'),
('chumi2628@yahoo.es', 'chumi2628@yahoo.es', 'Docente beta'),
('ma_ramirezr@hotmail.com', 'ma_ramirezr@hotmail.com', 'Docente beta'),
('rvenegasmata@gmail.com', 'rvenegasmata@gmail.com', 'Docente beta'),
('reinagarciabriones@gmail.com', 'reinagarciabriones@gmail.com', 'Docente beta')
on conflict (email_normalized) do nothing;
