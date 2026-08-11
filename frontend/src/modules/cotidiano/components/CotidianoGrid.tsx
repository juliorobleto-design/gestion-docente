import React, { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Trash2, Edit2, Save, Loader2, Copy } from "lucide-react";
import { supabase } from "../../../supabaseClient";
import { buildStudentDisplayName } from "../../../utils/studentName";

type CotidianoCol = {
  id: string;
  name: string;
  type: "pts" | "pct";
  date?: string; // Fecha del cotidiano (ISO: YYYY-MM-DD)
};

type CellData = {
  value: number | "";
};

type GridData = {
  [studentId: number]: {
    [colId: string]: CellData;
  };
};

export default function CotidianoGrid({ 
  students, 
  session,
  selectedGroupId,
  academicPeriod,
  evaluationRubrics = [],
  groups = []
}: { 
  students: any[]; 
  session?: any;
  selectedGroupId?: number | null;
  academicPeriod?: 'semester1' | 'semester2' | 'annual';
  evaluationRubrics?: { id: string; name: string; percentage: number }[];
  groups?: { id: number; name: string }[];
}) {
  const [columns, setColumns] = useState<CotidianoCol[]>([]);
  const [configId, setConfigId] = useState<string | null>(null);
  const [gridData, setGridData] = useState<GridData>({});
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [tempColName, setTempColName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyTargetGroup, setCopyTargetGroup] = useState<number | "">("");
  const [isCopying, setIsCopying] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);
  const columnsRef = useRef(columns);
  const gridDataRef = useRef(gridData);
  const configIdRef = useRef(configId);

  // Mantener refs sincronizados con estado
  useEffect(() => { columnsRef.current = columns; }, [columns]);
  useEffect(() => { gridDataRef.current = gridData; }, [gridData]);
  useEffect(() => { configIdRef.current = configId; }, [configId]);

  // Derive global target percentage for Cotidiano
  const cotidianoRubric = evaluationRubrics.find(r => r.name?.toLowerCase().includes("cotidiano"));
  const globalPercentageTarget = cotidianoRubric ? Number(cotidianoRubric.percentage) : 40;

  // RESET: Limpiar estado al cambiar de grupo o periodo para evitar contaminación cruzada
  useEffect(() => {
    // CRITICAL: Cancelar cualquier auto-save pendiente ANTES de limpiar datos
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    setIsDirty(false); // Evitar que auto-save guarde datos vacíos
    setLastSaved(null);
    setConfigId(null);
    setColumns([]);
    setGridData({});
  }, [selectedGroupId, academicPeriod]);

  const studentIdsString = students.map(s => s.id).join(',');

  // Load Data — con abort controller para cancelar cargas obsoletas
  useEffect(() => {
    let cancelled = false;

    const loadMatrixData = async () => {
      if (!selectedGroupId || !academicPeriod || !session?.user?.id) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const periodToUse = academicPeriod === 'annual' ? 'semester1' : academicPeriod;

        // 1. Cargar configuración de columnas
        const { data: configData, error: configErr } = await supabase
          .from("cotidiano_columns_config")
          .select("id, columns_data")
          .eq("group_id", selectedGroupId)
          .eq("period", periodToUse)
          .maybeSingle();

        if (cancelled) return; // Abortar si ya cambió el grupo

        if (configErr) {
          console.error("Error loading config:", configErr);
          return;
        }

        if (configData && configData.columns_data) {
          setConfigId(configData.id);
          setColumns(configData.columns_data as CotidianoCol[]);
        } else {
          setConfigId(null);
          setColumns([{ id: "c1", name: "Cotidiano #1", type: "pct" }]);
        }

        // 2. Cargar celdas previas de los estudiantes para este periodo y grupo
        const studentIds = students.map(s => Number(s.id));
        if (studentIds.length > 0) {
          const { data: scoresData, error: scoresErr } = await supabase
            .from("daily_work_scores")
            .select("student_id, period, matrix_cells, score")
            .in("student_id", studentIds)
            .in("period", [periodToUse, "annual"]);
          
          if (cancelled) return; // Abortar si ya cambió el grupo

          if (scoresErr) {
            console.error("Error loading daily work scores:", scoresErr);
          } else if (scoresData) {
            const newGrid: GridData = {};
            
            // Ordenar para que 'annual' se procese primero, y luego 'periodToUse' pueda sobreescribir
            scoresData.sort((a, b) => a.period === 'annual' ? -1 : 1);

            scoresData.forEach(row => {
              if (row.matrix_cells) {
                let cellsObj = row.matrix_cells;
                if (typeof cellsObj === 'string') {
                  try {
                    cellsObj = JSON.parse(cellsObj);
                  } catch (e) {
                    cellsObj = {};
                  }
                }
                const sid = Number(row.student_id);
                const hasRealData = Object.keys(cellsObj).length > 0;
                
                const existingData = newGrid[sid];
                const existingHasData = existingData && Object.keys(existingData).length > 0;
                
                if (!existingData || hasRealData || (!existingHasData && row.period === periodToUse)) {
                  newGrid[sid] = { ...(existingData || {}), ...(cellsObj as { [colId: string]: CellData }) };
                  newGrid[String(sid)] = { ...(newGrid[String(sid)] || {}), ...(cellsObj as { [colId: string]: CellData }) };
                }
              }
            });
            console.log("Loaded GridData:", newGrid);
            setGridData(newGrid);
          }
        }
      } catch (e) {
        console.error("Error loading matrix data", e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    if (selectedGroupId && academicPeriod) {
      loadMatrixData();
    }

    return () => {
      cancelled = true;
    };
  }, [selectedGroupId, academicPeriod, studentIdsString]);

  // AUTO-SAVE: Guardar automáticamente 3 seg después del último cambio
  // Usa refs para evitar stale closures
  useEffect(() => {
    if (isDirty && columnsRef.current.length > 0) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        handleSaveMatrix();
      }, 3000);
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [isDirty, gridData, columns]);
  const globalSortedKeys = useMemo(() => {
    const keysSet = new Set<string>();
    Object.values(gridData).forEach((studentData: any) => {
      if (studentData && typeof studentData === "object") {
        Object.keys(studentData).forEach(k => {
          if (k.startsWith("c")) {
            keysSet.add(k);
          }
        });
      }
    });
    const cellKeys = Array.from(keysSet);
    return cellKeys.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      if (numA && numB) return numA - numB;
      return a.localeCompare(b);
    });
  }, [gridData]);

  const getCellValue = (studentId: number, col: CotidianoCol): any => {
    let studentData = gridData[studentId] || gridData[String(studentId)];
    if (!studentData) return 0;

    // Si por alguna razón los datos vienen stringificados desde la DB
    if (typeof studentData === 'string') {
      try { studentData = JSON.parse(studentData); } catch (e) { return 0; }
    }

    const extractVal = (cell: any) => {
      if (cell === undefined || cell === null) return 0;
      if (typeof cell === "object") {
        if (cell.value !== undefined && cell.value !== null) {
          return cell.value;
        }
        return 0; // Si es un objeto vacío {}, no devolverlo para evitar crash de React
      }
      return cell; // Fallback para primitivos (ej. si matrix_cells se guardó como { c1: 100 })
    };

    // 1. Buscar por ID exacto (Caso normal y feliz)
    if (studentData[col.id] !== undefined && studentData[col.id] !== null) {
      return extractVal(studentData[col.id]);
    }

    // 2. Fallback por orden/índice global (para compatibilidad con IDs viejos)
    const colIndex = columns.findIndex(c => c.id === col.id);
    if (colIndex >= 0 && colIndex < globalSortedKeys.length) {
      const fallbackKey = globalSortedKeys[colIndex];
      if (studentData[fallbackKey] !== undefined && studentData[fallbackKey] !== null) {
        return extractVal(studentData[fallbackKey]);
      }
    }

    // 3. Si no existe la columna en los datos de este estudiante, retornar 0 por defecto
    return 0;
  };

  const calculateTotal = (studentId: number) => {
    // Todas las columnas son porcentaje: promediamos y aplicamos al máximo del rubro
    let sumPct = 0;
    let validCount = 0;
    columns.forEach(col => {
      let val = getCellValue(studentId, col);
      if (typeof val === "string" && (val as string).includes("/")) {
        const parts = (val as string).split("/");
        const obtained = parseFloat(parts[0]);
        const total = parseFloat(parts[1]);
        if (!isNaN(obtained) && !isNaN(total) && total > 0) {
          val = Math.round((obtained / total) * 100 * 100) / 100;
        }
      }
      const numVal = typeof val === "number" ? val : parseFloat(val as any);
      if (!isNaN(numVal)) {
        sumPct += numVal;
        validCount++;
      }
    });

    const avgPct = validCount > 0 ? sumPct / validCount : 0;
    const finalTotal = (avgPct * globalPercentageTarget) / 100;

    return Number(Math.min(finalTotal, globalPercentageTarget).toFixed(2));
  };

  const handleSaveMatrix = async () => {
    if (!selectedGroupId || !academicPeriod || !session?.user?.id) {
      alert("Faltan datos de sesión, grupo o período.");
      return;
    }
    
    // GUARDIA: No guardar si las columnas están vacías (estado de transición entre grupos)
    if (columns.length === 0) {
      console.log("[SAVE] Abortado: columns vacías (transición de grupo)");
      return;
    }
    
    setIsSaving(true);
    try {
      const periodToUse = academicPeriod === 'annual' ? 'semester1' : academicPeriod;

      // 1. Guardado de Configuración de Columnas
      const { data: existingCfg } = await supabase
        .from("cotidiano_columns_config")
        .select("id")
        .eq("group_id", Number(selectedGroupId))
        .eq("period", periodToUse)
        .maybeSingle();

      const cfgPayload = {
        group_id: Number(selectedGroupId),
        period: periodToUse,
        owner_id: session.user.id,
        columns_data: columns
      };

      const targetCfgId = existingCfg?.id || configId;

      if (targetCfgId) {
        const { error: cfgUpdErr } = await supabase
          .from("cotidiano_columns_config")
          .update({ columns_data: columns, owner_id: session.user.id })
          .eq("id", targetCfgId);
        if (cfgUpdErr) throw new Error(`Al actualizar configuración: ${cfgUpdErr.message}`);
      } else {
        const { data: newCfg, error: cfgInsErr } = await supabase
          .from("cotidiano_columns_config")
          .insert(cfgPayload)
          .select("id")
          .maybeSingle();
        if (cfgInsErr) throw new Error(`Al guardar configuración: ${cfgInsErr.message}`);
        if (newCfg?.id) setConfigId(newCfg.id);
      }

      // 2. Guardado de Notas de Estudiantes
      if (students.length > 0) {
        const studentIds = students.map(s => Number(s.id));
        
        // Obtener todos los registros de estos estudiantes
        const { data: existingRows } = await supabase
          .from("daily_work_scores")
          .select("student_id, period")
          .in("student_id", studentIds);

        const exactMap = new Set<string>();
        const anyMap = new Set<string>();

        (existingRows || []).forEach(r => {
          const sid = String(r.student_id);
          anyMap.add(sid);
          if (r.period === periodToUse) {
            exactMap.add(sid);
          }
        });

        for (const st of students) {
          const sid = Number(st.id);
          const rowTotal = calculateTotal(sid);
          const cells = gridData[st.id] || gridData[String(st.id)] || gridData[sid] || {};
          
          const payload = {
            student_id: sid,
            period: periodToUse,
            score: rowTotal,
            total_points: globalPercentageTarget,
            owner_id: session.user.id,
            matrix_cells: cells
          };

          const exactExists = exactMap.has(String(sid));
          const anyExists = anyMap.has(String(sid));

          if (exactExists) {
            const { error: updErr } = await supabase
              .from("daily_work_scores")
              .update(payload)
              .eq("student_id", sid)
              .eq("period", periodToUse);
            
            if (updErr) {
              if (updErr.message === 'Failed to fetch' || updErr.message.includes('fetch')) {
                alert("Se interrumpió la conexión (¿cambiaste de pestaña muy rápido o se cortó el internet?). Por favor, quédate en esta pantalla hasta que el botón deje de decir 'Guardando...'.");
                break; // Stop loop to avoid multiple alerts
              }
              console.warn(`[SAVE] Error actualizando estudiante ${sid}:`, updErr.message);
              alert(`Error actualizando notas para estudiante ${sid}: ${updErr.message}`);
            }
          } else {
            const { error: insErr } = await supabase
              .from("daily_work_scores")
              .insert(payload);

            if (insErr) {
              if (insErr.message === 'Failed to fetch' || insErr.message.includes('fetch')) {
                alert("Se interrumpió la conexión al guardar. Por favor, no cambies de pestaña hasta que el proceso termine.");
                break;
              }
              console.warn(`[SAVE] Insert falló para estudiante ${sid} (${insErr.message}), ejecutando update de respaldo...`);
              if (anyExists) {
                // Actualizamos el registro viejo existente de este estudiante (probablemente guardado sin periodo correcto)
                const { error: fbErr } = await supabase
                  .from("daily_work_scores")
                  .update(payload)
                  .eq("student_id", sid);

                if (fbErr) {
                  if (fbErr.message === 'Failed to fetch' || fbErr.message.includes('fetch')) {
                    alert("Se interrumpió la conexión al actualizar. Por favor, no cambies de pestaña hasta que termine.");
                    break;
                  }
                  console.error(`[SAVE] Fallback falló:`, fbErr);
                  alert(`Error guardando (fallback) estudiante ${sid}: ${fbErr.message}`);
                }
              } else {
                alert(`Fallo crítico al guardar estudiante ${sid}: ${insErr.message}`);
              }
            }
          }
        }
      }

      // Éxito
      setIsDirty(false);
      setLastSaved(new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }));

    } catch (e: any) {
      console.error("Error saving matrix", e);
      alert(`Hubo un error al guardar cotidiano: ${e.message || 'Revisa la consola.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const addColumn = () => {
    setColumns([
      ...columns,
      { id: `c${Date.now()}`, name: `Cotidiano #${columns.length + 1}`, type: "pct" }
    ]);
    setIsDirty(true);
  };

  const removeColumn = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Seguro que deseas eliminar esta asignación para TODOS los estudiantes?")) {
      setColumns(columns.filter(c => c.id !== id));
      setIsDirty(true);
    }
  };

  const startEditing = (col: CotidianoCol, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingColId(col.id);
    setTempColName(col.name);
  };

  const saveEditing = (colId: string) => {
    setColumns(columns.map(c => c.id === colId ? { ...c, name: tempColName } : c));
    setEditingColId(null);
    setIsDirty(true);
  };

  // toggleType eliminado — todo es porcentaje ahora

  const handleCellChange = (studentId: number, colId: string, val: string) => {
    if (val === "") {
      setGridData(prev => ({
        ...prev,
        [studentId]: { ...(prev[studentId] || {}), [colId]: { value: "" } },
        [String(studentId)]: { ...(prev[String(studentId)] || {}), [colId]: { value: "" } }
      }));
      setIsDirty(true);
      return;
    }
    if (val.includes("/")) {
      setGridData(prev => ({
        ...prev,
        [studentId]: { ...(prev[studentId] || {}), [colId]: { value: val as any } },
        [String(studentId)]: { ...(prev[String(studentId)] || {}), [colId]: { value: val as any } }
      }));
      setIsDirty(true);
      return;
    }
    let num = parseFloat(val);
    if (isNaN(num)) {
      setGridData(prev => ({
        ...prev,
        [studentId]: { ...(prev[studentId] || {}), [colId]: { value: val as any } },
        [String(studentId)]: { ...(prev[String(studentId)] || {}), [colId]: { value: val as any } }
      }));
      setIsDirty(true);
      return;
    }
    num = Math.min(100, Math.max(0, num));
    setGridData(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [colId]: { value: num } },
      [String(studentId)]: { ...(prev[String(studentId)] || {}), [colId]: { value: num } }
    }));
    setIsDirty(true);
  };

  // División Inteligente: convertir fracción a % al salir de la celda
  const handleCellBlur = (studentId: number, colId: string, rawVal: string) => {
    if (rawVal.includes("/")) {
      const parts = rawVal.split("/");
      const obtained = parseFloat(parts[0]);
      const total = parseFloat(parts[1]);
      if (!isNaN(obtained) && !isNaN(total) && total > 0) {
        const pct = Math.round((obtained / total) * 100 * 100) / 100;
        setGridData(prev => ({
          ...prev,
          [studentId]: {
            ...(prev[studentId] || {}),
            [colId]: { value: pct }
          },
          [String(studentId)]: {
            ...(prev[String(studentId)] || {}),
            [colId]: { value: pct }
          }
        }));
        setIsDirty(true);
      }
    } else {
      handleCellChange(studentId, colId, rawVal);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: "40px", display: "flex", justifyContent: "center", alignItems: "center", color: "#64748b" }}>
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", borderRadius: "20px", boxShadow: "0 8px 30px rgba(15,23,42,0.06)", border: "1px solid #cbd5e1", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      
      {/* Header Info */}
      <div style={{ background: "#f8fafc", padding: "16px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px rgba(16, 185, 129, 0.4)" }}></div>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#475569" }}>Valor Porcentual</span>
          <span style={{ fontSize: "18px", fontWeight: 900, color: "#10b981", background: "#ecfdf5", padding: "4px 12px", borderRadius: "8px", border: "1px solid #a7f3d0" }}>{globalPercentageTarget}%</span>
          {isDirty && <span style={{ fontSize: "12px", fontWeight: 700, color: "#f59e0b", background: "#fffbeb", padding: "4px 10px", borderRadius: "8px", border: "1px solid #fde68a", animation: "pulse 2s infinite" }}>⏳ Auto-guardando...</span>}
          {!isDirty && lastSaved && <span style={{ fontSize: "12px", fontWeight: 700, color: "#10b981", background: "#ecfdf5", padding: "4px 10px", borderRadius: "8px", border: "1px solid #a7f3d0" }}>✓ Guardado a las {lastSaved}</span>}
        </div>
        <button 
          onClick={handleSaveMatrix}
          disabled={isSaving || !selectedGroupId}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 24px", background: selectedGroupId ? "#4f46e5" : "#94a3b8", color: "#fff", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "14px", cursor: selectedGroupId ? "pointer" : "not-allowed", transition: "background 0.2s", boxShadow: selectedGroupId ? "0 4px 12px rgba(79, 70, 229, 0.2)" : "none" }} 
          className={selectedGroupId ? "hover:bg-indigo-700" : ""}
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {isSaving ? "Guardando..." : "GUARDAR COTIDIANOS"}
        </button>
      </div>

      {/* Grid Container */}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "60vh", position: "relative" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: "800px" }}>
          <thead>
            <tr>
              {/* Sticky Left Corner Header */}
              <th style={{ position: "sticky", left: 0, top: 0, zIndex: 30, background: "#f8fafc", borderBottom: "2px solid #cbd5e1", borderRight: "2px solid #e2e8f0", padding: "16px", textAlign: "left", width: "300px", minWidth: "300px" }}>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>Estudiantes ({students.length})</span>
              </th>

              {/* Dynamic Columns Headers */}
              {columns.map(col => (
                <th key={col.id} style={{ position: "sticky", top: 0, zIndex: 20, background: "#fff", borderBottom: "2px solid #cbd5e1", borderRight: "1px solid #e2e8f0", padding: "12px", minWidth: "160px", width: "160px" }}>
                  <div className="group" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    
                    {/* Header Top Row: Name / Edit */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {editingColId === col.id ? (
                        <input 
                          type="text" 
                          autoFocus
                          value={tempColName} 
                          onChange={e => setTempColName(e.target.value)}
                          onBlur={() => saveEditing(col.id)}
                          onKeyDown={(e) => e.key === "Enter" && saveEditing(col.id)}
                          style={{ width: "100%", padding: "4px 8px", fontSize: "13px", fontWeight: 700, borderRadius: "6px", border: "2px solid #4f46e5", outline: "none", color: "#0f172a" }}
                        />
                      ) : (
                        <span style={{ fontSize: "14px", fontWeight: 800, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{col.name}</span>
                      )}

                      {!editingColId && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ display: "flex", gap: "4px" }}>
                          <button onClick={(e) => startEditing(col, e)} title="Editar nombre" style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: "4px" }} className="hover:text-indigo-600">
                             <Edit2 size={12} />
                          </button>
                          <button onClick={(e) => removeColumn(col.id, e)} title="Eliminar cotidiano" style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "4px" }} className="hover:text-red-700">
                             <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Header Bottom Row: Fecha del Cotidiano */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <input
                        type="date"
                        value={col.date || ""}
                        onChange={e => {
                          setColumns(columns.map(c => c.id === col.id ? { ...c, date: e.target.value } : c));
                          setIsDirty(true);
                        }}
                        title="Fecha del cotidiano"
                        style={{ fontSize: "11px", fontWeight: 700, color: "#6366f1", background: "#f5f3ff", border: "1px solid #ddd6fe", padding: "2px 6px", borderRadius: "8px", cursor: "pointer", textAlign: "center" }}
                      />
                    </div>

                  </div>
                </th>
              ))}

              {/* Add Column Button inside Header */}
              <th style={{ position: "sticky", top: 0, zIndex: 20, background: "#f8fafc", borderBottom: "2px solid #cbd5e1", padding: "12px", minWidth: "120px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <button 
                    onClick={addColumn} 
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "#fff", border: "2px dashed #cbd5e1", color: "#64748b", padding: "10px", borderRadius: "10px", fontWeight: 700, fontSize: "13px", cursor: "pointer", transition: "all 0.2s" }}
                    className="hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50"
                  >
                    <Plus size={16} strokeWidth={3} />
                    Agregar
                  </button>
                  {groups.length > 1 && columns.length > 0 && (
                    <button 
                      onClick={() => setShowCopyModal(true)} 
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0284c7", padding: "6px", borderRadius: "8px", fontWeight: 700, fontSize: "11px", cursor: "pointer", transition: "all 0.2s" }}
                      className="hover:bg-sky-100"
                      title="Copiar estructura de columnas a otro grupo"
                    >
                      <Copy size={12} />
                      Copiar a grupo
                    </button>
                  )}
                </div>
              </th>

              {/* Total Col */}
              <th style={{ position: "sticky", right: 0, top: 0, zIndex: 30, background: "#f8fafc", borderBottom: "2px solid #cbd5e1", borderLeft: "2px solid #e2e8f0", padding: "12px", width: "120px", minWidth: "120px", textAlign: "center" }}>
                 <span style={{ fontSize: "12px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Total</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
               <tr>
                 <td colSpan={columns.length + 3} style={{ padding: "40px", textAlign: "center", color: "#64748b", fontWeight: 600 }}>Selecciona un grupo con estudiantes matriculados para visualizar las celdas.</td>
               </tr>
            ) : null}

            {students.map((student, sIndex) => {
              const rowTotal = calculateTotal(student.id);
              const isMaxedOut = rowTotal >= globalPercentageTarget;

              return (
                <tr key={student.id} className="group hover:bg-indigo-100/80 transition-colors duration-150">
                  {/* Sticky Student Name */}
                  <td 
                    style={{ position: "sticky", left: 0, zIndex: 10, borderBottom: "1px solid #cbd5e1", borderRight: "2px solid #cbd5e1", padding: "14px 16px", transition: "all 0.15s ease" }} 
                    className="bg-white group-hover:bg-indigo-100 group-hover:border-l-4 group-hover:border-l-indigo-600"
                  >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span 
                        style={{ fontSize: "14px", fontWeight: 700, transition: "all 0.15s ease" }}
                        className="text-slate-800 group-hover:text-indigo-950 group-hover:font-extrabold"
                      >
                        {buildStudentDisplayName(student)}
                      </span>
                      {student.cedula && (
                        <span 
                          style={{ fontSize: "12px", transition: "all 0.15s ease" }}
                          className="text-slate-500 group-hover:text-indigo-700 font-semibold"
                        >
                          {student.cedula}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Input Cells */}
                  {columns.map((col, cIndex) => {
                    const cellVal = getCellValue(student.id, col);
                    return (
                      <td key={col.id} style={{ borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", padding: "8px", textAlign: "center" }}>
                        <div 
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", padding: "6px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)", transition: "all 0.15s ease" }} 
                          className="bg-white group-hover:bg-indigo-50/90 group-hover:border-indigo-400 group-hover:shadow-sm focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-200"
                        >
                          <input 
                            type="text"
                            inputMode="decimal"
                            value={cellVal}
                            onChange={e => handleCellChange(student.id, col.id, e.target.value)}
                            key={`${student.id}-${col.id}`}
                            data-row={sIndex}
                            data-col={cIndex}
                            onBlur={e => {
                              const raw = e.target.value;
                              if (raw.includes("/")) {
                                handleCellBlur(student.id, col.id, raw);
                              } else {
                                handleCellChange(student.id, col.id, raw);
                              }
                            }}
                            onKeyDown={e => {
                              const raw = (e.target as HTMLInputElement).value;
                              if (e.key === "Enter") {
                                e.preventDefault();
                                // Guardar valor actual
                                if (raw.includes("/")) {
                                  handleCellBlur(student.id, col.id, raw);
                                } else {
                                  handleCellChange(student.id, col.id, raw);
                                }
                                // Mover foco a la celda de abajo
                                const nextRow = sIndex + 1;
                                const nextInput = document.querySelector(
                                  `input[data-row="${nextRow}"][data-col="${cIndex}"]`
                                ) as HTMLInputElement;
                                if (nextInput) nextInput.focus();
                              } else if (e.key === "Tab" && raw.includes("/")) {
                                handleCellBlur(student.id, col.id, raw);
                              }
                            }}
                            placeholder="-"
                            title="Escribe % (ej: 85) o fracción (ej: 17/20)"
                            style={{ width: "50px", textAlign: "center", border: "none", fontWeight: 700, color: "#0f172a", outline: "none", fontSize: "14px", background: "transparent" }}
                          />
                          <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>%</span>
                        </div>
                      </td>
                    );
                  })}

                  {/* Empty Add Col area */}
                  <td style={{ borderBottom: "1px solid #e2e8f0" }} className="bg-slate-50 group-hover:bg-indigo-100/50 transition-colors duration-150"></td>

                  {/* Total Student Col - Sticky Right */}
                  <td 
                    style={{ position: "sticky", right: 0, zIndex: 10, borderBottom: "1px solid #cbd5e1", borderLeft: "2px solid #cbd5e1", padding: "12px", textAlign: "center", color: isMaxedOut ? "#059669" : "#0f172a", transition: "all 0.15s ease" }} 
                    className="bg-white group-hover:bg-indigo-100"
                  >
                     <span style={{ fontSize: "18px", fontWeight: 800 }}>{rowTotal}</span>
                     <span style={{ fontSize: "12px", fontWeight: 700, marginLeft: "2px" }}>%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Copiar Estructura a Otro Grupo */}
      {showCopyModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowCopyModal(false)}
        >
          <div style={{ background: "#fff", borderRadius: "16px", padding: "32px", width: "400px", maxWidth: "90vw", boxShadow: "0 25px 50px rgba(0,0,0,0.15)" }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#1e293b", marginBottom: "8px" }}>
              📋 Copiar Cotidianos a Otro Grupo
            </h3>
            <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "20px" }}>
              Se copiarán <strong>{columns.length} columnas</strong> ({columns.map(c => c.name).join(", ")}) al grupo seleccionado. Las notas de los estudiantes NO se copian.
            </p>

            <select
              value={copyTargetGroup}
              onChange={e => setCopyTargetGroup(Number(e.target.value) || "")}
              style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "2px solid #e2e8f0", fontSize: "14px", fontWeight: 600, marginBottom: "20px", outline: "none" }}
            >
              <option value="">Seleccionar grupo destino...</option>
              {groups.filter(g => g.id !== selectedGroupId).map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowCopyModal(false); setCopyTargetGroup(""); }}
                style={{ padding: "8px 20px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                disabled={!copyTargetGroup || isCopying}
                onClick={async () => {
                  if (!copyTargetGroup || !session?.user?.id || !academicPeriod) return;
                  setIsCopying(true);
                  try {
                    // Verificar si el grupo destino ya tiene config
                    const { data: existing } = await supabase
                      .from("cotidiano_columns_config")
                      .select("id")
                      .eq("group_id", copyTargetGroup)
                      .eq("period", academicPeriod)
                      .maybeSingle();

                    // Generar nuevos IDs para las columnas copiadas
                    const copiedColumns = columns.map((c, i) => ({
                      ...c,
                      id: `c${Date.now()}_${i}`
                    }));

                    if (existing) {
                      await supabase
                        .from("cotidiano_columns_config")
                        .update({ columns_data: copiedColumns, updated_at: new Date().toISOString() })
                        .eq("id", existing.id);
                    } else {
                      await supabase
                        .from("cotidiano_columns_config")
                        .insert({
                          group_id: copyTargetGroup,
                          period: academicPeriod,
                          owner_id: session.user.id,
                          columns_data: copiedColumns
                        });
                    }

                    const targetName = groups.find(g => g.id === copyTargetGroup)?.name || "grupo";
                    alert(`✅ ${columns.length} cotidianos copiados exitosamente a "${targetName}"`);
                    setShowCopyModal(false);
                    setCopyTargetGroup("");
                  } catch (err) {
                    console.error("Error copiando columnas:", err);
                    alert("❌ Error al copiar. Intente de nuevo.");
                  } finally {
                    setIsCopying(false);
                  }
                }}
                style={{ padding: "8px 24px", borderRadius: "8px", border: "none", background: copyTargetGroup ? "#0284c7" : "#94a3b8", color: "#fff", fontWeight: 700, fontSize: "13px", cursor: copyTargetGroup ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: "6px" }}
              >
                {isCopying ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                {isCopying ? "Copiando..." : "Copiar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Debug Info Section */}
      <div style={{ margin: "20px", padding: "16px", background: "#0f172a", color: "#f8fafc", borderRadius: "12px", fontFamily: "monospace", fontSize: "12px", overflowX: "auto" }}>
        <h4 style={{ margin: "0 0 10px 0", color: "#38bdf8" }}>🛠️ Panel de Diagnóstico de Datos</h4>
        <div><strong>Academic Period:</strong> {academicPeriod}</div>
        <div><strong>Group ID:</strong> {selectedGroupId}</div>
        <div><strong>Columns Config:</strong> {JSON.stringify(columns.map(c => ({ id: c.id, name: c.name })))}</div>
        <div><strong>Global Sorted Keys (computed):</strong> {JSON.stringify(globalSortedKeys)}</div>
        <div><strong>Students with Loaded Data:</strong> {Object.keys(gridData).join(", ")}</div>
        <div style={{ marginTop: "10px" }}>
          <strong>Sample Student Data:</strong>
          {students.slice(0, 3).map(s => {
            const data = gridData[s.id] || gridData[String(s.id)];
            return (
              <div key={s.id} style={{ marginLeft: "10px", marginTop: "4px", borderLeft: "2px solid #38bdf8", paddingLeft: "8px" }}>
                {s.nombre || buildStudentDisplayName(s)} (ID: {s.id}): {data ? JSON.stringify(data) : "Sin datos cargados"}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
