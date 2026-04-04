# Gestión Docente — Diseño Base de Datos

## Objetivo
Diseñar una base de datos escalable para soportar:

- más de 1000 docentes
- más de 25,000 estudiantes
- 2 semestres por año
- reportes anuales
- estadísticas por grupo, estudiante y docente

---

# Principios de diseño

- Un solo sistema, no duplicado por semestre
- Todos los registros deben guardar contexto académico
- Diseño modular
- Preparado para escalar
- Consultas optimizadas por docente, grupo, año y semestre

---

# Contexto académico

## academic_years
Representa el año lectivo.

Campos sugeridos:

- id
- name
- start_date
- end_date
- is_active

Ejemplo:
- 2026

---

## terms
Representa los semestres del año lectivo.

Campos sugeridos:

- id
- academic_year_id
- name
- order_index
- start_date
- end_date
- is_active

Ejemplos:
- Semestre 1
- Semestre 2

---

# Núcleo institucional

## teachers
Información de docentes.

Campos sugeridos:

- id
- full_name
- email
- auth_provider_id
- institution_name
- created_at
- updated_at
- is_active

Índices recomendados:

- email
- auth_provider_id

---

## students
Información general de estudiantes.

Campos sugeridos:

- id
- first_name
- last_name
- student_code
- birth_date
- gender
- created_at
- updated_at
- is_active

Índices recomendados:

- student_code
- last_name
- first_name

---

## groups
Grupos creados por cada docente.

Campos sugeridos:

- id
- teacher_id
- academic_year_id
- term_id
- name
- subject_name
- grade_level
- section
- created_at
- updated_at
- is_active

Notas:

- cada grupo pertenece a un docente
- cada grupo pertenece a un año lectivo
- cada grupo pertenece a un semestre
- el nombre inicial del grupo será "Nuevo grupo"

Índices recomendados:

- teacher_id
- academic_year_id
- term_id
- teacher_id + academic_year_id + term_id
- teacher_id + name

---

## student_group_enrollments
Relación entre estudiantes y grupos.

Campos sugeridos:

- id
- student_id
- group_id
- academic_year_id
- term_id
- enrolled_at
- is_active

Notas:

- permite que un estudiante pertenezca a un grupo en un semestre específico
- facilita mover o reubicar estudiantes sin perder historial

Índices recomendados:

- student_id
- group_id
- academic_year_id
- term_id
- student_id + academic_year_id + term_id
- group_id + academic_year_id + term_id

---

# Módulo de asistencia

## attendance_records
Registro diario de asistencia.

Campos sugeridos:

- id
- student_id
- group_id
- teacher_id
- academic_year_id
- term_id
- attendance_date
- status
- note
- created_at
- updated_at

Valores posibles de status:

- presente
- ausente
- tardía
- justificada

Índices recomendados:

- group_id + attendance_date
- student_id + attendance_date
- teacher_id + attendance_date
- academic_year_id + term_id
- group_id + academic_year_id + term_id

---

# Módulo de notas

## grade_records
Notas y evaluaciones.

Campos sugeridos:

- id
- student_id
- group_id
- teacher_id
- academic_year_id
- term_id
- evaluation_name
- evaluation_type
- score
- percentage
- max_score
- notes
- recorded_at
- updated_at

Índices recomendados:

- student_id
- group_id
- teacher_id
- academic_year_id
- term_id
- student_id + academic_year_id + term_id
- group_id + academic_year_id + term_id

---

# Módulo anecdótico

## anecdotal_records
Observaciones pedagógicas o disciplinarias.

Campos sugeridos:

- id
- student_id
- group_id
- teacher_id
- academic_year_id
- term_id
- title
- description
- category
- incident_date
- created_at
- updated_at

Índices recomendados:

- student_id
- group_id
- teacher_id
- incident_date
- academic_year_id + term_id

---

# Módulo cotidiano

## daily_performance_records
Registro de desempeño cotidiano.

Campos sugeridos:

- id
- student_id
- group_id
- teacher_id
- academic_year_id
- term_id
- record_date
- score
- observation
- created_at
- updated_at

Índices recomendados:

- student_id
- group_id
- record_date
- academic_year_id + term_id

---

# Consolidación anual

## annual_student_summaries
Resumen anual consolidado.

Campos sugeridos:

- id
- student_id
- group_id
- academic_year_id
- final_score
- term_1_score
- term_2_score
- attendance_percentage
- observations_summary
- generated_at

Notas:

- esta tabla puede ser calculada automáticamente
- sirve para reportes rápidos y estadísticas

Índices recomendados:

- student_id
- group_id
- academic_year_id
- student_id + academic_year_id

---

# Consideraciones de escalabilidad

## Reglas importantes
- Nunca consultar todos los estudiantes al mismo tiempo si no hace falta
- Filtrar siempre por docente, grupo, año y semestre
- Evitar cálculos pesados en frontend
- Crear resúmenes anuales para acelerar reportes
- Usar índices desde el inicio

## Escala esperada
- 1000+ docentes
- 25,000+ estudiantes
- decenas de miles de asistencias por semestre
- decenas de miles de notas por semestre

---

# Decisión arquitectónica importante

El sistema NO se duplicará por semestre.

En su lugar:

- habrá un solo sistema
- cada registro llevará:
  - academic_year_id
  - term_id

Luego se construirá una capa de consolidación anual para unir ambos semestres.

---

# Próximos pasos

1. Validar este modelo general
2. Definir motor de base de datos
3. Diseñar relaciones exactas
4. Crear esquema inicial real
5. Construir CRUD de grupos