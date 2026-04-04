# Arquitectura Técnica: Gestión Docente

## 1. Propósito del Archivo
- Servir como la "fuente de la verdad" para estructurar de manera uniforme el código del proyecto.
- Asegurar que cualquier Agente (Builder, UI Guardian, Data Guardian) sepa exactamente dónde ubicar nuevos archivos, lógica de negocio o componentes visuales.

## 2. Principios de Arquitectura del Proyecto
- **Modularidad:** Separar cada funcionalidad principal en su propio directorio (Asistencia, Estudiantes, Horarios).
- **Separación de Responsabilidades:** La interfaz visual (componentes React) no debe mezclarse de forma directa con la lógica de la base de datos (Supabase).
- **Escalabilidad Sencilla:** Crear un sistema predecible donde añadir un nuevo módulo en el futuro sea tan fácil como replicar una estructura base aprobada.

## 3. Estructura de Carpetas Recomendada
Todo el código fuerte de la aplicación debe vivir dentro de `/src`:

```text
src/
├── components/   # UI compartida y reutilizable por todos los módulos (botones, modales)
├── lib/          # Configuración de herramientas externas (ej. cliente de Supabase)
├── modules/      # Lógica de negocio separada por dominios (Asistencia, Horarios)
├── types/        # Tipos e interfaces globales (TypeScript)
└── App.tsx       # Enrutador principal de la aplicación
```

## 4. Patrón para Módulos
Cada módulo debe ser autosuficiente y contener lo necesario para operar. Por ejemplo, dentro de `src/modules/asistencia/` existirá su propio mundo:
- `/components/`: Componentes visuales únicos de este módulo (ej. `TomarLista.tsx`).
- `/hooks/`: Toda la lógica, reglas y contacto con los datos (ej. `useAsistencia.ts`).
- `/pages/`: Las vistas de interfaz completas que se enlazan en la navegación (ej. `AsistenciaPage.tsx`).

## 5. Patrón para UI Compartida
- Todo lo que agreguemos en `src/components/ui/` debe ser "mudo" (dumb components).
- Es decir, un `BotonGenerico` o una `TarjetaBase` **jamás** deben hacer consultas a Supabase. Solo reciben datos e instrucciones por medio de sus propiedades (React props).

## 6. Patrón para Integración con Supabase
- **Cliente único:** Solo se crea una instancia de conexión en `src/lib/supabase/client.ts`.
- **Llamadas encapsuladas:** En lugar de hacer llamadas a las tablas directamente en la vista, se deben envolver en funciones o *Custom Hooks* orientadas a la acción. Así, una vista simplemente manda a llamar `guardarAsistencia(datos)` sin preocuparse de en cuántas tablas se inserte.
- **Seguridad:** Todas las operaciones deben respetar las políticas de Row Level Security (RLS) definidas en Supabase.

## 7. Manejo de Tipos en TypeScript
- **Tipos Globales:** Si un tipo se usa en varios lugares de la plataforma (ej. un `Docente` base o la respuesta genérica de Supabase), deberá guardarse en `src/types/`.
- **Tipos Locales:** Si un tipo solo le interesa a un módulo (ej. una tabla de presentación para listar asistencia), se quedará dentro de sus archivos en `src/modules/asistencia/`.
- **Sincronización:** En el futuro procuraremos que los tipos fundamentales se traigan directamente del esquema SQL de Supabase para evitar errores humanos.

## 8. Reglas para Crecimiento Futuro
- Si un componente que nació en un módulo (ej. un selector calendario de `Horarios`) de pronto se necesita en `Asistencia`, primero se "promueve" (se mueve) a `src/components/ui/` para compartirse libremente.
- Los módulos deben estar desacoplados. Si un módulo necesita saber de otro constantemente, probablemente estemos ante lógica que debería extraerse a un nivel superior, en lugar de importar vistas entre dominios.
