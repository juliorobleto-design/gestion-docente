-- ==========================================
-- MIGRACIÓN FASE 12: PARCHE DE SEGURIDAD CRÍTICO (RLS)
-- OBJETIVO: Cerrar las vulnerabilidades reportadas por Supabase
-- ==========================================

-- 1. ACTIVACIÓN ESTRICTA DEL CANDADO RLS EN TODAS LAS TABLAS DEL SISTEMA
-- Esto bloquea por completo la lectura o escritura anónima a la base de datos a nivel público.
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anecdotal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_work_scores ENABLE ROW LEVEL SECURITY;

-- Nota Interna: La tabla 'authorized_users' ya tenía este candado desde la Fase 10,
-- por lo que el sistema entero de "Gestión Docente" queda 100% clausurado al acceso 
-- público no autorizado, rigiéndose ahora estrictamente por las Políticas establecidas de "Dueños (owners_id)".

SELECT 'FASE 12: PARCHE RLS ACTIVADO EXITOSAMENTE. Vulnerabilidades selladas.' as status;
