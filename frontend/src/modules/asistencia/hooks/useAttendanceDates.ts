import { useState, useEffect } from "react";
import { supabase } from "../../../supabaseClient";

/**
 * Hook que consulta qué fechas tienen al menos un registro de asistencia
 * para el grupo activo, periodo académico y usuario actual.
 * Retorna un Set<string> con fechas en formato "YYYY-MM-DD".
 * La consulta es liviana: solo trae attendance_date deduplicado.
 * 
 * @param refreshKey — cambiar este valor para forzar re-consulta (ej: después de guardar)
 */
export function useAttendanceDates(
  groupId: number | null,
  period: string,
  ownerId?: string,
  refreshKey?: number
) {
  const [datesWithAttendance, setDatesWithAttendance] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchDates() {
      if (!groupId || !ownerId || period === "annual") {
        setDatesWithAttendance(new Set());
        return;
      }

      try {
        // Traer los IDs de estudiantes del grupo
        const { data: students, error: studentsError } = await supabase
          .from("students")
          .select("id")
          .eq("group_id", groupId)
          .eq("owner_id", ownerId);

        if (studentsError) throw studentsError;

        const studentIds = (students ?? []).map((s: any) => s.id);
        if (studentIds.length === 0) {
          setDatesWithAttendance(new Set());
          return;
        }

        // Consulta liviana: solo attendance_date
        const { data, error } = await supabase
          .from("attendance_lessons")
          .select("attendance_date")
          .eq("period", period)
          .eq("owner_id", ownerId)
          .in("student_id", studentIds);

        if (error) throw error;

        // Deduplicar fechas en el cliente
        const uniqueDates = new Set((data ?? []).map((r: any) => r.attendance_date));
        setDatesWithAttendance(uniqueDates);
      } catch (err) {
        console.error("Error cargando fechas con asistencia:", err);
      }
    }

    fetchDates();
  }, [groupId, period, ownerId, refreshKey]);

  return { datesWithAttendance };
}
