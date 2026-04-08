import React, { useState, useMemo } from "react";
import { Plus, Trash2, Check, Sparkles, Save, FilePlus, Copy } from "lucide-react";
import { showAuthError } from "../../../utils/authError";

type Level = {
  id: string;
  name: string;
  points: number;
};

type Indicator = {
  id: string;
  text: string;
  levels: Record<string, string>; // Maps level id to description
  selectedLevelId: string | null;
};

type Rubric = {
  id: string;
  name: string;
  date: string;
  levels: Level[];
  indicators: Indicator[];
};

export default function CotidianoPage({ 
  session, 
  students = [], 
  selectedGroupId, 
  groupName 
}: { 
  session?: any; 
  students?: any[]; 
  selectedGroupId?: number | null; 
  groupName?: string; 
}) {
  const [selectedStudentId, setSelectedStudentId] = useState<number | "">("");
  const [rubrics, setRubrics] = useState<Rubric[]>([
    {
      id: `rubric-${Date.now()}`,
      name: "",
      date: "",
      levels: [
        { id: "l1", name: "Excelente", points: 3 },
        { id: "l2", name: "Bueno", points: 2 },
        { id: "l3", name: "Reconoce", points: 1 },
      ],
      indicators: [
        {
          id: `ind-${Date.now()}`,
          text: "Reconoce las ideas principales del tema asignado...",
          levels: { l1: "", l2: "", l3: "" },
          selectedLevelId: null
        }
      ]
    }
  ]);

  const addRubric = () => {
    setRubrics([
      ...rubrics,
      {
        id: `rubric-${Date.now()}`,
        name: "",
        date: "",
        levels: [
          { id: "l1", name: "Excelente", points: 3 },
          { id: "l2", name: "Bueno", points: 2 },
          { id: "l3", name: "Reconoce", points: 1 },
        ],
        indicators: [
          {
            id: `ind-${Date.now()}`,
            text: "",
            levels: { l1: "", l2: "", l3: "" },
            selectedLevelId: null
          }
        ]
      }
    ]);
  };

  const removeRubric = (rId: string) => {
    if (rubrics.length <= 1) return;
    if (window.confirm("¿Estás seguro de eliminar esta rúbrica completa?")) {
      setRubrics(rubrics.filter(r => r.id !== rId));
    }
  };

  const updateRubricField = (rId: string, field: "name" | "date", value: string) => {
    setRubrics(rubrics.map(r => r.id === rId ? { ...r, [field]: value } : r));
  };

  const addLevel = (rId: string) => {
    setRubrics(rubrics.map(r => {
      if (r.id !== rId) return r;
      const newId = `l${Date.now()}`;
      return {
        ...r,
        levels: [...r.levels, { id: newId, name: "Nuevo Nivel", points: 0 }],
        indicators: r.indicators.map(ind => ({
          ...ind,
          levels: { ...ind.levels, [newId]: "" }
        }))
      };
    }));
  };

  const removeLevel = (rId: string, levelId: string) => {
    setRubrics(rubrics.map(r => {
      if (r.id !== rId || r.levels.length <= 1) return r;
      return {
        ...r,
        levels: r.levels.filter(l => l.id !== levelId),
        indicators: r.indicators.map(ind => {
          const newLevels = { ...ind.levels };
          delete newLevels[levelId];
          return {
            ...ind,
            levels: newLevels,
            selectedLevelId: ind.selectedLevelId === levelId ? null : ind.selectedLevelId
          };
        })
      };
    }));
  };

  const updateLevel = (rId: string, levelId: string, field: "name" | "points", value: string | number) => {
    setRubrics(rubrics.map(r => {
      if (r.id !== rId) return r;
      return {
        ...r,
        levels: r.levels.map(l => l.id === levelId ? { ...l, [field]: value } : l)
      };
    }));
  };

  const addIndicator = (rId: string) => {
    setRubrics(rubrics.map(r => {
      if (r.id !== rId) return r;
      const newLevelsRecord: Record<string, string> = {};
      r.levels.forEach(l => newLevelsRecord[l.id] = "");
      return {
        ...r,
        indicators: [...r.indicators, {
          id: `ind-${Date.now()}`,
          text: "",
          levels: newLevelsRecord,
          selectedLevelId: null
        }]
      };
    }));
  };

  const removeIndicator = (rId: string, indId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRubrics(rubrics.map(r => {
      if (r.id !== rId || r.indicators.length <= 1) return r;
      return {
        ...r,
        indicators: r.indicators.filter(ind => ind.id !== indId)
      };
    }));
  };

  const updateIndicatorText = (rId: string, indId: string, text: string) => {
    setRubrics(rubrics.map(r => {
      if (r.id !== rId) return r;
      return {
        ...r,
        indicators: r.indicators.map(ind => ind.id === indId ? { ...ind, text } : ind)
      };
    }));
  };

  const updateIndicatorLevelDesc = (rId: string, indId: string, levelId: string, desc: string) => {
    setRubrics(rubrics.map(r => {
      if (r.id !== rId) return r;
      return {
        ...r,
        indicators: r.indicators.map(ind => {
          if (ind.id === indId) {
            return {
              ...ind,
              levels: { ...ind.levels, [levelId]: desc }
            };
          }
          return ind;
        })
      };
    }));
  };

  const toggleIndicatorLevel = (rId: string, indId: string, levelId: string) => {
    setRubrics(rubrics.map(r => {
      if (r.id !== rId) return r;
      return {
        ...r,
        indicators: r.indicators.map(ind => 
          ind.id === indId ? { ...ind, selectedLevelId: ind.selectedLevelId === levelId ? null : levelId } : ind
        )
      };
    }));
  };

  const handleSaveTodo = () => {
    if (!session?.user?.id) {
      showAuthError();
      return;
    }
    // Local persistence logic for this phase
    console.log("Guardando rúbricas localmente para piloto:", rubrics);
    // En una fase posterior aquí iría el map y upsert a Supabase
  };

  // Global calculations
  const globalTotals = useMemo(() => {
    let max = 0;
    let obtained = 0;
    rubrics.forEach(r => {
      const maxLvlPts = r.levels.length > 0 ? Math.max(...r.levels.map(l => l.points)) : 0;
      max += r.indicators.length * maxLvlPts;
      r.indicators.forEach(ind => {
        if (ind.selectedLevelId) {
          const lvl = r.levels.find(l => l.id === ind.selectedLevelId);
          obtained += lvl ? lvl.points : 0;
        }
      });
    });
    return { max, obtained };
  }, [rubrics]);

  // Student context
  const selectedStudent = useMemo(() => {
    return students.find(s => s.id === Number(selectedStudentId));
  }, [students, selectedStudentId]);

  return (
    <section className="content-wrap" style={{ position: "relative", zIndex: 1, paddingBottom: "100px" }}>
      
      {/* Top action bar: Sticky for easy access */}
      <div style={{ position: "sticky", top: "84px", zIndex: 40, background: "rgba(248, 250, 252, 0.95)", backdropFilter: "blur(12px)", padding: "16px 0", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px", margin: "-20px -20px 24px -20px", paddingLeft: "20px", paddingRight: "20px" }}>
         <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
             <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Cotidiano</h1>
             <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, background: "#e2e8f0", padding: "4px 10px", borderRadius: "8px", textTransform: "uppercase" }}>Diseñador de Rúbricas</span>
         </div>
         
         {/* Global totals summary */}
         <div style={{ display: "flex", alignItems: "center", gap: "24px", background: "#fff", padding: "8px 24px", borderRadius: "100px", border: "2px solid #e0e7ff", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.08)" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Acumulado Global</span>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#4f46e5", display: "flex", alignItems: "baseline", gap: "4px" }}>
              {globalTotals.obtained} <span style={{ fontSize: "14px", color: "#94a3b8", fontWeight: 700 }}>/ {globalTotals.max} pts</span>
            </div>
         </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ position: "relative", minWidth: "240px" }}>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value === "" ? "" : Number(e.target.value))}
                style={{
                  width: "100%", padding: "10px 16px", borderRadius: "10px",
                  border: "2px solid", borderColor: selectedStudentId ? "#4f46e5" : "#cbd5e1",
                  fontSize: "14px", fontWeight: 700, outline: "none", cursor: "pointer",
                  background: "#fff", color: "#0f172a"
                }}
              >
                <option value="">Seleccionar Estudiante...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <button onClick={addRubric} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 18px", background: "#fff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "10px", fontWeight: 700, fontSize: "14px", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }} className="hover:bg-slate-50 hover:border-slate-400">
              <Plus size={18} />
              Nueva Rúbrica
            </button>
            <button 
              onClick={handleSaveTodo}
              disabled={!selectedStudentId}
              style={{ 
                display: "flex", alignItems: "center", gap: "6px", 
                padding: "10px 24px", background: selectedStudentId ? "#4f46e5" : "#94a3b8", 
                color: "#fff", border: "none", borderRadius: "10px", 
                fontWeight: 700, fontSize: "14px", 
                cursor: selectedStudentId ? "pointer" : "not-allowed", 
                transition: "background 0.2s", 
                boxShadow: selectedStudentId ? "0 4px 12px rgba(79, 70, 229, 0.2)" : "none" 
              }} 
              className={selectedStudentId ? "hover:bg-indigo-700" : ""}
            >
               <Save size={18} />
               Guardar Evaluación
            </button>
          </div>
        </div>

        {/* Identity Banner: Lavender / Indigo Suave - Sticky for visibility during scroll */}
        {selectedStudent && (
          <div style={{
            position: "sticky",
            top: "155px", // Positions it right below the main sticky header (84px + header height)
            zIndex: 39,
            background: "rgba(245, 243, 255, 0.9)",
            backdropFilter: "blur(8px)",
            border: "1px solid #ddd6fe",
            borderRadius: "16px",
            padding: "10px 24px",
            marginBottom: "32px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 4px 15px rgba(79, 70, 229, 0.08)",
            transition: "all 0.2s"
          }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#4f46e5", boxShadow: "0 0 8px rgba(79, 70, 229, 0.4)" }}></div>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Evaluando a:</span>
            <span style={{ fontSize: "18px", fontWeight: 900, color: "#4f46e5", letterSpacing: "-0.01em" }}>{selectedStudent.name}</span>
            {selectedStudent.cedula && (
              <span style={{ fontSize: "14px", color: "#94a3b8", fontWeight: 700, background: "#fff", padding: "2px 10px", borderRadius: "8px", marginLeft: "8px", border: "1px solid #e2e8f0" }}>{selectedStudent.cedula}</span>
            )}
          </div>
        )}

      <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
        {rubrics.map((rubric, rIndex) => {
          
          const maxPts = rubric.levels.length > 0 ? Math.max(...rubric.levels.map(l => l.points)) : 0;
          const rMaxTotal = rubric.indicators.length * maxPts;
          const rObtained = rubric.indicators.reduce((acc, ind) => {
            if (!ind.selectedLevelId) return acc;
            const lvl = rubric.levels.find(l => l.id === ind.selectedLevelId);
            return acc + (lvl ? lvl.points : 0);
          }, 0);

          return (
            <div key={rubric.id} style={{ background: "#fff", borderRadius: "20px", boxShadow: "0 8px 30px rgba(15,23,42,0.06)", border: "1px solid #cbd5e1", overflow: "hidden" }}>
              
              {/* Header Section with higher contrast */}
              <div style={{ background: "#f8fafc", padding: "24px 32px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "24px", alignItems: "flex-end", position: "relative" }}>
                  <div style={{ position: "absolute", top: "16px", left: "24px", fontSize: "12px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>
                    Rúbrica {rIndex + 1}
                  </div>
                  
                  {rubrics.length > 1 && (
                    <button 
                      onClick={() => removeRubric(rubric.id)}
                      title="Eliminar Rúbrica Completa"
                      style={{ position: "absolute", top: "16px", right: "24px", padding: "8px", background: "#fee2e2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700 }}
                      className="hover:bg-red-200"
                    >
                      <Trash2 size={14} /> Eliminar
                    </button>
                  )}

                  <div style={{ flex: 1, marginTop: "16px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 800, color: "#334155", marginBottom: "8px" }}>TEMA O NOMBRE DE LA RÚBRICA</label>
                    <input 
                      type="text" 
                      value={rubric.name}
                      onChange={e => updateRubricField(rubric.id, "name", e.target.value)}
                      placeholder="Ej. Proyecto de Ciencias Naturales..."
                      style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "2px solid #cbd5e1", fontSize: "16px", outline: "none", transition: "all 0.2s", background: "#fff", color: "#0f172a", fontWeight: 600 }}
                      onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.1)"; }}
                      onBlur={e => e.target.style.borderColor = "#cbd5e1"}
                    />
                  </div>
                  <div style={{ width: "240px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 800, color: "#334155", marginBottom: "8px" }}>FECHA</label>
                    <input 
                      type="date"
                      value={rubric.date}
                      onChange={e => updateRubricField(rubric.id, "date", e.target.value)}
                      style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "2px solid #cbd5e1", fontSize: "16px", outline: "none", transition: "all 0.2s", background: "#fff", color: "#0f172a", fontWeight: 600 }}
                      onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.1)"; }}
                      onBlur={e => e.target.style.borderColor = "#cbd5e1"}
                    />
                  </div>
              </div>

              {/* Rubric Body */}
              <div style={{ overflowX: "auto", padding: "24px 32px" }}>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: `${380 + rubric.levels.length * 180}px` }}>
                  
                  {/* Headers row (Levels) */}
                  <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", marginBottom: "8px" }}>
                    <div style={{ width: "280px", flexShrink: 0, paddingLeft: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: "13px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>Indicadores de Aprendizaje</div>
                    </div>
                    
                    {rubric.levels.map(level => (
                      <div key={level.id} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", background: "#f1f5f9", padding: "12px", borderRadius: "12px", border: "2px solid #e2e8f0", position: "relative", alignItems: "center" }}>
                        <button 
                          onClick={() => removeLevel(rubric.id, level.id)}
                          title="Eliminar este desempeño"
                          style={{ position: "absolute", top: "-10px", right: "-10px", width: "24px", height: "24px", borderRadius: "50%", background: "#ef4444", color: "#fff", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: rubric.levels.length > 1 ? 1 : 0, pointerEvents: rubric.levels.length > 1 ? "auto" : "none", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}
                          className="hover:scale-110 transition-transform"
                        >
                          <Trash2 size={12} strokeWidth={3} />
                        </button>
                        <input 
                          type="text" 
                          value={level.name}
                          onChange={e => updateLevel(rubric.id, level.id, "name", e.target.value)}
                          placeholder="Nivel"
                          style={{ background: "transparent", border: "none", fontSize: "15px", fontWeight: 800, color: "#1e293b", textAlign: "center", outline: "none", width: "100%" }}
                        />
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", background: "#fff", padding: "4px 8px", borderRadius: "8px", border: "1px solid #cbd5e1", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)" }}>
                          <input 
                            type="number"
                            value={level.points === 0 ? "" : level.points}
                            onChange={e => updateLevel(rubric.id, level.id, "points", parseInt(e.target.value) || 0)}
                            placeholder="0"
                            style={{ width: "36px", textAlign: "center", border: "none", fontWeight: 800, color: "#4f46e5", outline: "none", fontSize: "14px", background: "transparent" }}
                          />
                          <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Pts</span>
                        </div>
                      </div>
                    ))}
                    
                    <div style={{ width: "40px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: "12px" }}>
                      <button onClick={() => addLevel(rubric.id)} title="Añadir nivel de desempeño" style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#e0e7ff", color: "#4f46e5", border: "1px solid #c7d2fe", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }} className="hover:scale-105 hover:bg-indigo-200">
                        <Plus size={20} strokeWidth={3} />
                      </button>
                    </div>

                    {/* Puntos indicator col */}
                    <div style={{ width: "80px", flexShrink: 0, textAlign: "center", paddingBottom: "12px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>Puntos</div>
                    </div>
                  </div>

                  {/* Indicators Rows */}
                  {rubric.indicators.map((ind, index) => (
                    <div key={ind.id} style={{ display: "flex", gap: "16px", alignItems: "stretch", transition: "all 0.2s", background: ind.selectedLevelId ? "#f8fafc" : "#fff", padding: "12px", borderRadius: "16px", border: ind.selectedLevelId ? "1px solid #cbd5e1" : "1px solid #e2e8f0" }} className="group hover:bg-slate-50">
                      
                      {/* Indicator text */}
                      <div style={{ width: "280px", flexShrink: 0, position: "relative" }}>
                        <div style={{ position: "absolute", left: "-26px", top: "14px", color: "#94a3b8", fontWeight: 800, fontSize: "15px", textAlign: "right", width: "16px" }}>{index + 1}.</div>
                        <textarea
                          value={ind.text}
                          placeholder="Escribe el indicador esperado..."
                          onChange={e => updateIndicatorText(rubric.id, ind.id, e.target.value)}
                          style={{ width: "100%", height: "100%", minHeight: "70px", padding: "12px", borderRadius: "10px", border: "1px solid #94a3b8", fontSize: "14px", resize: "none", background: "#fff", outline: "none", color: "#0f172a", lineHeight: 1.5, fontWeight: 600, boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)" }}
                          onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.1)"; }}
                          onBlur={e => e.target.style.borderColor = "#94a3b8"}
                        />
                      </div>
                      
                      {/* Levels cells */}
                      {rubric.levels.map(level => {
                        const isSelected = ind.selectedLevelId === level.id;
                        return (
                          <div 
                            key={level.id} 
                            onClick={() => toggleIndicatorLevel(rubric.id, ind.id, level.id)}
                            style={{ 
                              flex: 1, 
                              padding: "10px", 
                              borderRadius: "12px", 
                              border: isSelected ? "2px solid #6366f1" : "1px solid #cbd5e1",
                              background: isSelected ? "#eef2ff" : "#f8fafc",
                              cursor: "pointer",
                              transition: "all 0.15s ease-in-out",
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              boxShadow: isSelected ? "0 4px 12px rgba(99, 102, 241, 0.2)" : "inset 0 2px 4px rgba(0,0,0,0.02)"
                            }}
                            className={!isSelected ? "hover:border-indigo-300 hover:bg-indigo-50" : ""}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "12px", fontWeight: 800, color: isSelected ? "#4f46e5" : "#64748b", textTransform: "uppercase" }}>{level.name}</span>
                              {isSelected && <Check size={16} color="#4f46e5" strokeWidth={4} />}
                            </div>
                            <textarea 
                              value={ind.levels[level.id] || ""}
                              onChange={e => updateIndicatorLevelDesc(rubric.id, ind.id, level.id, e.target.value)}
                              onClick={e => e.stopPropagation()}
                              placeholder={`Conducta en ${level.name}...`}
                              style={{ width: "100%", flex: 1, minHeight: "50px", padding: "8px", borderRadius: "8px", border: "1px dashed #cbd5e1", fontSize: "13px", resize: "none", background: "#fff", outline: "none", color: isSelected ? "#312e81" : "#334155", lineHeight: 1.4, transition: "all 0.2s" }}
                              onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.borderStyle = "solid"; }}
                              onBlur={e => { e.target.style.borderColor = "#cbd5e1"; e.target.style.borderStyle = "dashed"; }}
                            />
                          </div>
                        );
                      })}
                      
                      <div style={{ width: "40px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", alignItems: "center" }}>
                            <button 
                              onClick={(e) => removeIndicator(rubric.id, ind.id, e)}
                              title="Eliminar fila"
                              style={{ color: "#ef4444", background: "#fee2e2", border: "1px solid #fecaca", cursor: "pointer", padding: "8px", borderRadius: "10px", transition: "all 0.2s", pointerEvents: rubric.indicators.length > 1 ? "auto" : "none", opacity: rubric.indicators.length > 1 ? 1 : 0.3 }}
                              className="hover:bg-red-200"
                            >
                              <Trash2 size={16} />
                            </button>
                        </div>
                      </div>

                      {/* Score individual per row */}
                      <div style={{ width: "80px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyItems: "center", justifyContent: "center", background: ind.selectedLevelId ? "#fff" : "#f1f5f9", borderRadius: "12px", border: ind.selectedLevelId ? "2px solid #e0e7ff" : "1px solid #cbd5e1", boxShadow: ind.selectedLevelId ? "0 4px 6px rgba(0,0,0,0.05)" : "inset 0 2px 4px rgba(0,0,0,0.05)" }}>
                        <span style={{ fontSize: "26px", fontWeight: 800, color: ind.selectedLevelId ? "#4f46e5" : "#94a3b8", lineHeight: 1 }}>
                          {ind.selectedLevelId ? rubric.levels.find(l => l.id === ind.selectedLevelId)?.points || 0 : "-"}
                        </span>
                        <span style={{ fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginTop: "6px" }}>Pts</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-start", paddingLeft: "12px" }}>
                  <button 
                    onClick={() => addIndicator(rubric.id)}
                    style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f8fafc", border: "2px dashed #94a3b8", color: "#475569", padding: "12px 24px", borderRadius: "12px", fontWeight: 700, fontSize: "14px", cursor: "pointer", transition: "all 0.2s" }}
                    className="hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50"
                  >
                    <Plus size={18} strokeWidth={3} />
                    Agregar Fila de Indicador
                  </button>
                </div>
              </div>

              {/* Rubric Footer Totals */}
              <div style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "32px" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Indicadores Totales</span>
                    <span style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>{rubric.indicators.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Puntos Posibles</span>
                    <span style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>{rMaxTotal} pts</span>
                  </div>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Total de esta Rúbrica</span>
                  <div style={{ background: "#4f46e5", color: "#fff", padding: "10px 24px", borderRadius: "12px", fontSize: "24px", fontWeight: 800, boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)" }}>
                    {rObtained} <span style={{ fontSize: "14px", opacity: 0.8, fontWeight: 600 }}>/ {rMaxTotal}</span>
                  </div>
                </div>
              </div>

            </div>
          );
        })}
      </div>
      
    </section>
  );
}
