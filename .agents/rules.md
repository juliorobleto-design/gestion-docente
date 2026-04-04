# Reglas de Código y Arquitectura

**1. TypeScript Estricto:**
- Evitar siempre el uso de `any`. Usar interfaces o types adecuadamente.
- Tipar todos los props de los componentes de React.

**2. React y Componentes:**
- Usar Functional Components y Hooks.
- Mantener los componentes pequeños y enfocados en una sola responsabilidad.

**3. Supabase:**
- Centralizar las consultas a la base de datos (no escribir código de Supabase directamente dentro de componentes visuales si es posible).
- Manejar adecuadamente los estados de carga y errores provenientes del backend.

**4. Limpieza:**
- Eliminar los `console.log` antes de dar una tarea por terminada.
- No dejar estilos huérfanos ni variables sin uso.
