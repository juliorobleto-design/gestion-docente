import { useState } from "react";
import { supabase } from "../../../supabaseClient";
import { TAttendanceStatus } from "../pages/AsistenciaPage";
import { showAuthError } from "../../../utils/authError";

function mapStatusToDb(status: TAttendanceStatus) {
  switch (status) {
    case "P": return "presente";
    case "T": return "tardía";
    case "A": return "ausente";
    case "J": return "justificada";
    default: return "presente";
  }
}

export function useGuardarAsistencia() {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

    async function guardar(
      attendanceData: Record<number, TAttendanceStatus[]>,
      locationsData: Record<number, string[]>,
      observationsData: Record<number, string[]>,
      scheduleLessonsCount: number,
      localDateStr: string,
      ownerId: string,
      period: string
    ) {
      if (!ownerId) {
        showAuthError();
        return;
      }
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);
  
      try {
        // 1. Mapear el objeto de memoria a registros por lección
        const recordsToInsert: any[] = [];
  
        for (const [studentIdStr, lessons] of Object.entries(attendanceData)) {
          const studentId = Number(studentIdStr);
          for (let idx = 0; idx < scheduleLessonsCount; idx++) {
            const status = lessons[idx] || "P";
            recordsToInsert.push({
              student_id: studentId,
              attendance_date: localDateStr,
              lesson_number: idx + 1, // DB base 1
              status: mapStatusToDb(status),
              location: locationsData[studentId]?.[idx] || null,
              observation: observationsData[studentId]?.[idx] || null,
              owner_id: ownerId || null,
              period: period,
            });
          }
        }

      if (recordsToInsert.length === 0) {
        setIsSaving(false);
        return;
      }

      // 2. Insertar o Actualizar masivo (upsert) en attendance_lessons
      const { error } = await supabase
        .from("attendance_lessons")
        .upsert(recordsToInsert, { 
            onConflict: "student_id,attendance_date,lesson_number" 
        });

      if (error) throw error;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000); 

    } catch (err: any) {
      console.error("Error crítico guardando asistencia multilección:", err);
      setSaveError(err.message || "Ocurrió un error inesperado al contactar con la nube.");
    } finally {
      setIsSaving(false);
    }
  }

  return { guardar, isSaving, saveError, saveSuccess };
}
