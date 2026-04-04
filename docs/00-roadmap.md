# Gestión Docente — Roadmap del Proyecto

## Objetivo del sistema

Crear una plataforma web para docentes que permita gestionar grupos, estudiantes, asistencia, notas, observaciones y reportes académicos de forma simple, rápida y organizada.

El sistema debe escalar para más de:

* 1000 docentes
* 25,000 estudiantes

---

# Arquitectura general

## Frontend

Tecnologías:

* React
* TypeScript
* Vite

Responsabilidades:

* Interfaz de usuario
* Gestión de estados
* Comunicación con API
* Renderizado de módulos

---

## Backend

Tecnologías:

* Node.js
* Express

Responsabilidades:

* API REST
* Autenticación
* Lógica del sistema
* Acceso a base de datos

---

## Base de datos

Diseñada para manejar:

* docentes
* grupos
* estudiantes
* asistencia
* notas
* observaciones
* reportes

Los datos estarán organizados por:

* año lectivo
* semestre
* grupo
* docente

---

# Módulos del sistema

## Módulo 1 — Grupos

Permite:

* crear grupos
* editar grupos
* eliminar grupos
* ordenar grupos
* filtrar por docente

---

## Módulo 2 — Estudiantes

Permite:

* agregar estudiantes a un grupo
* editar estudiantes
* eliminar estudiantes
* gestionar matrícula

---

## Módulo 3 — Asistencia

Permite:

* registrar asistencia diaria
* estados de asistencia
* observaciones
* estadísticas de asistencia

---

## Módulo 4 — Cotidiano

Registro de desempeño cotidiano del estudiante.

---

## Módulo 5 — Notas

Gestión de evaluaciones y calificaciones.

---

## Módulo 6 — Anecdótico

Registro de observaciones pedagógicas del estudiante.

---

## Módulo 7 — Asistente IA

Asistencia para:

* redacción de observaciones
* sugerencias pedagógicas
* análisis de rendimiento

---

## Módulo 8 — Reportes

Generación de:

* reportes por grupo
* reportes por estudiante
* estadísticas académicas

---

# Contexto académico

El sistema debe manejar:

* Año lectivo
* Semestre 1
* Semestre 2

Luego se integran ambos semestres para generar:

* resultados finales
* estadísticas anuales
* reportes finales

---

# Escalabilidad

El sistema debe soportar:

* más de 1000 docentes
* más de 25,000 estudiantes
* múltiples grupos por docente

---

# Principios de desarrollo

* Arquitectura modular
* Código limpio
* Escalabilidad
* Interfaz simple para docentes
* Alto rendimiento
