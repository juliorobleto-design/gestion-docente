import { useState, useEffect, useMemo } from "react";
import { ScheduleItem } from "../hooks/useHorarioDia";
import { getTodayLocalDate } from "../pages/AsistenciaPage";

function timeToMinutes(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

type AsistenciaFiltrosProps = {
  schedules: ScheduleItem[];
  selectedScheduleId: number | null;
  onSelectSchedule: (scheduleId: number) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  disabled?: boolean;
  datesWithAttendance?: Set<string>;
};

/** Genera un array de 7 fechas (lunes a domingo) de la semana que contiene `dateStr` */
function getWeekDays(dateStr: string): string[] {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0=dom, 1=lun...
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7)); // retrocede al lunes
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    days.push(`${yyyy}-${mm}-${dd}`);
  }
  return days;
}

const DAY_INITIALS = ["L", "K", "M", "J", "V", "S", "D"];

export default function AsistenciaFiltros({
  schedules,
  selectedScheduleId,
  onSelectSchedule,
  selectedDate,
  onSelectDate,
  disabled,
  datesWithAttendance = new Set()
}: AsistenciaFiltrosProps) {
  
  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setCurrentMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60000); // Actualiza cada minuto
    return () => clearInterval(interval);
  }, []);

  const todayStr = getTodayLocalDate();
  const isPastDate = selectedDate < todayStr;
  const isFutureDate = selectedDate > todayStr;

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  function getCardState(s: ScheduleItem) {
    if (isPastDate) return "past";
    if (isFutureDate) return "future";
    
    const startMins = timeToMinutes(s.startTime);
    const endMins = timeToMinutes(s.endTime);

    if (currentMinutes < startMins) return "future";
    if (currentMinutes > endMins) return "past";
    return "current";
  }

  /** Navegar semana anterior/siguiente */
  function shiftWeek(direction: -1 | 1) {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + (direction * 7));
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    onSelectDate(`${yyyy}-${mm}-${dd}`);
  }

  return (
    <div className="w-full mb-1.5 relative">
      <div className="flex justify-between items-center mb-3">
        {/* IZQUIERDA: ASISTENCIA */}
        <h1 className="text-2xl font-bold text-gray-800 leading-none">Asistencia</h1>
        
        {/* DERECHA: LECCIONES DEL DÍA - CALENDARIO */}
        <div className="flex items-center gap-3">
          <h2 className="text-[13px] font-bold text-gray-800 uppercase tracking-widest leading-none">Lecciones del día</h2>
          <div className="h-4 w-px bg-gray-300"></div> {/* Separador visual */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 focus-within:ring-2 focus-within:ring-indigo-100 transition-shadow">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => onSelectDate(e.target.value)}
              disabled={disabled}
              className={`bg-transparent text-[13px] font-bold text-gray-700 outline-none cursor-pointer leading-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Fecha de asistencia"
            />
          </div>
        </div>
      </div>

      {/* MINI-SEMANA con marcas de asistencia */}
      {!disabled && (
        <div className="flex items-center gap-1 mb-3">
          <button 
            onClick={() => shiftWeek(-1)}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer flex-shrink-0"
            title="Semana anterior"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex gap-1 flex-1 justify-center">
            {weekDays.map((dayStr, i) => {
              const isSelected = dayStr === selectedDate;
              const isToday = dayStr === todayStr;
              const hasAttendance = datesWithAttendance.has(dayStr);
              const dayNum = dayStr.split('-')[2];
              // Fin de semana (sábado=5, domingo=6)
              const isWeekend = i >= 5;

              return (
                <button
                  key={dayStr}
                  onClick={() => onSelectDate(dayStr)}
                  className={`
                    relative flex flex-col items-center justify-center rounded-lg px-2 py-1.5 min-w-[38px] transition-all duration-150 cursor-pointer
                    ${isSelected 
                      ? 'bg-indigo-600 text-white shadow-md scale-105 ring-2 ring-indigo-300' 
                      : isToday 
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100' 
                        : isWeekend 
                          ? 'bg-gray-50 text-gray-400 hover:bg-gray-100' 
                          : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
                    }
                  `}
                  title={dayStr}
                >
                  <span className={`text-[9px] font-bold uppercase leading-none mb-0.5 ${isSelected ? 'text-indigo-200' : isToday ? 'text-indigo-400' : 'text-gray-400'}`}>
                    {DAY_INITIALS[i]}
                  </span>
                  <span className={`text-[13px] font-extrabold leading-none ${isSelected ? '' : ''}`}>
                    {dayNum}
                  </span>
                  {/* Indicador de asistencia registrada */}
                  {hasAttendance && (
                    <div className={`absolute -bottom-0.5 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'} shadow-sm`}></div>
                  )}
                </button>
              );
            })}
          </div>
          <button 
            onClick={() => shiftWeek(1)}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer flex-shrink-0"
            title="Semana siguiente"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
          </button>
          {/* Botón "Hoy" rápido */}
          {selectedDate !== todayStr && (
            <button
              onClick={() => onSelectDate(todayStr)}
              className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md border border-indigo-200 transition-colors cursor-pointer ml-1 flex-shrink-0"
            >
              Hoy
            </button>
          )}
        </div>
      )}
      
      <div className="flex items-center gap-2 overflow-x-auto pt-1.5 pb-2 px-1 -mx-1 custom-scrollbar">
        {schedules.length === 0 ? (
          <p className="text-sm text-gray-500 italic px-2">No hay clases en el horario de hoy.</p>
        ) : (
          schedules.map((s) => {
            const isSelected = selectedScheduleId === s.id;
            const cardState = getCardState(s);

            let bgClass = "bg-white";
            let borderClass = "border-gray-200 hover:border-indigo-200 hover:bg-slate-50";
            let textTitleClass = "text-gray-700";
            let textSubClass = "text-gray-500";
            let opacityClass = "";

            let statusBadge = null;

            if (cardState === "past") {
              bgClass = "bg-gray-50/50";
              textTitleClass = "text-gray-500";
              textSubClass = "text-gray-400";
              opacityClass = "opacity-[0.85] grayscale-[30%]";
              if (!isSelected) {
                borderClass = "border-gray-100 hover:border-gray-200 hover:bg-gray-50";
              }
              statusBadge = (
                <span className="text-[9.5px] font-bold text-gray-500 bg-gray-200/60 px-1.5 py-0.5 rounded tracking-wider">
                  FINALIZADA
                </span>
              );
            } else if (cardState === "future") {
              borderClass = "border-gray-200 border-dashed hover:border-indigo-300";
              textTitleClass = "text-gray-600";
              statusBadge = (
                <span className="text-[9.5px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 tracking-wider">
                  PRÓXIMA
                </span>
              );
            } else if (cardState === "current") {
              bgClass = "bg-emerald-50/40";
              borderClass = "border-emerald-300 shadow-sm";
              textTitleClass = "text-emerald-900";
              textSubClass = "text-emerald-700";
              statusBadge = (
                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded shadow-sm tracking-widest animate-pulse border border-emerald-200">
                  EN CURSO
                </span>
              );
            }

            if (isSelected) {
              bgClass = "bg-[#eff6ff]";
              borderClass = "border-indigo-400 shadow-md transform scale-[1.02] ring-1 ring-indigo-400";
              textTitleClass = "text-indigo-900";
              textSubClass = "text-indigo-700";
              opacityClass = "opacity-100 grayscale-0";
            }

            return (
              <button
                key={s.id}
                onClick={() => onSelectSchedule(s.id)}
                disabled={disabled}
                className={`flex flex-col flex-shrink-0 min-w-[140px] px-3.5 py-2 rounded-xl border transition-all text-left ${bgClass} ${borderClass} ${opacityClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex justify-between w-full items-start flex-col mb-1.5">
                  <div className="flex justify-between w-full items-center">
                    <span className={`font-bold text-[14px] truncate tracking-tight leading-none ${textTitleClass}`}>
                      {s.groupName}
                    </span>
                    {statusBadge}
                  </div>
                  <span className={`text-[11.5px] font-medium truncate w-full mt-1 leading-none ${textSubClass}`}>
                    {s.subject || "Sin Materia"}
                  </span>
                </div>
                
                <div 
                  className="flex items-center justify-between w-full mt-auto pt-1.5 rounded border-t" 
                  style={{ borderColor: isSelected ? 'rgba(99,102,241,0.2)' : 'rgba(0,0,0,0.04)'}}
                >
                  <span className={`text-[11px] font-semibold leading-none ${textSubClass}`}>
                    {s.startTime} - {s.endTime}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
