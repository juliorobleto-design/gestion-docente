-- ==========================================
-- AUDITORÍA DE SEGURIDAD: VERIFICACIÓN RLS
-- Ejecutar en el SQL Editor de Supabase
-- Copiar, pegar y ejecutar
-- ==========================================

-- 1. VERIFICAR QUÉ TABLAS TIENEN RLS ACTIVADO
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'bak_%'
ORDER BY tablename;

-- 2. VERIFICAR POLÍTICAS EXISTENTES POR TABLA
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual::text AS using_condition,
  with_check::text AS check_condition
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. LISTA DE TABLAS SIN POLÍTICAS (PELIGRO SI RLS ESTÁ ACTIVO)
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.tablename NOT LIKE 'bak_%'
  AND p.policyname IS NULL
  AND t.rowsecurity = true
ORDER BY t.tablename;

-- Si esta última consulta devuelve tablas, esas tablas están 
-- BLOQUEADAS completamente (RLS activo pero sin políticas = nadie puede acceder).
-- Esto podría causar errores silenciosos en el frontend.

SELECT '✅ AUDITORÍA COMPLETADA — Revise los resultados arriba' as status;
