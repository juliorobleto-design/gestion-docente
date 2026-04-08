import { useState, useEffect } from "react";
import { supabase } from "../../../supabaseClient";
import { Loader2, ScrollText, Plus, Search, Trash2, Calendar, User, Users, Info, RefreshCw } from "lucide-react";
import { showAuthError } from "../../../utils/authError";

interface Group {
  id: number;
  name: string;
}

interface Student {
  id: number;
  name: string;
  group_id: number;
}

interface AnecdotalRecord {
  id: number;
  student_id: number;
  group_id: number;
  date: string;
  type: string;
  description: string;
  created_at: string;
  student_name?: string;
  group_name?: string;
}

interface AnecdoticoPageProps {
  groups: Group[];
  allStudents: Student[];
  activeGroupId: number | null;
  session?: any;
}

export default function AnecdoticoPage({ groups, allStudents, activeGroupId, session }: AnecdoticoPageProps) {
  // Form State
  const [selectedGroup, setSelectedGroup] = useState<number | "">(activeGroupId || "");
  const [selectedStudent, setSelectedStudent] = useState<number | "">("");
  const [recordDate, setRecordDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [recordType, setRecordType] = useState<string>("Positivo");
  const [description, setDescription] = useState<string>("");
  
  // UI State
  const [records, setRecords] = useState<AnecdotalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);


  // Update selected group if activeGroupId changes
  useEffect(() => {
    if (activeGroupId && !selectedGroup) {
      setSelectedGroup(activeGroupId);
    }
  }, [activeGroupId, selectedGroup]);

  // Filter students by selected group
  const filteredStudents = allStudents.filter(s => s.group_id === Number(selectedGroup));

  // Reset student selection when group changes
  useEffect(() => {
    setSelectedStudent("");
  }, [selectedGroup]);

  // Load records
  useEffect(() => {
    fetchRecords();
  }, [selectedGroup]);

  async function fetchRecords() {
    console.log("Fetching records for group:", selectedGroup);
    setLoading(true);
    try {
      let query = supabase
        .from("anecdotal_records")
        .select("*")
        .eq("owner_id", session.user.id)
        .order("date", { ascending: false });

      if (selectedGroup) {
        query = query.eq("group_id", selectedGroup);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Fetch records error:", error);
        throw error;
      }

      // Map names locally to avoid complex join issues
      const formatted = (data || []).map((r: any) => {
        const student = allStudents.find(s => s.id === r.student_id);
        const group = groups.find(g => g.id === r.group_id);
        return {
          ...r,
          student_name: student?.name || "Estudiante no encontrado",
          group_name: group?.name || `Grupo ${r.group_id}`
        };
      });

      console.log("Fetched records:", formatted.length);
      setRecords(formatted);
    } catch (err: any) {
      console.error("Error cargando anecdotario:", err);
      // alert(`Error al cargar datos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!session?.user?.id) {
      showAuthError();
      return;
    }
    if (!selectedGroup || !selectedStudent || !description.trim()) {
      alert("Por favor completa: Grupo, Estudiante y Descripción.");
      return;
    }

    setIsSaving(true);
    try {
      const recordToInsert = {
        group_id: Number(selectedGroup),
        student_id: Number(selectedStudent),
        date: recordDate,
        type: recordType,
        description: description.trim(),
        owner_id: session.user.id
      };

      console.log("Attempting to insert record:", recordToInsert);

      const { data, error } = await supabase
        .from("anecdotal_records")
        .insert([recordToInsert])
        .select();

      if (error) {
        console.error("Insert error:", error);
        throw error;
      }

      console.log("Insert success, returned data:", data);

      // Reset form fields
      setSelectedStudent("");
      setDescription("");
      
      // Refresh list
      await fetchRecords();
      alert("¡Registro guardado con éxito!");
    } catch (err: any) {
      console.error("Error general en handleSave:", err);
      alert(`No se pudo guardar: ${err.message || "Error desconocido"}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: any) {
    if (!session?.user?.id) {
      showAuthError();
      return;
    }
    setIsSaving(true);
    try {
      console.log("Proceeding with delete in Supabase for ID:", id);
      const { error } = await supabase
        .from("anecdotal_records")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Delete error from Supabase:", error);
        throw error;
      }

      console.log("Delete success in Supabase");
      setRecords(prev => prev.filter(r => r.id !== id));
      setDeleteConfirmId(null);
    } catch (err: any) {
      console.error("Error general en handleDelete:", err);
      alert(`No se pudo eliminar: ${err.message || "Error desconocido"}`);
    } finally {
      setIsSaving(false);
    }
  }

  const displayedRecords = searchTerm.trim() 
    ? records.filter(r => 
        r.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.type.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : records;

  return (
    <div className="content-wrap" style={{ padding: "24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 0.9fr", gap: "24px", alignItems: "start" }}>
        
        {/* LISTA DE REGISTROS (Izquierda) */}
        <div className="module-card">
          <div className="module-header" style={{ padding: "20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ background: "#eef2ff", color: "#4f46e5", padding: "10px", borderRadius: "12px" }}>
                <ScrollText size={24} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800 }}>Anecdotario / Bitácora</h2>
                <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                  {selectedGroup 
                    ? `Registros del grupo ${groups.find(g => g.id === Number(selectedGroup))?.name || '...'}` 
                    : "Todos los registros"}
                </p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button 
                onClick={fetchRecords}
                title="Refrescar lista"
                style={{ 
                  border: "1px solid #dfe3f0", 
                  background: "white", 
                  width: "40px", 
                  height: "40px", 
                  borderRadius: "12px", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  color: "#64748b",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                className="hover:bg-slate-50 hover:text-indigo-600"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              </button>
              <div style={{ position: "relative" }}>
                <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input 
                  type="text" 
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="date-input"
                  style={{ paddingLeft: "38px", width: "200px", fontSize: "14px", height: "40px" }}
                />
              </div>
            </div>
          </div>

          <div style={{ padding: "24px", minHeight: "400px" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px", color: "#6366f1" }}>
                <Loader2 size={40} className="animate-spin" style={{ margin: "0 auto 16px" }} />
                <p style={{ fontWeight: 600 }}>Sincronizando con Supabase...</p>
              </div>
            ) : displayedRecords.length === 0 ? (
              <div style={{ textAlign: "center", padding: "100px 40px", color: "#94a3b8", background: "#f8fafc", borderRadius: "24px", border: "2px dashed #e2e8f0" }}>
                <ScrollText size={48} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
                <p style={{ fontSize: "16px", fontWeight: 600, color: "#64748b" }}>
                  {searchTerm ? "No se encontraron resultados para tu búsqueda." : "No hay registros en el anecdotario para este grupo."}
                </p>
                <p style={{ fontSize: "13px", marginTop: "4px" }}>Utiliza el formulario de la derecha para crear uno.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {displayedRecords.map((record) => (
                  <div 
                    key={record.id} 
                    style={{ 
                      border: "1px solid #f1f5f9", 
                      borderRadius: "20px", 
                      padding: "20px", 
                      background: "#fff",
                      transition: "all 0.2s",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
                    }}
                    className="hover:shadow-md"
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                          <span style={{ 
                            fontSize: "10px", 
                            fontWeight: 800, 
                            textTransform: "uppercase", 
                            letterSpacing: "0.05em",
                            background: record.type === 'Negativo' || record.type === 'Llamada de atención' ? '#fff1f2' : record.type === 'Positivo' ? '#f0fdf4' : '#f8fafc',
                            color: record.type === 'Negativo' || record.type === 'Llamada de atención' ? '#e11d48' : record.type === 'Positivo' ? '#16a34a' : '#64748b',
                            padding: "4px 12px",
                            borderRadius: "10px",
                            border: `1px solid ${record.type === 'Negativo' || record.type === 'Llamada de atención' ? '#fecdd3' : record.type === 'Positivo' ? '#bbf7d0' : '#e2e8f0'}`
                          }}>
                            {record.type}
                          </span>
                          <span style={{ fontSize: "12px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px", fontWeight: 500 }}>
                            <Calendar size={14} />
                            {new Date(record.date).toLocaleString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                          {record.student_name}
                        </h4>
                        {!selectedGroup && (
                          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, marginTop: "2px" }}>Grupo: {record.group_name}</div>
                        )}
                      </div>
                      <button 
                        onClick={() => setDeleteConfirmId(record.id)}
                        style={{ border: "none", background: "#fef2f2", color: "#f87171", cursor: "pointer", padding: "8px", borderRadius: "10px" }}
                        className="hover:bg-red-500 hover:text-white transition-all shadow-sm"
                        title="Eliminar registro"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div style={{ 
                      background: "#f8fafc", 
                      padding: "16px", 
                      borderRadius: "14px", 
                      fontSize: "14.5px", 
                      color: "#334155", 
                      lineHeight: "1.7", 
                      whiteSpace: "pre-wrap",
                      border: "1px solid #f1f5f9"
                    }}>
                      {record.description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FORMULARIO DE REGISTRO (Derecha) */}
        <div className="module-card sticky top-28 self-start">
          <div className="module-header" style={{ padding: "20px", borderBottom: "1px solid #f1f5f9" }}>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>Nuevo Registro</h2>
          </div>

          <div style={{ padding: "24px", display: "grid", gap: "18px" }}>
            
            {/* GRUPO SELECT */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Grupo</label>
              <div style={{ position: "relative" }}>
                <Users size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#6366f1" }} />
                <select 
                  className="date-input" 
                  style={{ width: "100%", paddingLeft: "42px", height: "50px", appearance: "none", fontSize: "15px", fontWeight: 600 }}
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">Seleccionar grupo...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ESTUDIANTE SELECT */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Estudiante</label>
              <div style={{ position: "relative" }}>
                <User size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: selectedGroup ? "#6366f1" : "#cbd5e1" }} />
                <select 
                  className="date-input" 
                  disabled={!selectedGroup}
                  style={{ width: "100%", paddingLeft: "42px", height: "50px", appearance: "none", opacity: !selectedGroup ? 0.6 : 1, fontSize: "15px", fontWeight: 600 }}
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">Seleccionar estudiante...</option>
                  {filteredStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* FECHA Y HORA */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Fecha y Hora</label>
              <input 
                type="datetime-local" 
                className="date-input" 
                style={{ width: "100%", height: "50px", fontSize: "14px", fontWeight: 500 }}
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
              />
            </div>

            {/* TIPO */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Categoría del Incidente</label>
              <select 
                className="date-input" 
                style={{ width: "100%", height: "50px", fontSize: "15px", fontWeight: 600 }}
                value={recordType}
                onChange={(e) => setRecordType(e.target.value)}
              >
                <option value="Positivo">Positivo (Felicitar/Destacar)</option>
                <option value="Seguimiento">Seguimiento Académico</option>
                <option value="Llamada de atención">Llamada de atención verbal</option>
                <option value="Negativo">Negativo (Reporte disciplinario)</option>
                <option value="Entrevista">Entrevista con encargado</option>
              </select>
            </div>

            {/* DESCRIPCIÓN */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Descripción Detallada</label>
              <textarea 
                placeholder="Describa el incidente con detalle aquí..."
                style={{ 
                  width: "100%", 
                  minHeight: "130px", 
                  padding: "16px", 
                  resize: "none", 
                  lineHeight: "1.7",
                  border: "1px solid #dfe3f0",
                  borderRadius: "18px",
                  fontSize: "14.5px",
                  color: "#334155",
                  background: "#fff",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)",
                  transition: "all 0.2s"
                }}
                onFocus={(e) => e.target.style.borderColor = "#6366f1"}
                onBlur={(e) => e.target.style.borderColor = "#dfe3f0"}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button 
              className="primary-button" 
              style={{ 
                width: "100%", 
                height: "54px", 
                borderRadius: "18px", 
                marginTop: "10px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                gap: "12px",
                fontSize: "16px",
                fontWeight: 700,
                boxShadow: "0 10px 20px -5px rgba(79, 70, 229, 0.4)"
              }}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 size={22} className="animate-spin" /> : <Plus size={22} />}
              {isSaving ? "Guardando..." : "Guardar Registro"}
            </button>
          </div>
        </div>

      </div>

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {deleteConfirmId && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", zIndex: 9999 }}>
          <div style={{ background: "white", width: "90%", maxWidth: "400px", borderRadius: "24px", padding: "32px", textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <div style={{ background: "#fef2f2", color: "#ef4444", width: "64px", height: "64px", borderRadius: "20px", display: "grid", placeItems: "center", margin: "0 auto 20px" }}>
              <Trash2 size={32} />
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: "0 0 10px" }}>¿Eliminar registro?</h3>
            <p style={{ color: "#64748b", margin: "0 0 24px", lineHeight: "1.5" }}>Estas a punto de borrar esta entrada del anecdotario. Esta acción no se puede deshacer.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <button 
                onClick={() => setDeleteConfirmId(null)}
                style={{ padding: "14px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "white", color: "#64748b", fontWeight: 700, cursor: "pointer" }}
                className="hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button 
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={isSaving}
                style={{ padding: "14px", borderRadius: "14px", border: "none", background: "#ef4444", color: "white", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                className="hover:bg-red-600"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : null}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
