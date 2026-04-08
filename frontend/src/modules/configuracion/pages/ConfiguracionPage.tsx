import React, { useState, useMemo, useRef } from "react";
import { Save, Plus, Trash2, Building2, User, UploadCloud, Percent, AlertCircle, Check, Settings, Database, FileOutput, FileInput, ImagePlus, X, Copy, Shield, ChevronRight } from "lucide-react";

import { showAuthError } from "../../../utils/authError";

type EvaluationRubric = {
  id: string;
  name: string;
  percentage: number;
};

type AppSettings = {
  institutionName: string;
  teacherName: string;
  teacherEmail: string;
  logoUrl: string | null;
  evaluationRubrics: EvaluationRubric[];
};

type GroupInfo = {
  id: number;
  name: string;
};

type GroupConfig = {
  minimumPassingGrade: number;
};

type Props = {
  appSettings: AppSettings;
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  groups: GroupInfo[];
  selectedGroupId: number | null;
  groupConfigs: Record<number, GroupConfig>;
  setGroupConfigs: React.Dispatch<React.SetStateAction<Record<number, GroupConfig>>>;
  session?: any;
};

// ═══════════════════════════════════════
// CYCLE LOGIC
// ═══════════════════════════════════════

function getCycle(groupName: string): string {
  const match = groupName.match(/^(\d+)/);
  if (!match) return "Otro";
  const level = parseInt(match[1]);
  if (level >= 7 && level <= 9) return "III Ciclo";
  if (level >= 10 && level <= 12) return "Educación Diversificada";
  return "Otro";
}

export default function ConfiguracionPage({ appSettings, setAppSettings, groups, selectedGroupId, groupConfigs, setGroupConfigs, session }: Props) {
  const [localSettings, setLocalSettings] = useState<AppSettings>(appSettings);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedCopyGroups, setSelectedCopyGroups] = useState<number[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Current group config
  const currentConfig = selectedGroupId ? (groupConfigs[selectedGroupId] || { minimumPassingGrade: 65 }) : { minimumPassingGrade: 65 };
  const [localMinGrade, setLocalMinGrade] = useState<number>(currentConfig.minimumPassingGrade);

  // Reset local min grade when selected group changes
  React.useEffect(() => {
    const config = selectedGroupId ? (groupConfigs[selectedGroupId] || { minimumPassingGrade: 65 }) : { minimumPassingGrade: 65 };
    setLocalMinGrade(config.minimumPassingGrade);
  }, [selectedGroupId, groupConfigs]);

  const selectedGroupName = groups.find(g => g.id === selectedGroupId)?.name || "";
  const selectedCycle = getCycle(selectedGroupName);

  const totalPercentage = useMemo(() => {
    return localSettings.evaluationRubrics.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0);
  }, [localSettings.evaluationRubrics]);

  const handleSave = () => {
    if (!session?.user?.id) {
      showAuthError();
      return;
    }
    // Save global settings
    setAppSettings(localSettings);
    localStorage.setItem("gestion_docente_settings", JSON.stringify(localSettings));

    // Save per-group config
    if (selectedGroupId) {
      const clamped = Math.min(100, Math.max(0, localMinGrade || 0));
      const updated = { ...groupConfigs, [selectedGroupId]: { minimumPassingGrade: clamped } };
      setGroupConfigs(updated);
      localStorage.setItem("gestion_docente_group_configs", JSON.stringify(updated));
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const updateField = (field: keyof AppSettings, value: string | null | EvaluationRubric[]) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!session?.user?.id) {
      showAuthError();
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setImageError("Por favor selecciona un archivo de imagen válido.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setImageError("La imagen no debe exceder 2MB.");
      return;
    }

    setImageError(null);

    const reader = new FileReader();
    reader.onload = () => {
      updateField("logoUrl", reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const addRubric = () => {
    setLocalSettings(prev => ({
      ...prev,
      evaluationRubrics: [
        ...prev.evaluationRubrics,
        { id: `ev-${Date.now()}`, name: "NUEVO RUBRO", percentage: 0 }
      ]
    }));
  };

  const updateRubric = (id: string, field: "name" | "percentage", value: string | number) => {
    setLocalSettings(prev => ({
      ...prev,
      evaluationRubrics: prev.evaluationRubrics.map(r => 
        r.id === id ? { ...r, [field]: value } : r
      )
    }));
  };

  const removeRubric = (id: string) => {
    setLocalSettings(prev => ({
      ...prev,
      evaluationRubrics: prev.evaluationRubrics.filter(r => r.id !== id)
    }));
  };

  // Copy logic
  const openCopyModal = () => {
    setSelectedCopyGroups([]);
    setCopySuccess(false);
    setShowCopyModal(true);
  };

  const toggleCopyGroup = (gId: number) => {
    setSelectedCopyGroups(prev => prev.includes(gId) ? prev.filter(id => id !== gId) : [...prev, gId]);
  };

  const selectAllInCycle = (cycle: string) => {
    const cycleGroupIds = groups.filter(g => g.id !== selectedGroupId && getCycle(g.name) === cycle).map(g => g.id);
    const allSelected = cycleGroupIds.every(id => selectedCopyGroups.includes(id));
    if (allSelected) {
      setSelectedCopyGroups(prev => prev.filter(id => !cycleGroupIds.includes(id)));
    } else {
      setSelectedCopyGroups(prev => [...new Set([...prev, ...cycleGroupIds])]);
    }
  };

  const handleCopy = () => {
    if (!session?.user?.id) {
      showAuthError();
      return;
    }
    if (selectedCopyGroups.length === 0) return;
    const clamped = Math.min(100, Math.max(0, localMinGrade || 0));
    const updated = { ...groupConfigs };
    selectedCopyGroups.forEach(gId => {
      updated[gId] = { ...(updated[gId] || {}), minimumPassingGrade: clamped };
    });
    setGroupConfigs(updated);
    localStorage.setItem("gestion_docente_group_configs", JSON.stringify(updated));
    setCopySuccess(true);
    setTimeout(() => setShowCopyModal(false), 1200);
  };

  // Group cycles for copy modal
  const otherGroups = groups.filter(g => g.id !== selectedGroupId);
  const groupsByCycle = useMemo(() => {
    const map: Record<string, GroupInfo[]> = {};
    otherGroups.forEach(g => {
      const cycle = getCycle(g.name);
      if (!map[cycle]) map[cycle] = [];
      map[cycle].push(g);
    });
    return map;
  }, [otherGroups]);

  return (
    <div className="w-full px-4 sm:px-8 py-4 mx-auto max-w-[1600px] transition-all duration-300">

      {/* ═══════════════════════════════════════════════════════════
          HEADER — Consistent with Asistencia & Cotidiano modules 
          ═══════════════════════════════════════════════════════════ */}
      <div style={{ 
        position: "sticky", top: "84px", zIndex: 40, 
        background: "rgba(248, 250, 252, 0.95)", backdropFilter: "blur(12px)", 
        padding: "16px 0", borderBottom: "1px solid #e2e8f0", 
        display: "flex", alignItems: "center", justifyContent: "space-between", 
        marginBottom: "32px", margin: "-20px -20px 24px -20px", 
        paddingLeft: "20px", paddingRight: "20px" 
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {localSettings.logoUrl && (
            <img 
              src={localSettings.logoUrl} 
              alt="Logo Institución" 
              style={{ 
                width: "40px", height: "40px", borderRadius: "10px", 
                objectFit: "contain", border: "2px solid #e0e7ff",
                background: "#fff", padding: "2px"
              }} 
            />
          )}
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Configuración</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, background: "#e2e8f0", padding: "4px 10px", borderRadius: "8px", textTransform: "uppercase" }}>
                {localSettings.institutionName || "Preferencias del Sistema"}
              </span>
              {selectedGroupName && (
                <span style={{ fontSize: "12px", color: "#4f46e5", fontWeight: 700, background: "#e0e7ff", padding: "4px 10px", borderRadius: "8px" }}>
                  Grupo: {selectedGroupName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {saveSuccess && (
            <span style={{ fontSize: "14px", color: "#10b981", fontWeight: 700, animation: "fadeIn 0.3s ease-in" }}>
              ¡Cambios guardados!
            </span>
          )}
          <button 
            onClick={handleSave} 
            style={{ 
              display: "flex", alignItems: "center", gap: "6px",
              padding: "10px 24px", background: "#4f46e5", color: "#fff", 
              border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "14px", 
              cursor: "pointer", transition: "background 0.2s", 
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.2)" 
            }} 
            className="hover:bg-indigo-700"
          >
            <Save size={18} />
            Guardar Todo
          </button>
        </div>
      </div>


    

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: "24px", alignItems: "start" }}>
        
        {/* ═══════════════════════════════════════
            PANEL IZQUIERDO — Datos del docente 
            ═══════════════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Card: Institución y Docente */}
          <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #e2e8f0" }}>
             
             <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px", color: "#4f46e5" }}>
               <User size={18} />
               <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "#334155" }}>Institución y Docente</h3>
             </div>
             
             <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                
                {/* 1. Nombre del Docente */}
                <div>
                   <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "#94a3b8", marginBottom: "6px", textTransform: "uppercase" }}>Nombre del Docente</label>
                   <input 
                     type="text" 
                     value={localSettings.teacherName}
                     onChange={e => updateField("teacherName", e.target.value)}
                     placeholder="Ej. Docente"
                     style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none", color: "#0f172a", fontWeight: 500, background: "#f8fafc", transition: "all 0.2s" }}
                     onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.background = "#fff"; }}
                     onBlur={e => { e.target.style.borderColor = "#cbd5e1"; e.target.style.background = "#f8fafc"; }}
                   />
                </div>

                {/* 2. Correo MEP */}
                <div>
                   <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "#94a3b8", marginBottom: "6px", textTransform: "uppercase" }}>Correo MEP</label>
                   <input 
                     type="email" 
                     value={localSettings.teacherEmail}
                     onChange={e => updateField("teacherEmail", e.target.value)}
                     placeholder="usuario@mep.go.cr"
                     style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none", color: "#0f172a", fontWeight: 500, background: "#f8fafc", transition: "all 0.2s" }}
                     onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.background = "#fff"; }}
                     onBlur={e => { e.target.style.borderColor = "#cbd5e1"; e.target.style.background = "#f8fafc"; }}
                   />
                </div>

                {/* 3. Nombre de la Institución */}
                <div>
                   <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "#94a3b8", marginBottom: "6px", textTransform: "uppercase" }}>Institución</label>
                   <input 
                     type="text" 
                     value={localSettings.institutionName}
                     onChange={e => updateField("institutionName", e.target.value)}
                     placeholder="Ej. Mi Institución"
                     style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none", color: "#0f172a", fontWeight: 500, background: "#f8fafc", transition: "all 0.2s" }}
                     onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.background = "#fff"; }}
                     onBlur={e => { e.target.style.borderColor = "#cbd5e1"; e.target.style.background = "#f8fafc"; }}
                   />
                </div>
             </div>
          </div>

          {/* Card: Logo de la Institución */}
          <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #e2e8f0" }}>
             <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px", color: "#4f46e5" }}>
               <Building2 size={18} />
               <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "#334155" }}>Logo de la Institución</h3>
             </div>

             {localSettings.logoUrl ? (
               <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                 <div style={{ 
                   width: "120px", height: "120px", borderRadius: "16px", 
                   overflow: "hidden", border: "2px solid #e0e7ff", 
                   background: "#f8fafc", display: "flex", 
                   alignItems: "center", justifyContent: "center" 
                 }}>
                   <img 
                     src={localSettings.logoUrl} 
                     alt="Logo" 
                     style={{ width: "100%", height: "100%", objectFit: "contain", padding: "8px" }} 
                   />
                 </div>
                 <div style={{ display: "flex", gap: "12px" }}>
                   <button 
                     onClick={() => logoInputRef.current?.click()}
                     style={{ 
                       display: "flex", alignItems: "center", gap: "6px",
                       background: "#f8fafc", color: "#475569", padding: "8px 16px", 
                       borderRadius: "10px", fontWeight: 700, fontSize: "12px", 
                       border: "1px solid #cbd5e1", cursor: "pointer", transition: "all 0.2s" 
                     }}
                     className="hover:bg-slate-100"
                   >
                     <ImagePlus size={14} /> Cambiar
                   </button>
                   <button 
                     onClick={() => updateField("logoUrl", null)} 
                     style={{ 
                       display: "flex", alignItems: "center", gap: "6px",
                       background: "#fef2f2", color: "#ef4444", padding: "8px 16px",
                       borderRadius: "10px", fontWeight: 700, fontSize: "12px", 
                       border: "1px solid #fecaca", cursor: "pointer", transition: "all 0.2s" 
                     }}
                     className="hover:bg-red-100"
                   >
                     <X size={14} /> Eliminar
                   </button>
                 </div>
               </div>
             ) : (
               <div 
                 onClick={() => logoInputRef.current?.click()}
                 style={{ 
                   border: "2px dashed #cbd5e1", borderRadius: "16px", 
                   padding: "32px", display: "flex", flexDirection: "column",
                   alignItems: "center", justifyContent: "center", gap: "12px",
                   cursor: "pointer", transition: "all 0.2s", background: "#f8fafc"
                 }}
                 className="hover:border-indigo-400 hover:bg-indigo-50"
               >
                 <div style={{ 
                   width: "48px", height: "48px", borderRadius: "12px", 
                   background: "#eef2ff", display: "flex", 
                   alignItems: "center", justifyContent: "center" 
                 }}>
                   <UploadCloud size={24} color="#4f46e5" />
                 </div>
                 <span style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>
                   Haz clic para subir el logo
                 </span>
                 <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                   PNG, JPG o SVG (máx. 2MB)
                 </span>
               </div>
             )}
             
             <input 
               ref={logoInputRef}
               type="file" 
               accept="image/*" 
               style={{ display: "none" }} 
               onChange={handleLogoUpload} 
             />
          </div>

          {/* Card: Respaldo de Datos */}
          <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #e2e8f0" }}>
             <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", color: "#4f46e5" }}>
               <Database size={18} />
               <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "#334155" }}>Respaldo de Datos</h3>
             </div>
             <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "#4f46e5", color: "#fff", padding: "12px", borderRadius: "10px", fontWeight: 700, fontSize: "13px", border: "none", cursor: "pointer", transition: "all 0.2s" }} className="hover:bg-indigo-700">
                   <FileOutput size={16} /> Exportar JSON
                </button>
                <button style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "#f8fafc", color: "#475569", padding: "12px", borderRadius: "10px", fontWeight: 700, fontSize: "13px", border: "1px solid #cbd5e1", cursor: "pointer", transition: "all 0.2s" }} className="hover:bg-slate-100">
                   <FileInput size={16} /> Importar JSON
                </button>
             </div>
          </div>
        </div>


        {/* ═══════════════════════════════════════════
            PANEL DERECHO — Rúbricas de Evaluación
            ═══════════════════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* Card: Evaluación % */}
          <div style={{ background: "#fff", borderRadius: "16px", padding: "32px", border: "1px solid #e2e8f0", boxShadow: "0 4px 15px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>
            
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
               <div style={{ background: "#eef2ff", color: "#4f46e5", padding: "10px", borderRadius: "12px" }}>
                  <Percent size={20} />
               </div>
               <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#1e293b", margin: 0 }}>Evaluación (%)</h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", marginBottom: "32px", alignContent: "start" }}>
               {localSettings.evaluationRubrics.map((rubric) => (
                  <div key={rubric.id} className="group" style={{ position: "relative" }}>
                     <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <input 
                          type="text" 
                          value={rubric.name}
                          onChange={e => updateRubric(rubric.id, "name", e.target.value.toUpperCase())}
                          placeholder="NOMBRE"
                          style={{ background: "transparent", border: "none", borderBottom: "1px dashed transparent", fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", outline: "none", width: "100%", paddingBottom: "2px", transition: "all 0.2s" }}
                          onFocus={e => { e.target.style.color = "#4f46e5"; e.target.style.borderBottom = "1px dashed #cbd5e1"; }}
                          onBlur={e => { e.target.style.color = "#94a3b8"; e.target.style.borderBottom = "1px dashed transparent"; }}
                        />
                        <button 
                          onClick={() => removeRubric(rubric.id)}
                          title="Eliminar"
                          style={{ background: "transparent", color: "#ef4444", border: "none", cursor: "pointer", padding: "4px", opacity: 0, transition: "opacity 0.2s", position: "absolute", right: -8, top: -4 }}
                          className="group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                     </div>
                     
                     <input 
                       type="number"
                       value={rubric.percentage === 0 ? "" : rubric.percentage}
                       onChange={e => updateRubric(rubric.id, "percentage", parseFloat(e.target.value) || 0)}
                       placeholder="0"
                       style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #cbd5e1", fontSize: "16px", fontWeight: 600, color: "#0f172a", outline: "none", background: "#f8fafc", transition: "all 0.2s" }}
                       onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.background = "#fff"; }}
                       onBlur={e => { e.target.style.borderColor = "#cbd5e1"; e.target.style.background = "#f8fafc"; }}
                     />
                  </div>
               ))}

               <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button 
                    onClick={addRubric}
                    style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "2px dashed #cbd5e1", background: "transparent", color: "#64748b", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", height: "46px" }}
                    className="hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50"
                  >
                    <Plus size={16} strokeWidth={3} /> Agregar
                  </button>
               </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: "24px" }}>
               <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ fontSize: "16px", fontWeight: 800, color: "#475569" }}>Total:</span>
                  <span style={{ fontSize: "18px", fontWeight: 800, color: totalPercentage === 100 ? "#10b981" : "#ef4444" }}>
                     {totalPercentage.toFixed(1)}%
                  </span>
                  {totalPercentage !== 100 && (
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#ef4444", marginLeft: "8px" }}>(Debe ser 100%)</span>
                  )}
               </div>

               <button 
                 onClick={handleSave} 
                 style={{ padding: "12px 32px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: "12px", fontWeight: 700, fontSize: "14px", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.2)" }} 
                 className="hover:bg-indigo-700"
               >
                  Guardar
               </button>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              Card: Nota Mínima de Aprobación
              ═══════════════════════════════════════════ */}
          <div style={{ background: "#fff", borderRadius: "16px", padding: "28px", border: "1px solid #e2e8f0", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ background: "#fef3c7", color: "#d97706", padding: "10px", borderRadius: "12px" }}>
                  <Shield size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#1e293b", margin: 0 }}>Nota Mínima de Aprobación</h2>
                  <p style={{ fontSize: "12px", color: "#94a3b8", margin: "2px 0 0 0", fontWeight: 500 }}>
                    {selectedGroupName ? `Grupo ${selectedGroupName}` : "Selecciona un grupo"} 
                    {selectedCycle !== "Otro" && <span style={{ color: "#d97706", fontWeight: 700 }}> · {selectedCycle}</span>}
                  </p>
                </div>
              </div>

              {selectedGroupId && otherGroups.length > 0 && (
                <button
                  onClick={openCopyModal}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "9px 16px", background: "#fffbeb", color: "#92400e",
                    border: "1px solid #fde68a", borderRadius: "10px",
                    fontWeight: 700, fontSize: "12px", cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  className="hover:bg-amber-100"
                >
                  <Copy size={14} /> Copiar a otros grupos
                </button>
              )}
            </div>

            {selectedGroupId ? (
              <div style={{ display: "flex", alignItems: "flex-end", gap: "16px" }}>
                <div style={{ flex: 1, maxWidth: "200px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "#94a3b8", marginBottom: "6px", textTransform: "uppercase" }}>
                    Nota mínima
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={localMinGrade}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setLocalMinGrade(isNaN(val) ? 0 : Math.min(100, Math.max(0, val)));
                      }}
                      style={{
                        width: "100%", padding: "14px 40px 14px 16px", borderRadius: "12px",
                        border: "2px solid #fde68a", fontSize: "24px", fontWeight: 800,
                        color: "#92400e", outline: "none", background: "#fffbeb",
                        transition: "all 0.2s", textAlign: "center"
                      }}
                      onFocus={e => { e.target.style.borderColor = "#d97706"; e.target.style.boxShadow = "0 0 0 3px rgba(217, 119, 6, 0.1)"; }}
                      onBlur={e => { e.target.style.borderColor = "#fde68a"; e.target.style.boxShadow = "none"; }}
                    />
                    <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", fontWeight: 800, color: "#d97706", pointerEvents: "none" }}>
                      pts
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.5, margin: 0 }}>
                    Define la nota mínima para aprobar en este grupo. 
                    Puede variar según modalidad académica, colegio técnico, CINDEA u otras modalidades del MEP.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{
                padding: "24px", background: "#f8fafc", borderRadius: "12px",
                border: "1px dashed #cbd5e1", textAlign: "center"
              }}>
                <p style={{ fontSize: "14px", color: "#94a3b8", fontWeight: 600, margin: 0 }}>
                  Selecciona un grupo en la barra lateral para configurar la nota mínima de aprobación.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>


      {/* ═══════════════════════════════════════════
          MODAL: Copiar Nota Mínima a Otros Grupos
          ═══════════════════════════════════════════ */}
      {showCopyModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px"
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowCopyModal(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: "24px",
            width: "100%", maxWidth: "480px",
            boxShadow: "0 25px 60px rgba(15, 23, 42, 0.2)",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            animation: "fadeInModal 0.2s ease-out"
          }}>

            {/* Header */}
            <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <div style={{ background: "#fef3c7", color: "#d97706", padding: "8px", borderRadius: "10px" }}>
                    <Copy size={20} />
                  </div>
                  <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Copiar Nota Mínima</h2>
                </div>
                <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0 0", fontWeight: 500 }}>
                  Aplicar <strong style={{ color: "#92400e" }}>{localMinGrade} pts</strong> desde {selectedGroupName} a otros grupos
                </p>
              </div>
              <button
                onClick={() => setShowCopyModal(false)}
                style={{ background: "#f1f5f9", border: "none", borderRadius: "10px", cursor: "pointer", padding: "8px", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Groups List */}
            <div style={{ padding: "16px 28px", maxHeight: "360px", overflowY: "auto" }}>
              {copySuccess ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "2px solid #a7f3d0" }}>
                    <Check size={28} color="#10b981" strokeWidth={3} />
                  </div>
                  <p style={{ fontSize: "16px", fontWeight: 700, color: "#065f46" }}>¡Copiado exitosamente!</p>
                  <p style={{ fontSize: "13px", color: "#6ee7b7" }}>{selectedCopyGroups.length} grupo(s) actualizados</p>
                </div>
              ) : (
                Object.entries(groupsByCycle).map(([cycle, cycleGroups]) => (
                  <div key={cycle} style={{ marginBottom: "16px" }}>
                    <div
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        marginBottom: "8px", cursor: "pointer"
                      }}
                      onClick={() => selectAllInCycle(cycle)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{
                          fontSize: "11px", fontWeight: 800, color: cycle === selectedCycle ? "#d97706" : "#64748b",
                          textTransform: "uppercase", letterSpacing: "0.05em"
                        }}>
                          {cycle}
                        </span>
                        {cycle === selectedCycle && (
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "#d97706", background: "#fef3c7", padding: "2px 8px", borderRadius: "6px" }}>
                            Mismo ciclo
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
                        seleccionar todo
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {cycleGroups.map(g => {
                        const isChecked = selectedCopyGroups.includes(g.id);
                        const existingMin = groupConfigs[g.id]?.minimumPassingGrade;
                        return (
                          <div
                            key={g.id}
                            onClick={() => toggleCopyGroup(g.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: "12px",
                              padding: "10px 14px", borderRadius: "10px",
                              border: isChecked ? "1px solid #fde68a" : "1px solid #e2e8f0",
                              background: isChecked ? "#fffbeb" : "#f8fafc",
                              cursor: "pointer", transition: "all 0.15s"
                            }}
                          >
                            <div style={{
                              width: "20px", height: "20px", borderRadius: "6px",
                              border: isChecked ? "2px solid #d97706" : "2px solid #cbd5e1",
                              background: isChecked ? "#d97706" : "#fff",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.15s", flexShrink: 0
                            }}>
                              {isChecked && <Check size={12} color="#fff" strokeWidth={3} />}
                            </div>
                            <span style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", flex: 1 }}>
                              {g.name}
                            </span>
                            {existingMin !== undefined && (
                              <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
                                actual: {existingMin}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {!copySuccess && (
              <div style={{
                padding: "16px 28px", borderTop: "1px solid #f1f5f9",
                background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#64748b" }}>
                  {selectedCopyGroups.length} seleccionado(s)
                </span>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => setShowCopyModal(false)}
                    style={{ padding: "10px 18px", background: "#fff", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "10px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCopy}
                    disabled={selectedCopyGroups.length === 0}
                    style={{
                      padding: "10px 24px", background: selectedCopyGroups.length > 0 ? "#d97706" : "#e2e8f0",
                      color: selectedCopyGroups.length > 0 ? "#fff" : "#94a3b8",
                      border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "13px",
                      cursor: selectedCopyGroups.length > 0 ? "pointer" : "not-allowed",
                      boxShadow: selectedCopyGroups.length > 0 ? "0 4px 12px rgba(217, 119, 6, 0.2)" : "none"
                    }}
                  >
                    Aplicar a {selectedCopyGroups.length} grupo(s)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Animation */}
      <style>{`
        @keyframes fadeInModal {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
