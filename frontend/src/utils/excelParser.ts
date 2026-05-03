import * as XLSX from 'xlsx';

/**
 * Normaliza un string para comparaciones flexibles:
 * - Pasa a minúsculas
 * - Quita espacios extra
 * - Elimina acentos/tildes
 * - Elimina caracteres especiales (. , - _)
 */
export const normalizeHeader = (val: string): string => {
  return String(val || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quitar tildes
    .replace(/[.,\-_]/g, "")       // Quitar puntuación básica
    .replace(/\s+/g, "");          // Quitar todos los espacios para comparación densa
};

const COLUMN_MAPS = {
  name: ['nombre', 'nombrecompleto', 'estudiante', 'alumno', 'nombredelestudiante', 'nombreyformacion'],
  cedula: ['cedula', 'identificacion', 'identidad', 'numerodecedula', 'id'],
  phone1: ['telefono1', 'telefonoencargado1', 'encargado1', 'telefonomadre', 'telefonopadre', 'telcontacto1', 'contacto1', 'celular1'],
  phone2: ['telefono2', 'telefonoencargado2', 'encargado2', 'telefonomadre2', 'telefonopadre2', 'telcontacto2', 'contacto2', 'celular2'],
};

interface ResolvedHeaders {
  name: string | null;
  cedula: string | null;
  phone1: string | null;
  phone2: string | null;
  piadMode: boolean; // Si detectamos "Primer Apellido", es modo PIAD
}

/**
 * Identifica qué columnas del archivo corresponden a nuestros campos internos
 */
export const resolveStudentExcelColumns = (headers: string[]): ResolvedHeaders => {
  const resolved: ResolvedHeaders = {
    name: null,
    cedula: null,
    phone1: null,
    phone2: null,
    piadMode: false
  };

  const normalizedHeaders = headers.map(h => ({ original: h, normalized: normalizeHeader(h) }));

  // Detectar Modo PIAD (específico del MEP Costa Rica)
  resolved.piadMode = normalizedHeaders.some(h => h.normalized.includes('primerapellido'));

  // Emparejar columnas
  normalizedHeaders.forEach(h => {
    if (!resolved.name && COLUMN_MAPS.name.some(opt => h.normalized.includes(opt))) {
      resolved.name = h.original;
    }
    if (!resolved.cedula && COLUMN_MAPS.cedula.some(opt => h.normalized === opt || h.normalized.includes('cedula'))) {
      resolved.cedula = h.original;
    }
    if (!resolved.phone1 && COLUMN_MAPS.phone1.some(opt => h.normalized.includes(opt))) {
      resolved.phone1 = h.original;
    }
    if (!resolved.phone2 && h.original !== resolved.phone1 && COLUMN_MAPS.phone2.some(opt => h.normalized.includes(opt))) {
      resolved.phone2 = h.original;
    }
  });

  return resolved;
};

export interface ImportedStudent {
  name: string;
  first_name?: string | null;
  last_name1?: string | null;
  last_name2?: string | null;
  cedula: string | null;
  parent1_phone: string | null;
  parent2_phone: string | null;
  gender: string | null;
  mep_email: string | null;
}

/**
 * Función principal para parsear estudiantes desde un Workbook de Excel
 */
export const parseStudentsFromExcel = (workbook: XLSX.WorkBook): ImportedStudent[] => {
  let allStudents: ImportedStudent[] = [];
  let lastError = "";

  // Intentar en cada hoja hasta encontrar una con datos válidos
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];

    if (rawRows.length < 2) continue;

    // Buscar la fila de encabezados (la primera que tenga algo parecido a "Nombre" o "Cédula")
    const headerRowIndex = rawRows.findIndex(row => {
      const normalizedRow = row.map(cell => normalizeHeader(String(cell)));
      return (
        normalizedRow.some(h => COLUMN_MAPS.name.includes(h) || h.includes('nombre')) &&
        normalizedRow.some(h => COLUMN_MAPS.cedula.includes(h) || h.includes('cedula'))
      );
    });

    if (headerRowIndex === -1) {
      lastError = "No se pudieron identificar las columnas requeridas (Nombre y Cédula).";
      continue;
    }

    const headers = rawRows[headerRowIndex].map(h => String(h).trim());
    const mapping = resolveStudentExcelColumns(headers);

    // Validar columnas mínimas
    if (!mapping.name || !mapping.cedula) {
      const missing = [];
      if (!mapping.name) missing.push("Nombre");
      if (!mapping.cedula) missing.push("Cédula");
      lastError = `Faltan columnas obligatorias: ${missing.join(", ")}.`;
      continue;
    }

    // Parsear datos
    const dataRows = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex, defval: "" }) as any[];
    
    const students = dataRows.map(row => {
      let fullName = "";
      let first_name: string | null = null;
      let last_name1: string | null = null;
      let last_name2: string | null = null;
      
      if (mapping.piadMode) {
        // Lógica PIAD/MEP: extraer campos separados y construir nombre en formato MEP
        const n = String(row[mapping.name!] || "").trim();
        const a1 = String(row["Primer apellido"] || row["Primer Apellido"] || "").trim();
        const a2 = String(row["Segundo apellido"] || row["Segundo Apellido"] || "").trim();
        
        // Guardar campos separados
        first_name = n || null;
        last_name1 = a1 || null;
        last_name2 = a2 || null;
        
        // Formato MEP: Apellido1 Apellido2 Nombres
        fullName = [a1, a2, n].filter(Boolean).join(" ");
      } else {
        // Sin modo PIAD: columna única de nombre, no intentar dividir
        fullName = String(row[mapping.name!] || "").trim();
      }

      return {
        name: fullName,
        first_name,
        last_name1,
        last_name2,
        cedula: String(row[mapping.cedula!] || "").replace(/\s/g, "").trim() || null,
        parent1_phone: mapping.phone1 ? String(row[mapping.phone1] || "").trim() || null : null,
        parent2_phone: mapping.phone2 ? String(row[mapping.phone2] || "").trim() || null : null,
        gender: null,
        mep_email: null
      };
    }).filter(s => s.name && s.name.length > 2);

    if (students.length > 0) {
      return students;
    }
  }

  throw new Error(lastError || "El archivo está vacío o no tiene el formato correcto.");
};
