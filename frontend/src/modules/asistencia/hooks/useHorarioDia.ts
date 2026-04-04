import { useState, useEffect } from "react";
import { supabase } from "../../../supabaseClient";

export type ScheduleItem = {
  id: number;
  groupId: number;
  groupName: string;
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  lessons: number;
};

export function useHorarioDia(selectedDateString: string, userId?: string) {
  const [schedulesDelDia, setSchedulesDelDia] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTodaySchedules() {
      setLoading(true);
      setError(null);
      
      try {
        const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        // Evitamos UTC offset erróneos al parsear instanciando con timezone local localmente
        const [year, month, dayStr] = selectedDateString.split('-');
        const targetDate = new Date(Number(year), Number(month) - 1, Number(dayStr));
        const activeDayName = days[targetDate.getDay()];

        // OBTENEMOS HORARIO DEL DÍA
        // Aplicamos el user_id: 1 fijo (Hack temporal de Fase 1 y 2)
        let query = supabase
          .from("schedules")
          .select(`
            *,
            groups(name)
          `)
          .ilike("day", activeDayName)
          .order("start_time", { ascending: true });

        if (userId) {
          query = query.eq("owner_id", userId);
        }

        const { data, error: sbError } = await query;

        if (sbError) throw sbError;

        // MAPEO SEGURO PARA EL FRONTEND
        const mappedSchedules = (data || []).map((item: any) => ({
          id: item.id,
          groupId: item.group_id,
          groupName: item.groups?.name || "Sin Grupo",
          day: item.day,
          startTime: item.start_time,
          endTime: item.end_time,
          subject: item.subject,
          lessons: Number(item.lessons ?? 1),
        }));

        setSchedulesDelDia(mappedSchedules);
      } catch (err: any) {
        console.error("Error cargando horario del día:", err);
        setError(err.message || "Error al cargar el horario del día");
      } finally {
        setLoading(false);
      }
    }

    loadTodaySchedules();
  }, [selectedDateString]);

  return { schedulesDelDia, loading, error };
}
