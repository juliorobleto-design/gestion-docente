import { supabase } from '../supabaseClient';
import { buildStudentDisplayName, compareStudentsMEP } from './studentName';

interface Student {
  id: number;
  name: string;
  first_name?: string | null;
  last_name1?: string | null;
  last_name2?: string | null;
  group_id: number;
  cedula?: string;
}

function rubricToColumn(name: string): string | null {
  const n = name.toUpperCase().trim();
  if (n.includes("TAREA") || n.includes("PROYECTO")) return "projects";
  if (n.includes("PRUEBA 2") || n === "PRUEBA2") return "test2";
  if (n.includes("PRUEBA 1") || n === "PRUEBA1" || n.includes("PRUEBA")) return "test1";
  if (n.includes("PORTAFOLIO") || n.includes("PORTFOLIO")) return "portfolio";
  if (n.includes("DEMOSTRACI") || n.includes("DEMONSTR")) return "demonstration";
  if (n.includes("SUMATIVO") || n.includes("INSTRUMENTO")) return "sumative_instrument";
  return null;
}

export async function exportToSEACSV(
  groupId: number,
  groupName: string,
  academicPeriod: 'semester1' | 'semester2' | 'annual',
  allStudents: Student[],
  evaluationRubrics: { id: string; name: string; percentage: number }[] = []
): Promise<{ success: boolean; message: string }> {
  try {
    const studentsInGroup = allStudents
      .filter(s => s.group_id === groupId)
      .sort(compareStudentsMEP);

    if (studentsInGroup.length === 0) {
      return { success: false, message: "No hay estudiantes registrados en este grupo." };
    }

    const studentIds = studentsInGroup.map(s => s.id);
    const periodToLoad = academicPeriod === 'annual' ? 'semester1' : academicPeriod;

    // Determinar peso de Asistencia configurado en rúbricas (por defecto 5%)
    const attRubric = evaluationRubrics.find(r => r.name && r.name.toUpperCase().trim().includes("ASISTENCIA"));
    const attWeight = attRubric ? (Number(attRubric.percentage) || 5) : 5;

    // 1. Obtener asistencia de la base de datos
    const { data: attData, error: attError } = await supabase
      .from("attendance_lessons")
      .select("student_id, status")
      .in("student_id", studentIds)
      .eq("period", periodToLoad);

    if (attError) throw attError;

    // Calcular porcentajes de asistencia
    const attCounts: Record<number, { total: number; present: number }> = {};
    studentIds.forEach(id => { attCounts[id] = { total: 0, present: 0 }; });
    (attData || []).forEach(row => {
      const sid = row.student_id;
      if (!attCounts[sid]) attCounts[sid] = { total: 0, present: 0 };
      attCounts[sid].total += 1;
      const st = String(row.status).toUpperCase();
      if (st === "P" || st === "PRESENTE") {
        attCounts[sid].present += 1;
      } else if (st === "T" || st.includes("TARD")) {
        attCounts[sid].present += 0.5;
      }
    });

    const attPoints: Record<number, number> = {};
    studentIds.forEach(id => {
      const a = attCounts[id];
      attPoints[id] = a && a.total > 0 ? Math.round((a.present / a.total) * attWeight * 10) / 10 : 0;
    });

    // 2. Obtener trabajo cotidiano de la base de datos
    const { data: cwScores, error: cwError } = await supabase
      .from("daily_work_scores")
      .select("student_id, score, total_points")
      .in("student_id", studentIds)
      .eq("period", periodToLoad);

    if (cwError) throw cwError;

    const cotPoints: Record<number, number> = {};
    studentIds.forEach(id => { cotPoints[id] = 0; });
    (cwScores || []).forEach(d => {
      if (d.score != null) {
        cotPoints[d.student_id] = Math.round(d.score * 10) / 10;
      }
    });

    // 3. Obtener notas de la tabla grades
    const { data: gradesData, error: gradesError } = await supabase
      .from("grades")
      .select("*")
      .in("student_id", studentIds)
      .eq("period", periodToLoad);

    if (gradesError) throw gradesError;

    const gradesMap: Record<number, { projects: number; test: number }> = {};
    studentIds.forEach(id => { gradesMap[id] = { projects: 0, test: 0 }; });
    
    const activeRubrics = evaluationRubrics.filter(r => r.name && r.name.trim() !== "");

    (gradesData || []).forEach(row => {
      const sid = row.student_id;
      let projectsTotal = 0;
      let testTotal = 0;
      let matchedAny = false;

      activeRubrics.forEach(rubric => {
        const nameUp = rubric.name.toUpperCase().trim();
        if (nameUp.includes("ASISTENCIA") || nameUp.includes("COTIDIANO")) {
          return; // Saltamos las rúbricas automáticas
        }

        const colName = rubricToColumn(rubric.name);
        if (colName && row[colName] != null && row[colName] !== undefined) {
          matchedAny = true;
          const rawScore = Number(row[colName]); // Nota de 0 a 100 en BD
          const weight = Number(rubric.percentage) || 0;
          
          // Calculamos los puntos ganados y redondeamos a 1 decimal como en el reporte visual del PDF
          const points = Number(((rawScore * weight) / 100).toFixed(1));

          if (
            nameUp.includes("PRUEBA") ||
            nameUp.includes("EXAMEN") ||
            nameUp.includes("SUMATIVO") ||
            colName === "test1" ||
            colName === "test2" ||
            colName === "sumative_instrument"
          ) {
            testTotal += points;
          } else {
            // Tareas, Proyectos, Portafolio, etc.
            projectsTotal += points;
          }
        }
      });

      // Si no se pasaron rúbricas o no coincidió ninguna (fallback de seguridad)
      if (!matchedAny && activeRubrics.length === 0) {
        const pScore = row.projects != null ? Number(((Number(row.projects) * 10) / 100).toFixed(1)) : 0;
        const t1Score = row.test1 != null ? Number(((Number(row.test1) * 35) / 100).toFixed(1)) : 0;
        const t2Score = row.test2 != null ? Number(((Number(row.test2) * 15) / 100).toFixed(1)) : 0;
        projectsTotal = pScore;
        testTotal = t1Score + t2Score;
      }

      gradesMap[sid] = {
        projects: Number(projectsTotal.toFixed(1)),
        test: Number(testTotal.toFixed(1))
      };
    });

    // 4. Generar líneas de CSV
    // Encabezado: Id;Nombre;Trabajo cotidiano;Tareas;Prueba;Asistencia
    const csvLines = ["Id;Nombre;Trabajo cotidiano;Tareas;Prueba;Asistencia"];

    studentsInGroup.forEach(student => {
      // Limpiar cédula (eliminar guiones y espacios)
      const rawCedula = student.cedula || "";
      const cleanCedula = rawCedula.replace(/[-\s]/g, "");

      const displayName = buildStudentDisplayName(student).toUpperCase();
      const cotidiano = cotPoints[student.id] || 0;
      const tareas = gradesMap[student.id]?.projects || 0;
      const prueba = gradesMap[student.id]?.test || 0;
      const asistencia = attPoints[student.id] || 0;

      csvLines.push(`${cleanCedula};${displayName};${cotidiano};${tareas};${prueba};${asistencia}`);
    });

    // Crear el string CSV
    const csvString = csvLines.join("\r\n");

    // Descarga del archivo en el navegador
    // Prepend UTF-8 BOM to ensure Excel displays accents correctly
    const blob = new Blob(["\uFEFF" + csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    
    // Normalizar nombre de archivo
    const safeGroupName = groupName.replace(/[^a-zA-Z0-9]/g, "_");
    const periodName = academicPeriod === 'semester1' ? 'Semestre_I' : academicPeriod === 'semester2' ? 'Semestre_II' : 'Anual';
    downloadLink.download = `SEA_${safeGroupName}_${periodName}.csv`;
    downloadLink.style.display = "none";
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    setTimeout(() => {
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    }, 200);

    return { success: true, message: "Archivo CSV exportado correctamente." };
  } catch (error: any) {
    console.error("Error al exportar al formato SEA:", error);
    return { success: false, message: error.message || "Error al exportar los datos." };
  }
}
