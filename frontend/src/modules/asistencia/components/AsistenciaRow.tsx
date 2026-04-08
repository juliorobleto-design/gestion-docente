import { useState, useEffect, useRef, useCallback } from "react";
import { TAttendanceStatus } from "../pages/AsistenciaPage";
import { Estudiante } from "../hooks/useEstudiantesClase";
import { calculateStudentRisk } from "./AsistenciaResumen";

type AsistenciaRowProps = {
  student: Estudiante;
  values: TAttendanceStatus[];
  locations: string[];
  observations: string[];
  pastPoints?: number;
  onChange: (studentId: number, lessonIndex: number, status: TAttendanceStatus) => void;
  onMetadataChange: (studentId: number, field: "location" | "observation", value: string, explicitLessonIndex: number) => void;
  activeLessonIndex: number | null;
};

// Configuración de colores SIN tocar, exactamente como funcionaba
const STATUS_CONFIG: Record<TAttendanceStatus, { label: string, colorClass: string }> = {
  P: { label: "P", colorClass: "bg-green-100 text-green-800 border-green-400 hover:bg-green-200" },
  T: { label: "T", colorClass: "bg-yellow-100 text-yellow-800 border-yellow-400 hover:bg-yellow-200" },
  A: { label: "A", colorClass: "bg-red-100 text-red-800 border-red-400 hover:bg-red-200" },
  J: { label: "J", colorClass: "bg-gray-100 text-gray-800 border-gray-400 hover:bg-gray-200" },
};

export default function AsistenciaRow({ 
  student, 
  values = [], 
  locations = [],
  observations = [],
  pastPoints = 0,
  onChange, 
  onMetadataChange,
  activeLessonIndex 
}: AsistenciaRowProps) {
  
  const { points, percentage, colorClass } = calculateStudentRisk(values, pastPoints);

  const [localLoc, setLocalLoc] = useState("");
  const [localObs, setLocalObs] = useState("");

  // Buffer local temporal para detectar cambios pendientes
  const bufferRef = useRef({
    lessonIndex: activeLessonIndex,
    loc: "",
    obs: "",
    isDirty: false
  });

  // El sistema de envío seguro que sabe exactamente de QUÉ lección era el dato
  const flushPendingChanges = useCallback(() => {
    const { lessonIndex, loc, obs, isDirty } = bufferRef.current;
    if (isDirty && lessonIndex !== null) {
      if (loc !== (locations[lessonIndex] || "")) {
        onMetadataChange(Number(student.id), "location", loc, lessonIndex);
      }
      if (obs !== (observations[lessonIndex] || "")) {
        onMetadataChange(Number(student.id), "observation", obs, lessonIndex);
      }
      bufferRef.current.isDirty = false;
    }
  }, [student.id, locations, observations, onMetadataChange]);

  // Cuando cambian de contexto (L1 -> L2) o al recibir nuevos datos
  useEffect(() => {
    if (activeLessonIndex !== bufferRef.current.lessonIndex) {
      // 1. Guardamos lo viejo antes de pasar a la nueva lección
      flushPendingChanges();

      // 2. Extraemos los valores de la NUEVA lección
      const newLoc = activeLessonIndex !== null ? (locations[activeLessonIndex] || "") : "";
      const newObs = activeLessonIndex !== null ? (observations[activeLessonIndex] || "") : "";
      
      setLocalLoc(newLoc);
      setLocalObs(newObs);
      
      // 3. Reseteamos el buffer para rastrear la nueva
      bufferRef.current = {
        lessonIndex: activeLessonIndex,
        loc: newLoc,
        obs: newObs,
        isDirty: false
      };
    } else {
      // Si la BD externa nos actualizó los datos y no estamos editando activamente
      if (!bufferRef.current.isDirty && activeLessonIndex !== null) {
        const upLoc = locations[activeLessonIndex] || "";
        const upObs = observations[activeLessonIndex] || "";
        setLocalLoc(upLoc);
        setLocalObs(upObs);
        bufferRef.current.loc = upLoc;
        bufferRef.current.obs = upObs;
      }
    }
  }, [activeLessonIndex, locations, observations, flushPendingChanges]);

  // En desmontaje (cambio de fecha, cambio de tarjeta de grupo, o salir de página)
  useEffect(() => {
    return () => {
      flushPendingChanges();
    };
  }, [flushPendingChanges]);

  // Mantenemos el buffer super rapido en cada tecla
  function handleLocChange(val: string) {
    setLocalLoc(val);
    bufferRef.current.loc = val;
    bufferRef.current.isDirty = true;
  }

  function handleObsChange(val: string) {
    setLocalObs(val);
    bufferRef.current.obs = val;
    bufferRef.current.isDirty = true;
  }

  function handleInputBlur() {
    flushPendingChanges();
  }

  // LÓGICA INTACTA
  function handleCycleClick(lessonIndex: number, currentValue: TAttendanceStatus) {
    const sequence: TAttendanceStatus[] = ["P", "T", "A", "J"];
    const currentIndex = sequence.indexOf(currentValue);
    
    const nextIndex = (currentIndex + 1) % sequence.length;
    const nextStatus = sequence[nextIndex];
    
    onChange(Number(student.id), lessonIndex, nextStatus);
  }

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!student.parent1_phone) {
      return;
    }
    
    const cleanPhone = student.parent1_phone.replace(/[\s-]/g, "");
    
    const message = `Estimado encargado(a) de ${student.name},\n\nSe le informa que el estudiante presenta un nivel de alerta en asistencia.\n\nPor favor dar seguimiento.\n\nAtentamente,\nDocente.`;

    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/506${cleanPhone}?text=${encodedMessage}`;
    
    window.open(url, "_blank");
  };

  return (
    <div 
      className="group grid items-center gap-2 py-2 px-4 border-b border-gray-100 bg-white hover:bg-indigo-50/60 cursor-pointer transition-colors duration-150"
      style={{
        // Rejilla CSS estricta para alinear con el encabezado. Ambas DEBEN ser idénticas milimétricamente.
        gridTemplateColumns: "minmax(240px, 2fr) 70px repeat(6, 56px) minmax(300px, 3fr) 40px",
      }}
    >
      
      {/* Columna 1: Estudiante y Cédula */}
      <div className="flex flex-col min-w-0 pr-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-gray-700 group-hover:text-indigo-900 group-hover:font-extrabold text-sm uppercase truncate transition-colors duration-150" title={student.name}>
            {student.name}
          </span>
          {student.apoyo_curricular === 'no_significativo' && (
            <div className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0 shadow-sm" title="Apoyos curriculares no significativos" />
          )}
          {student.apoyo_curricular === 'significativo' && (
            <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 shadow-sm" title="Apoyos curriculares significativos" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[12.5px] font-medium text-gray-500 group-hover:text-indigo-600 truncate transition-colors duration-150">
            {student.cedula || "Sin Padrón"}
          </span>
          
          <div 
            className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden flex-shrink-0 opacity-85 shadow-inner"
            title={`Alerta temprana (Histórico Semestral): Riesgo ${Math.round(percentage)}% (${points} ausencias totales)`}
          >
            <div className={`h-full ${colorClass} transition-all duration-500`} style={{ width: `${percentage}%` }} />
          </div>
        </div>
      </div>

      {/* Columna 2: Ubicación */}
      <div className="flex justify-center px-1">
        <input 
          type="text"
          disabled={activeLessonIndex === null}
          value={localLoc}
          onChange={(e) => handleLocChange(e.target.value)}
          onBlur={handleInputBlur}
          placeholder={activeLessonIndex === null ? "-" : "Ubic..."}
          className={`w-full rounded border border-transparent bg-transparent text-center text-[11.5px] font-semibold focus:outline-none focus:bg-white focus:border-indigo-200 transition-colors ${
            activeLessonIndex === null ? "text-gray-300 cursor-not-allowed" : "text-indigo-700 hover:bg-white"
          }`}
          title={activeLessonIndex === null ? "Seleccione una lección primero" : "Ubicación (ej: PC-12)"}
        />
      </div>

      {/* Columnas 3 a 8: Iterador fijo a 6 casillas para proteger el ancho de la tabla */}
      {Array.from({ length: 6 }).map((_, slotIndex) => {
        const val = values[slotIndex];
        const currentConfig = val ? STATUS_CONFIG[val] || STATUS_CONFIG["P"] : null;
        
        // Regla: Si no hay lección activa (null), el bloque es gris y atenuado.
        // Si hay una lección seleccionada, atenuamos obligatoriamente todas las previas (o no seleccionadas) 
        // sin bloquear nunca su capacidad interactiva.
        const isInactive = activeLessonIndex === null || slotIndex !== activeLessonIndex;

        return (
          <div key={slotIndex} className="flex justify-center items-center">
            {currentConfig ? (
              <button
                type="button"
                onClick={() => handleCycleClick(slotIndex, val!)}
                // w-9 h-9 logran los 36px perfectos. rounded-xl logra el borde suavizado moderno
                className={`w-9 h-9 flex items-center justify-center font-bold text-sm rounded-xl border border-transparent transition-all transform active:scale-95 cursor-pointer shadow-sm 
                  ${currentConfig.colorClass} 
                  ${isInactive ? 'opacity-40 grayscale focus:grayscale-0 focus:opacity-100 hover:opacity-100 hover:grayscale-0' : ''}
                `}
                title={`Lección ${slotIndex + 1}: Cambiar estado (Siempre editable)`}
              >
                {currentConfig.label}
              </button>
            ) : (
              // Celda muerta: Mantiene el "peso" de la columna para empujar la observación a la derecha
              <div className="w-9 h-9" />
            )}
          </div>
        );
      })}

      {/* Columna 9: Observaciones */}
      <div className="flex items-center min-w-0 pl-3 pr-1 w-full relative">
        <input
          type="text"
          disabled={activeLessonIndex === null}
          value={localObs}
          onChange={(e) => handleObsChange(e.target.value)}
          onBlur={handleInputBlur}
          placeholder={activeLessonIndex === null ? "Seleccione una lección para editar..." : "Añadir observación..."}
          className={`w-full rounded-md border text-xs shadow-sm focus:outline-none transition-colors px-3 py-1.5 ${
            activeLessonIndex === null 
              ? "border-transparent bg-transparent text-gray-400 cursor-not-allowed placeholder-gray-300" 
              : "border-gray-200 bg-white text-gray-700 focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 placeholder-gray-400"
          }`}
        />
      </div>

      {/* Columna 10: Acciones (WhatsApp) */}
      <div className="flex items-center justify-center">
        <button 
          onClick={handleWhatsAppClick}
          title="Notificar alerta vía WhatsApp"
          className="text-gray-400 hover:text-green-500 transition-colors flex items-center justify-center rounded-md hover:bg-green-50 w-8 h-8 flex-shrink-0"
        >
          {/* Logo WhatsApp (Icono oficial actualizado) */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </button>
      </div>

    </div>
  );
}