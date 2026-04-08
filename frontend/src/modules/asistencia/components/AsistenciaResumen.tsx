import { TAttendanceStatus } from "../pages/AsistenciaPage";

interface AsistenciaResumenProps {
  attendance: Record<number, TAttendanceStatus[]>;
  totalEstudiantes: number;
  activeLessonIndex: number | null;
}

// Función desacoplada para futuros reportes por estudiante (históricos resguardados para Reporte acumulado)
export function getAccumulatedStats(attendance: Record<number, TAttendanceStatus[]>) {
  const accumulated = { P: 0, T: 0, A: 0, J: 0 };
  Object.values(attendance).forEach(statusArray => {
    if (Array.isArray(statusArray)) {
      statusArray.forEach(status => {
        if (status && accumulated[status] !== undefined) accumulated[status]++;
      });
    }
  });
  return accumulated;
}

// Lógica base de Alerta Temprana MEP: 1 T = 0.5A | 1 A = 1.0A
export function calculateStudentRisk(statuses: TAttendanceStatus[], pastPoints: number = 0): { points: number; percentage: number; colorClass: string } {
  let points = pastPoints;
  
  if (Array.isArray(statuses)) {
    statuses.forEach(status => {
      if (status === "A") points += 1;
      else if (status === "T") points += 0.5;
    });
  }

  // Escala inicial sugerida: 0=0%, 1=20%, 2=40%, 3=60%, 4=80%, 5+=100%
  const percentage = Math.min((points / 5) * 100, 100);

  // Escala de color
  let colorClass = "bg-green-400";
  if (percentage > 80) colorClass = "bg-red-500";
  else if (percentage > 60) colorClass = "bg-orange-500";
  else if (percentage > 40) colorClass = "bg-yellow-400";
  else if (percentage > 20) colorClass = "bg-lime-400";

  return { points, percentage, colorClass };
}

export default function AsistenciaResumen({ attendance, totalEstudiantes, activeLessonIndex }: AsistenciaResumenProps) {
  // Calculamos en tiempo real sumando ESTRICTAMENTE la "lección activa" de los estudiantes
  const resumen = { P: 0, T: 0, A: 0, J: 0 };
  
  // Condición apagada
  const isInactive = activeLessonIndex === null;

  if (!isInactive) {
    Object.values(attendance).forEach(statusArray => {
      if (Array.isArray(statusArray) && statusArray.length > activeLessonIndex) {
        const status = statusArray[activeLessonIndex];
        if (status && resumen[status] !== undefined) {
          resumen[status]++;
        }
      }
    });
  }

  return (
    <div className="bg-gray-50 py-1.5 px-4 rounded-lg border border-gray-200 flex flex-wrap justify-between items-center sm:justify-around gap-2 mb-3 shadow-sm">
      {/* Total Opcional */}
      <div className="text-center px-4">
        <span className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Total</span>
        <span className="text-xl font-black text-gray-700 leading-none">{totalEstudiantes}</span>
      </div>

      {/* Contadores */}
      <div className={`text-center px-4 border-l border-gray-200 transition-opacity ${isInactive ? 'opacity-40 grayscale' : ''}`}>
        <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-0.5">Presentes</span>
        <span className="text-xl font-black text-green-600 leading-none">{isInactive ? '-' : resumen.P}</span>
      </div>
      
      <div className={`text-center px-4 border-l border-gray-200 transition-opacity ${isInactive ? 'opacity-40 grayscale' : ''}`}>
        <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-0.5">Tardías</span>
        <span className="text-xl font-black text-yellow-500 leading-none">{isInactive ? '-' : resumen.T}</span>
      </div>
      
      <div className={`text-center px-4 border-l border-gray-200 transition-opacity ${isInactive ? 'opacity-40 grayscale' : ''}`}>
        <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-0.5">Ausentes</span>
        <span className="text-xl font-black text-red-500 leading-none">{isInactive ? '-' : resumen.A}</span>
      </div>
      
      <div className={`text-center px-4 border-l border-gray-200 transition-opacity ${isInactive ? 'opacity-40 grayscale' : ''}`}>
        <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-0.5">Justificadas</span>
        <span className="text-xl font-black text-gray-500 leading-none">{isInactive ? '-' : resumen.J}</span>
      </div>
    </div>
  );
}
