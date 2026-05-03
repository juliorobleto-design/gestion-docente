/**
 * studentName.ts — Utilidad central para manejo de nombres de estudiantes
 * 
 * Formato MEP: Apellido1 Apellido2 Nombres
 * 
 * Reglas de limpieza:
 *  - Evita undefined y null
 *  - Elimina espacios dobles
 *  - Tolera campos vacíos
 *  - Usa "name" como respaldo si los nuevos campos no existen
 *  - No muta objetos originales
 */

/**
 * Tipo mínimo que acepta cualquier objeto con los campos relevantes.
 * Todos los campos son opcionales para máxima compatibilidad.
 */
interface StudentNameFields {
  name?: string | null;
  first_name?: string | null;
  last_name1?: string | null;
  last_name2?: string | null;
}

/**
 * Limpia un string: quita nulls, undefineds y espacios dobles.
 */
function clean(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

/**
 * Determina si el estudiante tiene los campos MEP poblados.
 * Se requiere al menos last_name1 O first_name para considerar
 * que los campos MEP están disponibles.
 */
function hasMepFields(student: StudentNameFields): boolean {
  return !!(clean(student.last_name1) || clean(student.first_name));
}

/**
 * Construye el nombre para mostrar en formato MEP:
 *   "Apellido1 Apellido2 Nombres"
 * 
 * Si los campos MEP no existen (estudiante antiguo), retorna student.name.
 * Nunca retorna undefined ni null.
 * 
 * @example
 *   // Estudiante nuevo con campos separados:
 *   buildStudentDisplayName({ last_name1: "Pérez", last_name2: "Mora", first_name: "Juan Carlos" })
 *   // → "Pérez Mora Juan Carlos"
 * 
 *   // Estudiante antiguo con solo name:
 *   buildStudentDisplayName({ name: "Juan Carlos Pérez Mora" })
 *   // → "Juan Carlos Pérez Mora"
 * 
 *   // Estudiante sin datos:
 *   buildStudentDisplayName({})
 *   // → ""
 */
export function buildStudentDisplayName(student: StudentNameFields): string {
  if (hasMepFields(student)) {
    const parts = [
      clean(student.last_name1),
      clean(student.last_name2),
      clean(student.first_name),
    ].filter(Boolean);
    return parts.join(" ");
  }

  // Fallback: usar campo name legado
  return clean(student.name);
}

/**
 * Construye el valor para guardar en el campo "name" (compatibilidad legado).
 * Formato: "Apellido1 Apellido2 Nombres"
 * 
 * Se usa al crear o actualizar un estudiante para mantener el campo name
 * sincronizado con los campos separados.
 * 
 * Si los campos MEP están vacíos, retorna string vacío.
 * 
 * @example
 *   buildLegacyStudentName({ last_name1: "Pérez", last_name2: "Mora", first_name: "Juan Carlos" })
 *   // → "Pérez Mora Juan Carlos"
 */
export function buildLegacyStudentName(student: StudentNameFields): string {
  const parts = [
    clean(student.last_name1),
    clean(student.last_name2),
    clean(student.first_name),
  ].filter(Boolean);
  return parts.join(" ");
}

/**
 * Comparador para ordenar estudiantes en formato MEP.
 * Ordena por: last_name1 → last_name2 → first_name
 * 
 * Si los campos MEP no existen, usa "name" como fallback.
 * Compatible con Array.sort().
 * 
 * Usa locale "es" para ordenamiento correcto de caracteres españoles
 * (tildes, eñes, etc.)
 * 
 * @example
 *   students.sort(compareStudentsMEP)
 */
export function compareStudentsMEP(a: StudentNameFields, b: StudentNameFields): number {
  // Construir claves de comparación completas
  const keyA = buildSortKey(a);
  const keyB = buildSortKey(b);

  return keyA.localeCompare(keyB, "es", { sensitivity: "base" });
}

/**
 * Construye una clave de ordenamiento estable.
 * Si los campos MEP existen: "apellido1|apellido2|nombres"
 * Si no: usa el campo name como clave única.
 * 
 * Esto garantiza que estudiantes antiguos (solo name) se ordenen
 * de forma coherente sin quedar al inicio o al final por valores NULL.
 */
function buildSortKey(student: StudentNameFields): string {
  if (hasMepFields(student)) {
    return [
      clean(student.last_name1).toLowerCase(),
      clean(student.last_name2).toLowerCase(),
      clean(student.first_name).toLowerCase(),
    ].join("|");
  }

  // Fallback: usar name como clave de ordenamiento
  return clean(student.name).toLowerCase();
}
