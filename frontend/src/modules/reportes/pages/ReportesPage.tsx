import React, { useState, useEffect } from "react";
import { supabase } from "../../../supabaseClient";
import { 
  FileBarChart, 
  Users, 
  User, 
  CalendarCheck, 
  NotebookPen, 
  StickyNote, 
  ScrollText, 
  FileText, 
  Download, 
  Send, 
  Loader2,
  FileCheck2,
  AlertCircle
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Student {
  id: number;
  name: string;
  group_id: number;
  cedula?: string;
}

interface ReportesPageProps {
  appSettings: {
    institutionName: string;
    teacherName: string;
    teacherEmail: string;
    logoUrl: string | null;
  };
  groups: { id: number; name: string }[];
  activeGroupId: number | null;
  allStudents: Student[];
  session?: any;
  academicPeriod: "semester1" | "semester2" | "annual";
  evaluationRubrics: { id: string; name: string; percentage: number }[];
}

export default function ReportesPage({ 
  appSettings, 
  groups, 
  activeGroupId, 
  allStudents, 
  session,
  academicPeriod,
  evaluationRubrics
}: ReportesPageProps) {
  // State
  const [reportType, setReportType] = useState<"grupal" | "individual">("grupal");
  const [selectedGroup, setSelectedGroup] = useState<number | "">(activeGroupId || "");
  const [selectedStudent, setSelectedStudent] = useState<number | "">("");
  const [sections, setSections] = useState({
    asistencia: true,
    cotidiano: true,
    notas: true,
    anecdotario: true,
    planeamientos: false
  });
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState<string>(`${new Date().getFullYear()}-01-01`);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Derived
  const filteredStudents = allStudents.filter(s => s.group_id === Number(selectedGroup));
  const selectedSectionsCount = Object.values(sections).filter(Boolean).length;
  const currentGroupName = groups.find(g => g.id === Number(selectedGroup))?.name || "Grupo";

  // Reset student when group changes
  useEffect(() => {
    setSelectedStudent("");
  }, [selectedGroup]);

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSendWhatsApp = () => {
    console.log("Preparing WhatsApp delivery...");
    alert("Función de WhatsApp preparada: El PDF se generará y quedará listo para envío futuro.");
  };

  const generatePDF = async () => {
    if (!session) return;
    if (!selectedGroup) {
      alert("Por favor selecciona un grupo.");
      return;
    }
    if (reportType === "individual" && !selectedStudent) {
      alert("Por favor selecciona un estudiante.");
      return;
    }
    if (selectedSectionsCount === 0) {
      alert("Selecciona al menos una sección para incluir en el reporte.");
      return;
    }

    setLoading(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // 1. Header
      doc.setFontSize(22);
      doc.setTextColor(79, 70, 229); // indigo-600
      doc.text(appSettings.institutionName || "MI INSTITUCIÓN", 20, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Docente: ${appSettings.teacherName || "—"}`, 20, 32);
      doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 20, 37);

      const reportTitle = reportType === "grupal" 
        ? `REPORTE GRUPAL - ${currentGroupName}`
        : `REPORTE INDIVIDUAL - ${allStudents.find(s => s.id === Number(selectedStudent))?.name || "Estudiante"}`;
      
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(reportTitle.toUpperCase(), pageWidth / 2, 55, { align: "center" });

      let currentY = 65;

      // 2. Fetch and Render Sections
      const studentIds = reportType === "individual" 
        ? [Number(selectedStudent)]
        : filteredStudents.map(s => s.id);

      // ASISTENCIA
      if (sections.asistencia) {
        doc.setFontSize(12);
        doc.setTextColor(79, 70, 229);
        doc.text("RESUMEN DE ASISTENCIA", 20, currentY);
        currentY += 7;

        const { data: attendance } = await supabase
          .from("attendance_lessons")
          .select("student_id, status")
          .in("student_id", studentIds)
          .gte("attendance_date", fromDate)
          .lte("attendance_date", toDate);

        const attendanceMap: Record<number, { present: number, total: number }> = {};
        studentIds.forEach(id => attendanceMap[id] = { present: 0, total: 0 });
        
        attendance?.forEach(a => {
          if (attendanceMap[a.student_id]) {
            attendanceMap[a.student_id].total++;
            if (a.status === "Presente") attendanceMap[a.student_id].present++;
          }
        });

        const attendanceRows = studentIds.map(id => {
          const s = allStudents.find(st => st.id === id);
          const stats = attendanceMap[id];
          const pct = stats.total > 0 ? ((stats.present / stats.total) * 100).toFixed(1) : "0";
          return [s?.name || id, `${stats.present}/${stats.total}`, `${pct}%`];
        });

        autoTable(doc, {
          startY: currentY,
          head: [["Estudiante", "Presencias", "Porcentaje"]],
          body: attendanceRows,
          theme: "striped",
          headStyles: { fillColor: [79, 70, 229] },
          margin: { left: 20, right: 20 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      // ANECDOTARIO
      if (sections.anecdotario) {
        if (currentY > 230) { doc.addPage(); currentY = 25; }
        
        doc.setFontSize(12);
        doc.setTextColor(234, 88, 12); // orange-600
        doc.text("REGISTROS ANECDÓTICOS", 20, currentY);
        currentY += 7;

        const { data: records } = await supabase
          .from("anecdotal_records")
          .select("*")
          .in("student_id", studentIds)
          .gte("date", fromDate)
          .lte("date", toDate)
          .order("date", { ascending: false });

        const recordRows = (records || []).map(r => {
          const s = allStudents.find(st => st.id === r.student_id);
          return [
            new Date(r.date).toLocaleDateString(),
            reportType === "grupal" ? (s?.name || "—") : r.type,
            r.type,
            r.description
          ];
        });

        autoTable(doc, {
          startY: currentY,
          head: [["Fecha", reportType === "grupal" ? "Estudiante" : "Tipo", "Categoría", "Descripción"]],
          body: recordRows,
          theme: "grid",
          headStyles: { fillColor: [234, 88, 12] },
          margin: { left: 20, right: 20 },
          styles: { fontSize: 9 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      // NOTAS (Real Data with Breakdown)
      if (sections.notas) {
        if (currentY > 230) { doc.addPage(); currentY = 25; }
        doc.setFontSize(12);
        doc.setTextColor(5, 150, 105); // emerald-600
        doc.text("CALIFICACIONES", 20, currentY);
        currentY += 7;

        const activeRubrics = evaluationRubrics.filter(r => r.name && r.name.trim() !== "");
        const periodToLoad = academicPeriod === 'annual' ? 'semester1' : academicPeriod;
        
        // Fetch grades for the period
        const { data: gradesData } = await supabase
          .from("grades")
          .select("*")
          .in("student_id", studentIds)
          .eq("period", periodToLoad);

        // Map grades: { [studentId]: { [rubricId]: score } }
        const gradesMap: Record<number, Record<string, number>> = {};
        (gradesData || []).forEach(row => {
          if (!gradesMap[row.student_id]) gradesMap[row.student_id] = {};
          gradesMap[row.student_id][row.rubric_id] = row.score;
        });

        // Prepare Headers: [Estudiante, Rubro1, Rubro2..., Nota Final]
        const rubricHeaders = activeRubrics.map(r => `${r.name}\n(${r.percentage}%)`);
        const tableHeaders = ["Estudiante", ...rubricHeaders, "Nota Final"];

        // Prepare Body
        const gradesRows = studentIds.map(id => {
          const s = allStudents.find(st => st.id === id);
          const studentScores = gradesMap[id] || {};
          
          let totalFinal = 0;
          const rubricScores = activeRubrics.map(r => {
            const score = studentScores[r.id] ?? 0;
            totalFinal += (score * r.percentage) / 100;
            return score > 0 ? score.toString() : "0";
          });

          return [s?.name || id, ...rubricScores, totalFinal.toFixed(1)];
        });
        
        autoTable(doc, {
          startY: currentY,
          head: [tableHeaders],
          body: gradesRows,
          theme: "striped",
          headStyles: { fillColor: [5, 150, 105] },
          margin: { left: 20, right: 20 },
          styles: { fontSize: 8, cellPadding: 2 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      doc.save(`Reporte_${currentGroupName}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error("PDF Error:", error);
      alert("Error al generar el PDF. Revisa la consola.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="content-wrap" style={{ paddingBottom: "135px" }}>
      {/* Header Module */}
      <div style={{ background: "#fff", borderRadius: "24px", padding: "20px 24px", border: "1px solid #e2e8f0", marginBottom: "24px", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 4px 15px rgba(0,0,0,0.02)" }}>
        <div style={{ background: "#f5f3ff", padding: "12px", borderRadius: "16px", color: "#4f46e5" }}>
          <FileBarChart size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 850, color: "#0f172a", margin: 0 }}>Reportes</h1>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "32px", alignItems: "start" }}>
        
        {/* CONFIGURATOR CARD */}
        <div style={{ background: "#fff", borderRadius: "28px", border: "1px solid #e2e8f0", boxShadow: "0 10px 40px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          <div style={{ padding: "24px 32px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "12px" }}>
             <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#f5f3ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
               <FileCheck2 size={18} />
             </div>
             <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Configurador de Reporte</h2>
          </div>

          <div style={{ padding: "32px" }}>
            {/* 1. TIPO DE REPORTE */}
            <div style={{ marginBottom: "32px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>1. TIPO DE REPORTE</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <button 
                  onClick={() => setReportType("grupal")}
                  style={{
                    padding: "16px", borderRadius: "16px", border: "2px solid",
                    borderColor: reportType === "grupal" ? "#4f46e5" : "#e2e8f0",
                    background: reportType === "grupal" ? "#f5f3ff" : "#fff",
                    color: reportType === "grupal" ? "#4f46e5" : "#64748b",
                    fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "8px"
                  }}
                >
                  <Users size={24} />
                  Grupal
                </button>
                <button 
                  onClick={() => setReportType("individual")}
                  style={{
                    padding: "16px", borderRadius: "16px", border: "2px solid",
                    borderColor: reportType === "individual" ? "#4f46e5" : "#e2e8f0",
                    background: reportType === "individual" ? "#f5f3ff" : "#fff",
                    color: reportType === "individual" ? "#4f46e5" : "#64748b",
                    fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "8px"
                  }}
                >
                  <User size={24} />
                  Individual
                </button>
              </div>
            </div>

            {/* 2. SECCIONES A INCLUIR */}
            <div style={{ marginBottom: "32px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>2. SELECCIONE LOS ITEMS</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {[
                  { id: "asistencia", label: "Asistencia", icon: <CalendarCheck size={18} /> },
                  { id: "cotidiano", label: "Trabajo Cotidiano", icon: <NotebookPen size={18} /> },
                  { id: "notas", label: "Calificaciones Finales", icon: <StickyNote size={18} /> },
                  { id: "anecdotario", label: "Anecdotario / Incidentes", icon: <ScrollText size={18} /> },
                  { id: "planeamientos", label: "Planeamientos", icon: <FileText size={18} /> }
                ].map(section => (
                  <div 
                    key={section.id} 
                    onClick={() => toggleSection(section.id as any)}
                    style={{ 
                      padding: "12px 16px", borderRadius: "12px", border: "1px solid",
                      borderColor: (sections as any)[section.id] ? "#c7d2fe" : "#e2e8f0",
                      background: (sections as any)[section.id] ? "#f8faff" : "#fff",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: "12px",
                      transition: "all 0.2s"
                    }}
                  >
                    <div style={{ 
                      width: "20px", height: "20px", borderRadius: "6px", border: "2px solid",
                      borderColor: (sections as any)[section.id] ? "#4f46e5" : "#cbd5e1",
                      background: (sections as any)[section.id] ? "#4f46e5" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff"
                    }}>
                      {(sections as any)[section.id] && <CheckIcon />}
                    </div>
                    <div style={{ color: (sections as any)[section.id] ? "#4f46e5" : "#475569", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700 }}>
                      {section.icon}
                      {section.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: reportType === "individual" ? "1fr 1fr" : "1fr", gap: "20px", marginBottom: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>GRUPO</label>
                <select 
                  className="date-input" 
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(Number(e.target.value))}
                >
                  <option value="">Selecciona un grupo</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              {reportType === "individual" && (
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>ESTUDIANTE</label>
                  <select 
                    className="date-input"
                    value={selectedStudent}
                    onChange={e => setSelectedStudent(Number(e.target.value))}
                    disabled={!selectedGroup}
                  >
                    <option value="">Selecciona un estudiante</option>
                    {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* 4. RANGO DE FECHAS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>DESDE</label>
                <input 
                  type="date" 
                  className="date-input" 
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>HASTA</label>
                <input 
                  type="date" 
                  className="date-input" 
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* PREVIEW & ACTIONS COLUMN */}
        <div style={{ position: "sticky", top: "100px" }}>
          <div style={{ 
            background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", 
            borderRadius: "32px", border: "2px dashed #cbd5e1",
            padding: "48px 32px", textAlign: "center", minHeight: "340px",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
          }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)", color: "#4f46e5" }}>
              <FileText size={32} />
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 900, color: "#0f172a", marginBottom: "12px" }}>Vista Previa del Reporte</h3>
            <p style={{ color: "#64748b", fontSize: "15px", maxWidth: "280px", lineHeight: "1.6", fontWeight: 500, margin: "0 0 40px 0" }}>
              Se generará un documento PDF con <strong style={{color: "#4f46e5"}}>{selectedSectionsCount} secciones</strong>.
            </p>

            <div style={{ width: "100%", display: "grid", gap: "12px" }}>
              <button 
                onClick={generatePDF}
                disabled={loading}
                style={{ 
                  width: "100%", padding: "16px", borderRadius: "16px", background: "#4f46e5", 
                  color: "#fff", fontSize: "15px", fontWeight: 800, border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                  boxShadow: "0 10px 20px rgba(79, 70, 229, 0.25)", transition: "all 0.2s"
                }}
                className="hover:bg-indigo-700 active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                {loading ? "Generando Reporte..." : "Generar Reporte PDF"}
              </button>

              <button 
                onClick={handleSendWhatsApp}
                style={{ 
                  width: "100%", padding: "16px", borderRadius: "16px", background: "#10b981", 
                  color: "#fff", fontSize: "15px", fontWeight: 800, border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                  boxShadow: "0 10px 20px rgba(16, 185, 129, 0.2)", transition: "all 0.2s"
                }}
                className="hover:bg-emerald-600 active:scale-95"
              >
                <Send size={20} />
                Enviar por WhatsApp
              </button>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={12} 
      height={12} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={4} 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
