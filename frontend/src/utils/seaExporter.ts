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

export async function exportToSEACSV(
  groupId: number,
  groupName: string,
  academicPeriod: 'semester1' | 'semester2' | 'annual',
  allStudents: Student[]
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

    const attPct: Record<number, number> = {};
    studentIds.forEach(id => {
      const a = attCounts[id];
      attPct[id] = a && a.total > 0 ? Math.round((a.present / a.total) * 100) : 0;
    });

    // 2. Obtener trabajo cotidiano de la base de datos
    const { data: cwScores, error: cwError } = await supabase
      .from("daily_work_scores")
      .select("student_id, score, total_points")
      .in("student_id", studentIds)
      .eq("period", periodToLoad);

    if (cwError) throw cwError;

    const cotPct: Record<number, number> = {};
    studentIds.forEach(id => { cotPct[id] = 0; });
    (cwScores || []).forEach(d => {
      if (d.total_points && d.total_points > 0) {
        cotPct[d.student_id] = Math.round((d.score / d.total_points) * 100);
      }
    });

    // 3. Obtener notas de la tabla grades
    const { data: gradesData, error: gradesError } = await supabase
      .from("grades")
      .select("student_id, projects, test1, test2")
      .in("student_id", studentIds)
      .eq("period", periodToLoad);

    if (gradesError) throw gradesError;

    const gradesMap: Record<number, { projects: number; test: number }> = {};
    studentIds.forEach(id => { gradesMap[id] = { projects: 0, test: 0 }; });
    (gradesData || []).forEach(row => {
      const sid = row.student_id;
      const projectsScore = row.projects != null ? Math.round(row.projects) : 0;
      
      // Promediar pruebas si hay ambas, o tomar la existente
      let testScore = 0;
      if (row.test1 != null && row.test2 != null) {
        testScore = Math.round((row.test1 + row.test2) / 2);
      } else if (row.test1 != null) {
        testScore = Math.round(row.test1);
      } else if (row.test2 != null) {
        testScore = Math.round(row.test2);
      }

      gradesMap[sid] = {
        projects: projectsScore,
        test: testScore
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
      const cotidiano = cotPct[student.id] || 0;
      const tareas = gradesMap[student.id]?.projects || 0;
      const prueba = gradesMap[student.id]?.test || 0;
      const asistencia = attPct[student.id] || 0;

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
