import { useState, useEffect, useMemo, useCallback } from "react";
import { showAuthError } from "../../../utils/authError";
import { AlertTriangle, BarChart3, Award, X, RotateCcw, Calculator, Save, Check, Loader2 } from "lucide-react";
import { supabase } from "../../../supabaseClient";

// ═══════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════

type EvaluationRubric = {
  id: string;
  name: string;
  percentage: number;
};

type Student = {
  id: number;
  name: string;
  cedula?: string;
  group_id: number;
};

type ViewMode = "points" | "percent" | "both";

type Props = {
  evaluationRubrics: EvaluationRubric[];
  students: Student[];
  groupName: string;
  groupId: number | null;
  academicPeriod: "semester1" | "semester2" | "annual";
  minimumPassingGrade: number;
  setToast: (toast: { message: string; type: "success" | "error" }) => void;
  session?: any;
};

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

function isAttendanceRubric(name: string): boolean {
  return name.toUpperCase().includes("ASISTENCIA");
}

function isCotidianoRubric(name: string): boolean {
  return name.toUpperCase().includes("COTIDIANO");
}

function isAutoSourcRubric(name: string): boolean {
  return isAttendanceRubric(name) || isCotidianoRubric(name);
}

// ═══════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════

export default function NotasPage({ evaluationRubrics, students, groupName, groupId, academicPeriod, minimumPassingGrade, setToast, session }: Props) {

  const activeRubrics = useMemo(() => {
    return evaluationRubrics.filter(r => r.name && r.name.trim() !== "");
  }, [evaluationRubrics]);

  const totalPercentage = useMemo(() => {
    return activeRubrics.reduce((acc, r) => acc + (Number(r.percentage) || 0), 0);
  }, [activeRubrics]);

  const isValidConfig = totalPercentage === 100;

  // ═══════════════════════════════════════
  //  STATE
  // ═══════════════════════════════════════

  const [viewMode, setViewMode] = useState<ViewMode>("points");
  const [showSimulator, setShowSimulator] = useState(false);
  const [simValues, setSimValues] = useState<Record<string, number | null>>({});

  // Manual grades: { [studentId]: { [rubricId]: number | null } }
  const [manualGrades, setManualGrades] = useState<Record<number, Record<string, number | null>>>({});

  // Auto-sourced grades: { [studentId]: { [rubricId]: number | null } }
  const [autoGrades, setAutoGrades] = useState<Record<number, Record<string, number | null>>>({});

  // Alert State
  const [attendancePercent, setAttendancePercent] = useState<Record<number, number | null>>({});
  const [conductAlerts, setConductAlerts] = useState<Record<number, number>>({});
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingManual, setLoadingManual] = useState(false);
  const [annualData, setAnnualData] = useState<Record<number, { s1: number | null, s2: number | null }>>({});

  // ═══════════════════════════════════════
  //  LOAD REAL DATA FROM SOURCES
  // ═══════════════════════════════════════

  const loadAttendanceGrades = useCallback(async () => {
    if (!session || !groupId || students.length === 0) return {};

    try {
      const studentIds = students.map(s => s.id);
      const periodToLoad = academicPeriod === 'annual' ? 'semester1' : academicPeriod;

      const { data, error } = await supabase
        .from("attendance_lessons")
        .select("student_id, status")
        .in("student_id", studentIds)
        .eq("period", periodToLoad);

      if (error) throw error;

      // Group by student: count total lessons and absences/tardies
      const attendance: Record<number, { total: number; present: number }> = {};
      studentIds.forEach(id => { attendance[id] = { total: 0, present: 0 }; });

      (data ?? []).forEach(row => {
        const sid = row.student_id;
        if (!attendance[sid]) attendance[sid] = { total: 0, present: 0 };
        attendance[sid].total += 1;
        // "P" = Presente, "presente" = Presente
        const status = String(row.status).toUpperCase();
        if (status === "P" || status === "PRESENTE") {
          attendance[sid].present += 1;
        } else if (status === "T" || status === "TARDÍA" || status === "TARDIA") {
          // Tardía counts as 0.5 attendance
          attendance[sid].present += 0.5;
        }
        // "A" / "ausente" or "J" / "justificada" = no points
      });

      // Convert to percentage (0-100) for each student
      const result: Record<number, number | null> = {};
      studentIds.forEach(id => {
        const a = attendance[id];
        if (a.total === 0) {
          result[id] = null; // no data yet
        } else {
          result[id] = Math.round((a.present / a.total) * 100 * 100) / 100;
        }
      });

      return result;
    } catch (err) {
      console.error("Error loading attendance grades:", err);
      return {};
    }
  }, [groupId, students]);

  const loadManualGrades = useCallback(async () => {
    if (!groupId || students.length === 0) return;
    
    setLoadingManual(true);
    const periodToLoad = academicPeriod === 'annual' ? 'semester1' : academicPeriod;

    try {
      const { data, error } = await supabase
        .from("grades")
        .select("*")
        .eq("group_id", groupId)
        .eq("period", periodToLoad);

      if (error) throw error;

      const gradesMap: Record<number, Record<string, number | null>> = {};
      (data || []).forEach(row => {
        if (!gradesMap[row.student_id]) gradesMap[row.student_id] = {};
        gradesMap[row.student_id][row.rubric_id] = row.score;
      });

      setManualGrades(gradesMap);
    } catch (err) {
      console.error("Error loading manual grades:", err);
      setToast({ message: "No se pudieron cargar las notas", type: "error" });
    } finally {
      setLoadingManual(false);
    }
  }, [groupId, students, academicPeriod, setToast]);

  const loadAnnualGrades = useCallback(async () => {
    if (!groupId || students.length === 0) return;
    
    setLoadingManual(true);
    try {
      const { data, error } = await supabase
        .from("grades")
        .select("*")
        .eq("group_id", groupId)
        .in("period", ["semester1", "semester2"]);

      if (error) throw error;

      // Calculate totals per student and period
      const totals: Record<number, { s1: number, s1Count: number, s2: number, s2Count: number }> = {};
      students.forEach(s => { totals[s.id] = { s1: 0, s1Count: 0, s2: 0, s2Count: 0 }; });

      (data || []).forEach(row => {
        if (!totals[row.student_id]) return;
        const rubric = activeRubrics.find(r => r.id === row.rubric_id);
        if (rubric) {
          const contribution = (row.score * rubric.percentage) / 100;
          if (row.period === 'semester1') {
            totals[row.student_id].s1 += contribution;
            totals[row.student_id].s1Count += 1;
          } else {
            totals[row.student_id].s2 += contribution;
            totals[row.student_id].s2Count += 1;
          }
        }
      });

      const finalAnnual: Record<number, { s1: number | null, s2: number | null }> = {};
      Object.keys(totals).forEach(sidStr => {
        const sid = parseInt(sidStr);
        const t = totals[sid];
        finalAnnual[sid] = {
          s1: t.s1Count > 0 ? Math.round(t.s1 * 100) / 100 : null,
          s2: t.s2Count > 0 ? Math.round(t.s2 * 100) / 100 : null
        };
      });

      setAnnualData(finalAnnual);
    } catch (err) {
      console.error("Error loading annual data:", err);
      setToast({ message: "No se pudo cargar la consolidación anual", type: "error" });
    } finally {
      setLoadingManual(false);
    }
  }, [groupId, students, activeRubrics, setToast]);


  useEffect(() => {
    if (!groupId || students.length === 0) {
      setAutoGrades({});
      setManualGrades({});
      setAnnualData({});
      return;
    }

    let cancelled = false;
    setLoadingAuto(true);

    (async () => {
      // Load data based on period
      if (academicPeriod === 'annual') {
        await loadAnnualGrades();
      } else {
        await loadManualGrades();
      }

      const attendanceRubric = activeRubrics.find(r => isAttendanceRubric(r.name));
      const attendanceData = attendanceRubric ? await loadAttendanceGrades() : await loadAttendanceGrades(); // Still load for alerts
      
      if (cancelled) return;
      setAttendancePercent(attendanceData);

      // Fetch Recent Negative Anecdotal Records (last 7 days)
      const studentIds = students.map(s => s.id);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const isoSevenDays = sevenDaysAgo.toISOString();

      try {
        const { data: negRecords, error: negError } = await supabase
          .from("anecdotal_records")
          .select("student_id")
          .in("student_id", studentIds)
          .eq("type", "Negativo")
          .gte("date", isoSevenDays);

        if (!negError && negRecords) {
          const counts: Record<number, number> = {};
          negRecords.forEach(r => {
            counts[r.student_id] = (counts[r.student_id] || 0) + 1;
          });
          if (!cancelled) setConductAlerts(counts);
        }
      } catch (e) {
        console.error("Error fetching conduct alerts:", e);
      }

      if (cancelled) return;

      const newAutoGrades: Record<number, Record<string, number | null>> = {};
      students.forEach(s => {
        newAutoGrades[s.id] = {};
        activeRubrics.forEach(rubric => {
          if (isAttendanceRubric(rubric.name)) {
            newAutoGrades[s.id][rubric.id] = attendanceData[s.id] ?? null;
          } else if (isCotidianoRubric(rubric.name)) {
            newAutoGrades[s.id][rubric.id] = null;
          }
        });
      });

      setAutoGrades(newAutoGrades);
      setLoadingAuto(false);
    })();

    return () => { cancelled = true; };
  }, [groupId, students, activeRubrics, academicPeriod, loadAttendanceGrades, loadManualGrades, loadAnnualGrades]);

  // ═══════════════════════════════════════
  //  SAVE DATA
  // ═══════════════════════════════════════

  const saveManualGrades = async () => {
    if (academicPeriod === 'annual') return;
    if (!groupId) return;

    setIsSaving(true);
    try {
      const gradesToInsert: any[] = [];
      
      students.forEach(student => {
        const studentGrades = manualGrades[student.id] || {};
        activeRubrics.forEach(rubric => {
          if (!isAutoSourcRubric(rubric.name)) {
            const score = studentGrades[rubric.id];
            if (score !== null && score !== undefined) {
              gradesToInsert.push({
                student_id: student.id,
                rubric_id: rubric.id,
                group_id: groupId,
                period: academicPeriod,
                score: score,
                owner_id: session.user.id,
                updated_at: new Date().toISOString()
              });
            }
          }
        });
      });
 
       if (gradesToInsert.length === 0) {
         setToast({ message: "No hay notas nuevas para guardar", type: "success" });
         return;
       }
 
       const { error } = await supabase
         .from("grades")
         .upsert(gradesToInsert, { 
           onConflict: 'student_id, rubric_id, group_id, period' 
         });
 
       if (error) throw error;
       setToast({ message: "Notas guardadas correctamente", type: "success" });
     } catch (err) {
       console.error("Error saving grades:", err);
       setToast({ message: "Error al guardar las notas", type: "error" });
     } finally {
       setIsSaving(false);
     }
  };

  // ═══════════════════════════════════════
  //  GRADE ACCESS
  // ═══════════════════════════════════════

  function getGrade(studentId: number, rubricId: string): number | null {
    const rubric = activeRubrics.find(r => r.id === rubricId);
    if (!rubric) return null;

    if (isAutoSourcRubric(rubric.name)) {
      return autoGrades[studentId]?.[rubricId] ?? null;
    }
    return manualGrades[studentId]?.[rubricId] ?? null;
  }

  function setGrade(studentId: number, rubricId: string, value: string) {
    const parsed = value === "" ? null : parseFloat(value);
    const clamped = parsed !== null ? Math.min(100, Math.max(0, parsed)) : null;

    setManualGrades(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [rubricId]: isNaN(clamped as number) ? null : clamped,
      },
    }));
  }

  function calculateFinalGrade(studentId: number): number | null {
    let total = 0;
    let hasAnyGrade = false;

    for (const rubric of activeRubrics) {
      const grade = getGrade(studentId, rubric.id);
      if (grade !== null && grade !== undefined) {
        hasAnyGrade = true;
        total += (grade * rubric.percentage) / 100;
      }
    }

    return hasAnyGrade ? Math.round(total * 100) / 100 : null;
  }

  // ═══════════════════════════════════════
  //  VIEW MODE FORMATTING
  // ═══════════════════════════════════════

  function formatCell(grade: number | null, rubric: EvaluationRubric): { main: string; sub?: string } {
    if (grade === null) return { main: "—" };

    const points = Math.round((grade * rubric.percentage / 100) * 100) / 100;
    const percent = Math.round(grade * 100) / 100;

    switch (viewMode) {
      case "points":
        return { main: points.toFixed(1) };
      case "percent":
        return { main: `${percent.toFixed(0)}%` };
      case "both":
        return { main: points.toFixed(1), sub: `${percent.toFixed(0)}%` };
    }
  }

  // ═══════════════════════════════════════
  //  STATS
  // ═══════════════════════════════════════

  const stats = useMemo(() => {
    const finals = students
      .map(s => calculateFinalGrade(s.id))
      .filter((g): g is number => g !== null);

    if (finals.length === 0) return { avg: null, max: null, min: null, count: 0 };

    return {
      avg: Math.round((finals.reduce((a, b) => a + b, 0) / finals.length) * 100) / 100,
      max: Math.max(...finals),
      min: Math.min(...finals),
      count: finals.length,
    };
  }, [manualGrades, autoGrades, students, activeRubrics]);

  function getGradeColor(grade: number | null): string {
    if (grade === null) return "#94a3b8";
    if (grade >= 70) return "#10b981";
    if (grade >= 50) return "#f59e0b";
    return "#ef4444";
  }

  function getGradeBg(grade: number | null): string {
    if (grade === null) return "transparent";
    if (grade >= 70) return "#ecfdf5";
    if (grade >= 50) return "#fffbeb";
    return "#fef2f2";
  }

  // ═══════════════════════════════════════
  //  SIMULATOR
  // ═══════════════════════════════════════

  function openSimulator() {
    const initial: Record<string, number | null> = {};
    activeRubrics.forEach(r => { initial[r.id] = null; });
    setSimValues(initial);
    setShowSimulator(true);
  }

  function calcSimulatedGrade(): number {
    let total = 0;
    activeRubrics.forEach(r => {
      const val = simValues[r.id];
      if (val !== null && val !== undefined) {
        total += (val * r.percentage) / 100;
      }
    });
    return Math.round(total * 100) / 100;
  }

  // ═══════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════

  return (
    <div className="w-full px-4 sm:px-8 py-4 mx-auto max-w-[1600px] transition-all duration-300">

      {/* ═══════════════════════════════════════
          HEADER
          ═══════════════════════════════════════ */}
      <div style={{
        position: "sticky", top: "84px", zIndex: 40,
        background: "rgba(248, 250, 252, 0.95)", backdropFilter: "blur(12px)",
        padding: "16px 0", borderBottom: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "32px", margin: "-20px -20px 24px -20px",
        paddingLeft: "20px", paddingRight: "20px"
      }}>
        {/* Left: Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ background: "#eef2ff", color: "#4f46e5", padding: "10px", borderRadius: "12px" }}>
            <BarChart3 size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Cuadro de Calificaciones</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              {groupName && (
                <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, background: "#e2e8f0", padding: "4px 10px", borderRadius: "8px", textTransform: "uppercase" }}>
                  {groupName}
                </span>
              )}
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, background: "#e0e7ff", padding: "4px 10px", borderRadius: "8px" }}>
                Evaluación: {totalPercentage}%
              </span>
              <span style={{ fontSize: "12px", color: "#92400e", fontWeight: 700, background: "#fef3c7", padding: "4px 10px", borderRadius: "8px" }}>
                Mín. aprobación: {minimumPassingGrade}
              </span>
            </div>
          </div>
        </div>

        {/* Right: View Selector + Simulator + Save */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>

          {academicPeriod !== 'annual' && (
            <button
              onClick={saveManualGrades}
              disabled={isSaving}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 20px", background: "#4f46e5", color: "#fff",
                border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "13px",
                cursor: isSaving ? "wait" : "pointer",
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
                transition: "all 0.2s",
                opacity: isSaving ? 0.7 : 1
              }}
              className="hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Guardar Notas
                </>
              )}
            </button>
          )}

          {/* Segmented Control: Puntos / % / Ambos */}
          <div style={{
            display: "flex", background: "#f1f5f9", borderRadius: "10px",
            padding: "3px", border: "1px solid #e2e8f0"
          }}>
            {(["points", "percent", "both"] as ViewMode[]).map(mode => {
              const labels = { points: "Puntos", percent: "%", both: "Ambos" };
              const isActive = viewMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: "7px 16px", borderRadius: "8px", fontSize: "13px",
                    fontWeight: isActive ? 700 : 500, border: "none", cursor: "pointer",
                    background: isActive ? "#fff" : "transparent",
                    color: isActive ? "#4f46e5" : "#64748b",
                    boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.2s"
                  }}
                >
                  {labels[mode]}
                </button>
              );
            })}
          </div>

          {/* Simulator Button */}
          <button
            onClick={openSimulator}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "10px 18px", background: "#fff", color: "#475569",
              border: "1px solid #cbd5e1", borderRadius: "10px",
              fontWeight: 700, fontSize: "13px", cursor: "pointer",
              transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
            }}
            className="hover:bg-slate-50 hover:border-slate-400"
          >
            <Calculator size={16} />
            Simulador
          </button>
        </div>
      </div>

      {/* Advertencia si % ≠ 100 */}
      {!isValidConfig && (
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "14px",
          padding: "14px 20px", marginBottom: "24px"
        }}>
          <AlertTriangle size={20} color="#f59e0b" />
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#92400e" }}>
            </span>
        </div>
      )}

      {academicPeriod === 'annual' && (
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "14px",
          padding: "14px 20px", marginBottom: "24px"
        }}>
          <AlertTriangle size={20} color="#3b82f6" />
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#1e40af" }}>
            <strong>Vista de Solo Lectura:</strong> El Total Anual es una consolidación automática. Para modificar notas, selecciona un semestre específico.
          </span>
        </div>
      )}

      {/* ═══════════════════════════════════════
          STATS CARDS
          ═══════════════════════════════════════ */}
      {stats.count > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "#fff", borderRadius: "14px", padding: "16px 20px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: "6px" }}>Promedio General</div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: getGradeColor(stats.avg) }}>{stats.avg}</div>
          </div>
          <div style={{ background: "#fff", borderRadius: "14px", padding: "16px 20px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: "6px" }}>Nota Más Alta</div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#10b981" }}>{stats.max}</div>
          </div>
          <div style={{ background: "#fff", borderRadius: "14px", padding: "16px 20px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: "6px" }}>Nota Más Baja</div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#ef4444" }}>{stats.min}</div>
          </div>
          <div style={{ background: "#fff", borderRadius: "14px", padding: "16px 20px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: "6px" }}>Evaluados</div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#4f46e5" }}>{stats.count}<span style={{ fontSize: "14px", color: "#94a3b8", fontWeight: 700 }}> / {students.length}</span></div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          GRADES TABLE
          ═══════════════════════════════════════ */}
      <div style={{ 
        background: "#fff", 
        borderRadius: "20px", 
        border: "1px solid #e2e8f0", 
        boxShadow: "0 4px 15px rgba(0,0,0,0.03)", 
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flex: 1
      }}>

        {students.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Award size={28} color="#4f46e5" />
            </div>
            <p style={{ fontSize: "16px", fontWeight: 700, color: "#475569", margin: "0 0 4px" }}>No hay estudiantes en este grupo</p>
            <p style={{ fontSize: "13px", color: "#94a3b8" }}>Selecciona un grupo con estudiantes para registrar calificaciones.</p>
          </div>
        ) : (
          <div style={{ 
            overflow: "auto", 
            maxHeight: "calc(100vh - 350px)",
            position: "relative"
          }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: `${280 + activeRubrics.length * 130 + 150 + 130}px` }}>

              {/* TABLE HEAD */}
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{
                    padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 800,
                    color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em",
                    position: "sticky", left: 0, top: 0, background: "#f8fafc", zIndex: 40,
                    minWidth: "240px", borderRight: "1px solid #e2e8f0", borderBottom: "2px solid #e2e8f0"
                  }}>
                    Estudiante
                  </th>

                  {academicPeriod === 'annual' ? (
                    <>
                      <th style={{
                        padding: "14px 12px", textAlign: "center", fontSize: "11px", fontWeight: 800,
                        color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em",
                        minWidth: "150px", position: "sticky", top: 0, background: "#f8fafc", zIndex: 20,
                        borderBottom: "2px solid #e2e8f0"
                      }}>
                        Total I Semestre
                      </th>
                      <th style={{
                        padding: "14px 12px", textAlign: "center", fontSize: "11px", fontWeight: 800,
                        color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em",
                        minWidth: "150px", position: "sticky", top: 0, background: "#f8fafc", zIndex: 20,
                        borderBottom: "2px solid #e2e8f0"
                      }}>
                        Total II Semestre
                      </th>
                      <th style={{
                        padding: "14px 20px", textAlign: "center", fontSize: "11px", fontWeight: 800,
                        color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.08em",
                        minWidth: "150px", borderLeft: "2px solid #e0e7ff",
                        background: "#f5f3ff", position: "sticky", top: 0, zIndex: 20, borderBottom: "2px solid #e2e8f0"
                      }}>
                        Promedio Anual
                      </th>
                    </>
                  ) : (
                    <>
                      {activeRubrics.map(rubric => (
                        <th key={rubric.id} style={{
                          padding: "14px 12px", textAlign: "center", fontSize: "11px", fontWeight: 800,
                          color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em",
                          minWidth: "120px", position: "sticky", top: 0, background: "#f8fafc", zIndex: 20,
                          borderBottom: "2px solid #e2e8f0"
                        }}>
                          <div>{rubric.name}</div>
                          <div style={{
                            fontSize: "10px", fontWeight: 700, color: "#4f46e5",
                            background: "#eef2ff", padding: "2px 8px", borderRadius: "6px",
                            display: "inline-block", marginTop: "4px"
                          }}>
                            {rubric.percentage}%
                          </div>
                          {isAutoSourcRubric(rubric.name) && (
                            <div style={{ fontSize: "9px", color: "#94a3b8", marginTop: "2px", fontWeight: 600 }}>
                              (automático)
                            </div>
                          )}
                        </th>
                      ))}

                      <th style={{
                        padding: "14px 20px", textAlign: "center", fontSize: "11px", fontWeight: 800,
                        color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.08em",
                        minWidth: "120px", borderLeft: "2px solid #e0e7ff",
                        background: "#f5f3ff", position: "sticky", top: 0, zIndex: 20, borderBottom: "2px solid #e2e8f0"
                      }}>
                        Nota Final
                      </th>
                    </>
                  )}

                  <th style={{
                    padding: "14px 16px", textAlign: "center", fontSize: "11px", fontWeight: 800,
                    color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em",
                    minWidth: "150px", position: "sticky", top: 0, background: "#f8fafc", zIndex: 20, borderBottom: "2px solid #e2e8f0"
                  }}>
                    Alertas
                  </th>
                  <th style={{
                    padding: "14px 16px", textAlign: "center", fontSize: "11px", fontWeight: 800,
                    color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em",
                    minWidth: "130px", position: "sticky", top: 0, background: "#f8fafc", zIndex: 20, borderBottom: "2px solid #e2e8f0"
                  }}>
                    Estado
                  </th>
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody>
                {students.map((student, index) => {
                  const s1Total = annualData[student.id]?.s1 || null;
                  const s2Total = annualData[student.id]?.s2 || null;
                  
                  let annualFinal: number | null = null;
                  if (s1Total !== null && s2Total !== null) {
                    annualFinal = Math.round(((s1Total + s2Total) / 2) * 100) / 100;
                  } else if (s1Total !== null) {
                    annualFinal = s1Total;
                  } else if (s2Total !== null) {
                    annualFinal = s2Total;
                  }

                  const semFinalGrade = calculateFinalGrade(student.id);
                  const displayFinal = academicPeriod === 'annual' ? annualFinal : semFinalGrade;

                  return (
                    <tr
                      key={student.id}
                      style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s ease" }}
                      className="hover:bg-slate-50"
                    >
                      {/* Student Name — Sticky */}
                      <td style={{
                        padding: "12px 20px", fontWeight: 600, fontSize: "14px", color: "#0f172a",
                        position: "sticky", left: 0, background: "#fff", zIndex: 5,
                        borderRight: "1px solid #f1f5f9"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{
                            width: "28px", height: "28px", borderRadius: "8px",
                            background: "#eef2ff", color: "#4f46e5",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "12px", fontWeight: 800, flexShrink: 0
                          }}>
                            {index + 1}
                          </span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {student.name}
                          </span>
                        </div>
                      </td>

                      {academicPeriod === 'annual' ? (
                        <>
                          <td style={{ padding: "8px 10px", textAlign: "center" }}>
                            <span style={{ fontSize: "15px", fontWeight: 700, color: "#475569" }}>
                              {s1Total !== null ? s1Total.toFixed(1) : "—"}
                            </span>
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "center" }}>
                            <span style={{ fontSize: "15px", fontWeight: 700, color: "#475569" }}>
                              {s2Total !== null ? s2Total.toFixed(1) : "—"}
                            </span>
                          </td>
                          <td style={{
                            padding: "8px 20px", textAlign: "center",
                            borderLeft: "2px solid #e0e7ff",
                            background: getGradeBg(annualFinal)
                          }}>
                            <span style={{ fontSize: "18px", fontWeight: 800, color: getGradeColor(annualFinal) }}>
                              {annualFinal !== null ? annualFinal.toFixed(1) : "—"}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          {activeRubrics.map(rubric => {
                            const grade = getGrade(student.id, rubric.id);
                            const isAuto = isAutoSourcRubric(rubric.name);
                            const formatted = formatCell(grade, rubric);

                            if (isAuto) {
                              return (
                                <td key={rubric.id} style={{ padding: "8px 10px", textAlign: "center" }}>
                                  {grade === null ? (
                                    <span style={{ color: "#cbd5e1", fontSize: "14px", fontWeight: 500 }}>—</span>
                                  ) : (
                                    <div>
                                      <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                                        {formatted.main}
                                      </span>
                                      {formatted.sub && (
                                        <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, marginTop: "1px" }}>
                                          {formatted.sub}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            }

                            return (
                              <td key={rubric.id} style={{ padding: "8px 10px", textAlign: "center" }}>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.5"
                                  value={grade === null ? "" : grade}
                                  onChange={e => setGrade(student.id, rubric.id, e.target.value)}
                                  disabled={false}
                                  placeholder="—"
                                  style={{
                                    width: "72px", padding: "8px 6px", borderRadius: "10px",
                                    border: "1px solid #e2e8f0", fontSize: "14px", fontWeight: 600,
                                    textAlign: "center", color: "#0f172a", 
                                    outline: "none",
                                    background: "#f8fafc", 
                                    transition: "all 0.2s",
                                    cursor: "text",
                                    opacity: 1
                                  }}
                                  onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.background = "#fff"; e.target.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.1)"; }}
                                  onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f8fafc"; e.target.style.boxShadow = "none"; }}
                                />
                              </td>
                            );
                          })}

                          <td style={{
                            padding: "8px 20px", textAlign: "center",
                            borderLeft: "2px solid #e0e7ff",
                            background: getGradeBg(semFinalGrade)
                          }}>
                            <span style={{
                              fontSize: "18px", fontWeight: 800,
                              color: getGradeColor(semFinalGrade),
                            }}>
                              {semFinalGrade !== null ? semFinalGrade.toFixed(1) : "—"}
                            </span>
                          </td>
                        </>
                      )}

                      <td style={{ padding: "8px 10px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" }}>
                          {displayFinal !== null && displayFinal < minimumPassingGrade && (
                            <span 
                              title={`Nota ${displayFinal.toFixed(1)} < mínimo ${minimumPassingGrade}`}
                              style={{ padding: "4px 8px", borderRadius: "6px", background: "#fef2f2", color: "#ef4444", border: "1px solid #fee2e2", fontSize: "10px", fontWeight: 800, cursor: "help" }}
                            >
                              🔴 Riesgo
                            </span>
                          )}
                          {displayFinal !== null && displayFinal >= 90 && (
                            <span 
                              title="Excelente rendimiento académico"
                              style={{ padding: "4px 8px", borderRadius: "6px", background: "#f0fdf4", color: "#16a34a", border: "1px solid #dcfce7", fontSize: "10px", fontWeight: 800, cursor: "help" }}
                            >
                              🟢 Excelencia
                            </span>
                          )}
                          {attendancePercent[student.id] !== null && (attendancePercent[student.id] || 0) < 80 && (
                            <span 
                              title={`Asistencia: ${attendancePercent[student.id]}% (Mínimo 80%)`}
                              style={{ padding: "4px 8px", borderRadius: "6px", background: "#fffbeb", color: "#d97706", border: "1px solid #fef3c7", fontSize: "10px", fontWeight: 800, cursor: "help" }}
                            >
                              🟡 Asistencia
                            </span>
                          )}
                          {(conductAlerts[student.id] || 0) >= 2 && (
                            <span 
                              title={`${conductAlerts[student.id]} reportes negativos en la última semana`}
                              style={{ padding: "4px 8px", borderRadius: "6px", background: "#fff7ed", color: "#ea580c", border: "1px solid #ffedd5", fontSize: "10px", fontWeight: 800, cursor: "help" }}
                            >
                              🟠 Conducta
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "8px 16px", textAlign: "center" }}>
                        {displayFinal !== null ? (
                          <span style={{
                            fontSize: "11px", fontWeight: 800, textTransform: "uppercase",
                            padding: "5px 12px", borderRadius: "8px",
                            background: displayFinal >= minimumPassingGrade ? "#ecfdf5" : "#fef2f2",
                            color: displayFinal >= minimumPassingGrade ? "#065f46" : "#991b1b",
                            border: displayFinal >= minimumPassingGrade ? "1px solid #a7f3d0" : "1px solid #fecaca",
                            letterSpacing: "0.03em"
                          }}>
                          {displayFinal >= minimumPassingGrade ? "Aprobado" : "Reprobado"}
                          </span>
                        ) : (
                          <span style={{ color: "#cbd5e1", fontSize: "14px" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* ═══════════════════════════════════════
          SIMULATOR MODAL
          ═══════════════════════════════════════ */}
      {showSimulator && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px"
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowSimulator(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: "24px",
            width: "100%", maxWidth: "520px",
            boxShadow: "0 25px 60px rgba(15, 23, 42, 0.2)",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            animation: "fadeIn 0.2s ease-out"
          }}>

            {/* Header */}
            <div style={{
              padding: "24px 28px 16px", borderBottom: "1px solid #f1f5f9",
              display: "flex", justifyContent: "space-between", alignItems: "flex-start"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <div style={{ background: "#eef2ff", color: "#4f46e5", padding: "8px", borderRadius: "10px" }}>
                    <Calculator size={20} />
                  </div>
                  <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Simulador de Notas</h2>
                </div>
                <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0 0", fontWeight: 500 }}>
                  Calcula escenarios sin alterar datos reales
                </p>
              </div>
              <button
                onClick={() => setShowSimulator(false)}
                style={{
                  background: "#f1f5f9", border: "none", borderRadius: "10px", cursor: "pointer",
                  padding: "8px", color: "#64748b", transition: "all 0.15s"
                }}
                className="hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Rubric Inputs */}
            <div style={{ padding: "20px 28px", maxHeight: "400px", overflowY: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {activeRubrics.map(rubric => {
                  const val = simValues[rubric.id];
                  const contribution = val !== null && val !== undefined
                    ? Math.round((val * rubric.percentage / 100) * 100) / 100
                    : 0;

                  return (
                    <div key={rubric.id} style={{
                      display: "flex", alignItems: "center", gap: "14px",
                      padding: "12px 16px", background: "#f8fafc", borderRadius: "14px",
                      border: "1px solid #e2e8f0"
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "2px" }}>
                          {rubric.name}
                        </div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#4f46e5" }}>
                          {rubric.percentage}%
                        </div>
                      </div>

                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={val === null || val === undefined ? "" : val}
                        onChange={e => {
                          const v = e.target.value === "" ? null : Math.min(100, Math.max(0, parseFloat(e.target.value)));
                          setSimValues(prev => ({ ...prev, [rubric.id]: isNaN(v as number) ? null : v }));
                        }}
                        placeholder="0"
                        style={{
                          width: "72px", padding: "10px 8px", borderRadius: "10px",
                          border: "1px solid #cbd5e1", fontSize: "16px", fontWeight: 700,
                          textAlign: "center", color: "#0f172a", outline: "none",
                          background: "#fff", transition: "all 0.2s"
                        }}
                        onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.1)"; }}
                        onBlur={e => { e.target.style.borderColor = "#cbd5e1"; e.target.style.boxShadow = "none"; }}
                      />

                      <div style={{
                        width: "60px", textAlign: "right", fontSize: "14px",
                        fontWeight: 700, color: contribution > 0 ? "#4f46e5" : "#94a3b8"
                      }}>
                        +{contribution.toFixed(1)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer: Simulated Total + Actions */}
            <div style={{
              padding: "20px 28px", borderTop: "1px solid #f1f5f9",
              background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>
                  Nota Final Simulada
                </div>
                <div style={{ fontSize: "32px", fontWeight: 800, color: getGradeColor(calcSimulatedGrade()), lineHeight: 1 }}>
                  {calcSimulatedGrade().toFixed(1)}
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => {
                    const reset: Record<string, number | null> = {};
                    activeRubrics.forEach(r => { reset[r.id] = null; });
                    setSimValues(reset);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "10px 18px", background: "#fff", color: "#475569",
                    border: "1px solid #cbd5e1", borderRadius: "10px",
                    fontWeight: 700, fontSize: "13px", cursor: "pointer"
                  }}
                  className="hover:bg-slate-100"
                >
                  <RotateCcw size={14} /> Restablecer
                </button>
                <button
                  onClick={() => setShowSimulator(false)}
                  style={{
                    padding: "10px 24px", background: "#4f46e5", color: "#fff",
                    border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "13px",
                    cursor: "pointer", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.2)"
                  }}
                  className="hover:bg-indigo-700"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

    </div>
  );
}
