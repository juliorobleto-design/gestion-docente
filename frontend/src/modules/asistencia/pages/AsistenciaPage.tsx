import React, { useState, useEffect } from "react";
import { useHorarioDia } from "../hooks/useHorarioDia";
import { useEstudiantesClase } from "../hooks/useEstudiantesClase";
import AsistenciaFiltros from "../components/AsistenciaFiltros";
import AsistenciaRow from "../components/AsistenciaRow";
import AsistenciaResumen from "../components/AsistenciaResumen";
import { useGuardarAsistencia } from "../hooks/useGuardarAsistencia";
import { showAuthError } from "../../../utils/authError";
import { AlertTriangle, Info, Calendar } from "lucide-react";
import { saveAttendanceLesson, loadAttendanceByDate, loadHistoricalAccumulatedRisk, loadAnnualAttendanceSummary } from "../services/attendanceLessons";

export type TAttendanceStatus = "P" | "T" | "A" | "J";

export function getTodayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type Props = {
  session?: any;
  academicPeriod: "semester1" | "semester2" | "annual";
};

export default function AsistenciaPage({ session, academicPeriod }: Props): React.ReactElement {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalDate());
  const [annualSummary, setAnnualSummary] = useState<any[]>([]);
  const [isLoadingAnnual, setIsLoadingAnnual] = useState(false);
  
  const { schedulesDelDia, loading: loadingHorario, error: errorHorario } = useHorarioDia(selectedDate, session?.user?.id);
  
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [actualLessonsCount, setActualLessonsCount] = useState<number>(1);

  // Forzamos explícitamente el reseteo del grupo y las lecciones al cambiar de fecha o periodo
  useEffect(() => {
    if (academicPeriod !== 'annual') {
      setSelectedScheduleId(null);
      setActiveLessonIndex(null);
    }
  }, [selectedDate, academicPeriod]);

  // Derivamos el grupo exacto y la cantidad de lecciones calculándolos en vivo a partir de la selección del Horario
  const activeSchedule = schedulesDelDia.find(s => s.id === selectedScheduleId) || null;
  const selectedGroupId = activeSchedule ? activeSchedule.groupId : null;
  const scheduleLessonsCount = activeSchedule ? activeSchedule.lessons : 1;
  const [attendance, setAttendance] = useState<Record<number, TAttendanceStatus[]>>({});

  // 1. NUEVO ESTADO: Índice de la lección activa para el cálculo en vivo de estadísticas (de 0 a N, o null si ninguna)
  const [activeLessonIndex, setActiveLessonIndex] = useState<number | null>(null);

  // Forzamos explícitamente el apagado de cualquier lección al cambiar de grupo o al cargar la página.
  useEffect(() => {
    setActiveLessonIndex(null);
  }, [selectedScheduleId]);

  const { 
    estudiantes, 
    loading: loadingEstudiantes, 
    error: errorEstudiantes 
  } = useEstudiantesClase(selectedGroupId);

  // 2. NUEVO HOOK: Maneja el estado asíncrono del botón Guardar sin ensuciar la vista
  const { guardar, isSaving, saveError, saveSuccess } = useGuardarAsistencia();

  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);

  // NUEVA LÓGICA CORE: Precargar a todos los estudiantes y mezclar con datos históricos de la BD
  const [locations, setLocations] = useState<Record<number, string[]>>({});
  const [observations, setObservations] = useState<Record<number, string[]>>({});
  const [accumulatedRiskPoints, setAccumulatedRiskPoints] = useState<Record<number, number>>({});

  useEffect(() => {
    async function fetchData() {
      if (!session) return;
      
      // MODO ANUAL: Carga resumen consolidado
      if (academicPeriod === 'annual') {
        if (!selectedGroupId) {
          setAnnualSummary([]);
          return;
        }
        setIsLoadingAnnual(true);
        try {
          const summary = await loadAnnualAttendanceSummary(selectedGroupId, session.user.id);
          setAnnualSummary(summary);
        } catch (err) {
          console.error("Error cargando resumen anual:", err);
        } finally {
          setIsLoadingAnnual(false);
        }
        return;
      }

      // MODOS SEMESTRALES: Carga diaria estándar
      if (estudiantes.length === 0 || !selectedGroupId) {
        setAttendance({});
        setLocations({});
        setObservations({});
        return;
      }

      setIsLoadingAttendance(true);
      try {
        const memoryAttendance: Record<number, TAttendanceStatus[]> = {};
        const memoryLocations: Record<number, string[]> = {};
        const memoryObservations: Record<number, string[]> = {};

        estudiantes.forEach((est) => {
          memoryAttendance[Number(est.id)] = Array(6).fill("P");
          memoryLocations[Number(est.id)] = Array(6).fill("");
          memoryObservations[Number(est.id)] = Array(6).fill("");
        });

        const periodToLoad = academicPeriod;
        const savedRecords = await loadAttendanceByDate(selectedGroupId, selectedDate, periodToLoad, session.user.id);

        let maxSavedLesson = 0;
        savedRecords.forEach((record) => {
          const sId = record.student_id;
          const lessonIndex = record.lesson_number - 1; 
          
          if (record.lesson_number > maxSavedLesson) {
            maxSavedLesson = record.lesson_number;
          }

          if (memoryAttendance[sId] && lessonIndex >= 0 && lessonIndex < 6) {
            let mappedStatus: TAttendanceStatus = "P";
            if (record.status === "tardía") mappedStatus = "T";
            else if (record.status === "ausente") mappedStatus = "A";
            else if (record.status === "justificada") mappedStatus = "J";

            memoryAttendance[sId][lessonIndex] = mappedStatus;
            memoryLocations[sId][lessonIndex] = record.location || "";
            memoryObservations[sId][lessonIndex] = record.observation || "";
          }
        });

        setAttendance(memoryAttendance);
        setLocations(memoryLocations);
        setObservations(memoryObservations);

        if (maxSavedLesson > 0) {
          setActualLessonsCount(maxSavedLesson);
        } else {
          setActualLessonsCount(scheduleLessonsCount);
        }

        const histRisk = await loadHistoricalAccumulatedRisk(selectedGroupId, selectedDate, periodToLoad, session.user.id);
        setAccumulatedRiskPoints(histRisk);

      } catch (err) {
        console.error("Error cargando base histórica de asistencia:", err);
      } finally {
        setIsLoadingAttendance(false);
      }
    }

    fetchData();
  }, [estudiantes, scheduleLessonsCount, selectedGroupId, selectedDate, academicPeriod, session]);

  function mapStatusToDb(status: TAttendanceStatus) {
    switch (status) {
      case "P": return "presente";
      case "T": return "tardía";
      case "A": return "ausente";
      case "J": return "justificada";
      default: return "presente";
    }
  }

  async function handleAttendanceChange(studentId: number, lessonIndex: number, status: TAttendanceStatus) {
    if (academicPeriod === 'annual') return;
    if (!session?.user?.id) {
      showAuthError();
      return;
    }
    setAttendance((prev) => {
      const currentArray = prev[studentId] ? [...prev[studentId]] : Array(6).fill("P");
      currentArray[lessonIndex] = status;
      return { ...prev, [studentId]: currentArray };
    });
    try {
      await saveAttendanceLesson({
        studentId,
        date: selectedDate,
        lessonNumber: lessonIndex + 1,
        status: mapStatusToDb(status),
        location: locations[studentId]?.[lessonIndex] || null,
        observation: observations[studentId]?.[lessonIndex] || null,
        ownerId: session.user.id,
        period: academicPeriod
      });
    } catch (error) {
      console.error("Error guardando asistencia:", error);
    }
  }

  async function handleMetadataChange(studentId: number, field: "location" | "observation", value: string, explicitLessonIndex: number) {
    if (academicPeriod === 'annual') return;
    if (!session?.user?.id) {
      showAuthError();
      return;
    }
    if (field === "location") {
      setLocations(prev => {
         const currentArray = prev[studentId] ? [...prev[studentId]] : Array(6).fill("");
         currentArray[explicitLessonIndex] = value;
         return { ...prev, [studentId]: currentArray };
      });
    } else {
      setObservations(prev => {
         const currentArray = prev[studentId] ? [...prev[studentId]] : Array(6).fill("");
         currentArray[explicitLessonIndex] = value;
         return { ...prev, [studentId]: currentArray };
      });
    }

    try {
      const currentStatusRow = attendance[studentId] || Array(6).fill("P");
      await saveAttendanceLesson({
        studentId,
        date: selectedDate, 
        lessonNumber: explicitLessonIndex + 1,
        status: mapStatusToDb(currentStatusRow[explicitLessonIndex]),
        location: field === "location" ? value : (locations[studentId]?.[explicitLessonIndex] || null),
        observation: field === "observation" ? value : (observations[studentId]?.[explicitLessonIndex] || null),
        ownerId: session.user.id,
        period: academicPeriod
      });
    } catch (error) {
       console.error("Error guardando " + field + ":", error);
    }
  }

  return (
    <div className="w-full px-4 sm:px-8 py-4 mx-auto max-w-[1600px] transition-all duration-300">      
      <AsistenciaFiltros 
        schedules={schedulesDelDia}
        selectedScheduleId={selectedScheduleId}
        onSelectSchedule={setSelectedScheduleId}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        disabled={academicPeriod === 'annual'}
      />

      <div className="bg-white p-3 sm:p-6 mt-1 rounded-2xl shadow-sm border border-gray-100">
        
        {academicPeriod === 'annual' && (
          <div className="mb-6 flex items-center gap-4 bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
             <div className="bg-indigo-500 p-2 rounded-lg text-white">
                <Info size={20} />
             </div>
             <div>
                <h3 className="text-indigo-900 font-bold text-sm">Vista de Solo Lectura: Total Anual</h3>
                <p className="text-indigo-700 text-xs">Este panel consolida la asistencia registrada en ambos semestres. Para modificar registros, selecciona Semestre 1 o 2.</p>
             </div>
          </div>
        )}

        {loadingHorario && <p className="text-blue-500 mb-2 px-2">Consultando horario...</p>}
        {errorHorario && <p className="text-red-500 mb-2 px-2">Error de horario: {errorHorario}</p>}
        
        {!selectedGroupId && !loadingHorario && (
          <p className="text-amber-600 font-semibold p-4 bg-amber-50 rounded-md text-center border border-amber-200">
            ☝️ Selecciona un grupo en la parte superior para ver la asistencia.
          </p>
        )}

        {selectedGroupId && (loadingEstudiantes || isLoadingAnnual) && (
          <p className="text-indigo-500 animate-pulse text-center p-4">Cargando datos...</p>
        )}

        {selectedGroupId && !loadingEstudiantes && !isLoadingAnnual && academicPeriod === 'annual' && (
          <div className="animate-in fade-in duration-500 overflow-auto">
             <table className="w-full border-collapse border border-gray-200 rounded-xl overflow-hidden mt-2">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                   <tr className="text-[11px] uppercase tracking-widest text-gray-500 font-extrabold">
                      <th className="p-4 text-left border-r border-gray-200">Estudiante</th>
                      <th className="p-4 text-center bg-blue-50 text-blue-700 border-r border-gray-200">Pres. S1</th>
                      <th className="p-4 text-center bg-blue-50 text-blue-700 border-r border-gray-200">Aus. S1</th>
                      <th className="p-4 text-center bg-emerald-50 text-emerald-700 border-r border-gray-200">Pres. S2</th>
                      <th className="p-4 text-center bg-emerald-50 text-emerald-700 border-r border-gray-200">Aus. S2</th>
                      <th className="p-4 text-center bg-indigo-600 text-white">Total Anual</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {annualSummary.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                         <td className="p-4 font-bold text-sm text-gray-800 border-r border-gray-100">{row.name}</td>
                         <td className="p-4 text-center font-bold text-gray-600 border-r border-gray-100">{row.s1P}</td>
                         <td className="p-4 text-center font-bold text-red-500 border-r border-gray-100">{row.s1A}</td>
                         <td className="p-4 text-center font-bold text-gray-600 border-r border-gray-100">{row.s2P}</td>
                         <td className="p-4 text-center font-bold text-red-500 border-r border-gray-100">{row.s2A}</td>
                         <td className="p-4 text-center">
                            <div className="flex flex-col items-center">
                               <span className="text-[10px] text-gray-400 font-black uppercase mb-1">Presencia</span>
                               <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-black shadow-sm">
                                  {row.totalP} / {row.totalP + row.totalA}
                               </span>
                            </div>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
             {annualSummary.length === 0 && <p className="text-center p-8 text-gray-400 italic">No hay registros de asistencia para este grupo.</p>}
          </div>
        )}

        {selectedGroupId && !loadingEstudiantes && !isLoadingAttendance && academicPeriod !== 'annual' && estudiantes.length > 0 && (
          <div className="animate-in fade-in duration-500">
            <AsistenciaResumen attendance={attendance} totalEstudiantes={estudiantes.length} activeLessonIndex={activeLessonIndex} />

            {/* Selector de lecciones reales del día (Usuario UX) */}
            <div className="flex items-center gap-3 bg-indigo-50/40 border border-indigo-100 p-3 rounded-xl mb-4 shadow-sm">
              <div className="bg-indigo-100 text-indigo-700 p-2 rounded-lg">
                <Calendar size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Lecciones Impartidas hoy</span>
                <span className="text-[11px] text-indigo-500 font-medium">
                  Por defecto: {scheduleLessonsCount} lecciones programadas en horario.
                </span>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs font-bold text-indigo-900">Lecciones reales dadas hoy:</span>
                <select
                  value={actualLessonsCount}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setActualLessonsCount(val);
                    // Si la lección activa seleccionada queda fuera del nuevo rango, apagarla
                    if (activeLessonIndex !== null && activeLessonIndex >= val) {
                      setActiveLessonIndex(null);
                    }
                  }}
                  className="bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-sm font-black text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'lección' : 'lecciones'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 overflow-auto custom-scrollbar border border-gray-200 rounded-xl bg-white shadow-sm max-h-[65vh] relative">
              <div className="min-w-[1080px] w-full flex flex-col">
                <div 
                  className="grid items-center gap-2 py-3 px-4 bg-gray-50 border-b border-gray-300 font-bold text-[11px] text-gray-600 uppercase tracking-widest sticky top-0 z-20 shadow-sm"
                  style={{ gridTemplateColumns: "minmax(240px, 2fr) 70px repeat(6, 56px) minmax(300px, 3fr) 40px" }}
                >
                    <div className="pl-2">Estudiante</div>
                    <div className="text-center">Ubicación</div>
                    {Array.from({ length: 6 }).map((_, i) => {
                      const isExcluded = i >= actualLessonsCount;
                      return (
                        <div key={i} className="flex flex-col items-center justify-center gap-1.5">
                          <button
                            type="button"
                            disabled={isExcluded}
                            onClick={() => setActiveLessonIndex(prev => prev === i ? null : i)}
                            className={`w-[18px] h-[18px] rounded border flex items-center justify-center transition-all shadow-sm ${
                              isExcluded 
                                ? "bg-gray-100 border-gray-200 cursor-not-allowed opacity-30" 
                                : activeLessonIndex === i 
                                  ? "bg-indigo-500 border-indigo-500 text-white scale-110 cursor-pointer" 
                                  : "bg-white border-gray-300 hover:border-indigo-400 cursor-pointer"
                            }`}
                          >
                            {!isExcluded && activeLessonIndex === i && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                            {isExcluded && <span className="text-[10px] text-gray-300 leading-none">—</span>}
                          </button>
                          <span className={`text-[12px] font-extrabold leading-none ${isExcluded ? 'text-gray-300' : 'text-gray-700'}`}>L{i + 1}</span>
                        </div>
                      );
                    })}
                    <div className="pl-3">Observaciones</div>
                  </div>

                  <div className="flex flex-col w-full bg-white relative">
                    {estudiantes.map((student) => (
                      <AsistenciaRow
                        key={student.id}
                        student={student}
                        values={attendance[Number(student.id)] || []}
                        locations={locations[Number(student.id)] || []}
                        observations={observations[Number(student.id)] || []}
                        pastPoints={accumulatedRiskPoints[Number(student.id)] || 0}
                        onChange={handleAttendanceChange}
                        onMetadataChange={handleMetadataChange}
                        activeLessonIndex={activeLessonIndex}
                        actualLessonsCount={actualLessonsCount}
                      />
                    ))}
                  </div>
              </div>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
              {saveSuccess && <span className="text-green-600 font-bold mr-4 self-center animate-pulse">¡Asistencia guardada!</span>}
              {saveError && <span className="text-red-500 text-sm mr-4 self-center">{saveError}</span>}
              <button 
                onClick={() => guardar(attendance, locations, observations, actualLessonsCount, selectedDate, session.user.id, academicPeriod)}
                disabled={isSaving}
                className="bg-indigo-600 text-white font-medium px-6 py-2 rounded shadow hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSaving ? "Guardando..." : "Guardar toda la Asistencia"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
