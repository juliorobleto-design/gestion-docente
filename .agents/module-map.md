# Mapa de Módulos: Gestión Docente

## 1. Propósito del Documento
- Servir como un "mapa del tesoro" para que cualquier agente y desarrollador sepa exactamente **qué módulos existen**, **dónde viven** y **con qué bases de datos operan**.
- Evitar solapamientos de funciones (ej. no crear lógica de administración de estudiantes en una vista que le pertenece a Horarios).

## 2. Lista de Módulos Actuales
La aplicación está orientada a la autonomía del docente y se compone de 3 áreas primarias:
1. **Asistencia**
2. **Estudiantes**
3. **Horario**

## 3. Rutas y Responsabilidades
| Módulo | Ruta URL (React Router) | Ubicación (Código) | Responsabilidad Principal |
| :- | :- | :- | :- |
| **Asistencia** | `/asistencia` | `src/modules/asistencia` | Registrar, editar y visualizar el control de faltas/presencias diario o por clase. |
| **Estudiantes** | `/estudiantes` | `src/modules/estudiantes` | ABM (Alta, Baja y Modificación) del alumno: datos personales, contacto, notas u observaciones libres. |
| **Horario** | `/horario` | `src/modules/horario` | Visualizar la agenda semanal del docente, cruzar clases programadas y configurar asignaturas o paralelos. |

## 4. Tablas en Supabase Relacionadas
Cada módulo administra una porción diferente de la base de datos relacional. *(Añadiremos/corregiremos los nombres precisos de las tablas según se creen).*
- **Todas las tablas deben incluir referencia a `user_id` para aislar la información por docente.**
- **Módulo Asistencia:**
  - `attendance` (Escritura/Lectura de registros)
  - `students` (Solo letura: necesito la lista para saber a quién llamar)
  - `schedules` (Solo lectura: necesito saber la asignatura o el bloque de tiempo)
- **Módulo Estudiantes:**
  - `students` (Escritura/Lectura del perfil completo)
  - `guardians` / `contacts` (si existiese tabla para contactos de tutores)
- **Módulo Horario:**
  - `schedules` / `classes` (Gestión de los bloques de tiempo en el calendario)
  - `subjects` (Gestión de la materia dictada)

## 5. Relaciones / Cruces entre Módulos
Los módulos tienen dependencia conceptual, por lo cual debemos cuidar cómo se comunican:
- **Asistencia necesita de Estudiantes y Horarios:** Para registrar "Asistencia", primero debe existir el grupo de "Estudiantes" y un bloque de trabajo en el "Horario".
- **Regla Estricta:** Esta relación será 100% manejada a nivel de tabla en Supabase (Foreign Keys) en lugar de intentar sincronizar estados gigantescos de React entre diferentes páginas.

## 6. Posibles Puntos de Crecimiento Futuro
Este mapa sentará las bases para que en el futuro el Planner y el Builder agreguen fácilmente estos nuevos dominios de negocio:
- **Calificaciones (Grades):** Módulo para gestionar el rendimiento académico (`/calificaciones`).
- **Comunicaciones:** Para envío rápido de avisos por correo o en plataforma a los estudiantes/padres (`/mensajes`).
- **Reportes y Estadísticas:** Un dashboard global que cruce Asistencia, Notas y Faltas en gráficas y exportables (`/reportes`).
