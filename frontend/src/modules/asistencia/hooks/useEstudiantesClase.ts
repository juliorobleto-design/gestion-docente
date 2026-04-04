import { useState, useEffect } from "react";
import { supabase } from "../../../supabaseClient";

export type Estudiante = {
  id: string; // Lo tipamos como string porque en tu App.tsx se valida así
  name: string;
  cedula?: string;
  apoyo_curricular?: "no_significativo" | "significativo" | null;
  parent1_phone?: string;
};

export function useEstudiantesClase(groupId: number | null) {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEstudiantes() {
      // Si el profe no ha seleccionado un grupo, retornamos un arreglo vacío de inmediato.
      if (!groupId) {
        setEstudiantes([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // En tu db actual, los estudiantes solo tienen group_id y no user_id (lo vimos en tu código)
        const { data, error: sbError } = await supabase
          .from("students")
          .select("id, name, cedula, apoyo_curricular, parent1_phone")
          .eq("group_id", groupId)
          .order("name", { ascending: true }); // Orden alfabético obligatorio en listas escolares

        if (sbError) throw sbError;

        setEstudiantes(data || []);
      } catch (err: any) {
        console.error("Error cargando nómina de estudiantes:", err);
        setError(err.message || "Hubo un problema al intentar descargar los estudiantes.");
      } finally {
        setLoading(false);
      }
    }

    fetchEstudiantes();
  }, [groupId]); // Este hook es 100% reactivo: si cambia el grupo, re-ejecuta.

  return { estudiantes, loading, error };
}
