import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { supabase } from "./supabaseClient"
import {  FileBarChart, Clock,  Users, FileText, Settings, CalendarCheck, NotebookPen, StickyNote, ScrollText, Bot, Ellipsis, Loader2, CheckCircle2, LogOut, Trash2, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { getDocument, GlobalWorkerOptions, version } from "pdfjs-dist";
import Auth from "./Auth";
import { parseStudentsFromExcel, ImportedStudent } from "./utils/excelParser";
import ConfiguracionPage from "./modules/configuracion/pages/ConfiguracionPage";
import AsistenciaPage from "./modules/asistencia/pages/AsistenciaPage";
import CotidianoPage from "./modules/cotidiano/pages/CotidianoPage";
import NotasPage from "./modules/notas/pages/NotasPage";
import AnecdoticoPage from "./modules/anecdotico/pages/AnecdoticoPage";
import ReportesPage from "./modules/reportes/pages/ReportesPage";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

type Group = {
  id: number
  name: string
  subject?: string
  grade?: string
  students?: number
  lessons_per_day?: number
  guia_name?: string
  guia_phone?: string
}

const initialGroups: Group[] = []

const navItems = ["Asistencia", "Cotidiano", "Notas", "Anecdotario", "Asistente IA", "Más"]

function getInitials(text: string) {
  return text
    .split(" ")
    .slice(0, 2)  
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")                                                                                                             
}

function downloadTemplate() {
  const data = [
    {
      "Cédula": "",
      "Primer apellido": "",
      "Segundo apellido": "",
      "Nombre": "",
      "Sección": "",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Estudiantes");

  XLSX.writeFile(workbook, "plantilla_estudiantes.xlsx");
}

function sortGroupsAsc(groups: Group[]) {
  return [...groups].sort((a, b) =>
    a.name.localeCompare(b.name, "es", { numeric: true, sensitivity: "base" })
  )
}

function showAuthError() {
  alert("Tu sesión ha expirado. Por favor inicia sesión nuevamente.");
}

function showToast(message: string, type: 'success' | 'error', setToast: any) {
  setToast({ message, type });
  setTimeout(() => setToast(null), 3000);
}

export default function App() {
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState("Nuevo grupo")
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [tempGroupName, setTempGroupName] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null)

  const handleShowToast = useCallback((t: { message: string, type: 'success' | 'error' } | null) => {
    setToast(t);
    if (t) {
      setTimeout(() => setToast(null), 3000);
    }
  }, []);
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [pdfPreviewStudents, setPdfPreviewStudents] = useState<any[]>([])
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null)
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentCedula, setNewStudentCedula] = useState("")
  const [newStudentGender, setNewStudentGender] = useState("")
  const [newStudentEmail, setNewStudentEmail] = useState("")
  const [newStudentApoyo, setNewStudentApoyo] = useState<"no_significativo" | "significativo" | "">("")
  const [newStudentGuardian1, setNewStudentGuardian1] = useState("")
  const [newStudentGuardian2, setNewStudentGuardian2] = useState("")
  const [newStudentGuiaName, setNewStudentGuiaName] = useState("")
  const [newStudentGuiaPhone, setNewStudentGuiaPhone] = useState("")
  const [studentSearch, setStudentSearch] = useState("")
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [newStudentMepEmail, setNewStudentMepEmail] = useState("")
  const [newParent1Phone, setNewParent1Phone] = useState("")
  const [newParent1Email, setNewParent1Email] = useState("")
  const [newParent2Phone, setNewParent2Phone] = useState("")
  const [newParent2Email, setNewParent2Email] = useState("")
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const STATUS_ORDER = ["P", "T", "A", "J"] as const
    type AttendanceCellStatus = (typeof STATUS_ORDER)[number]
  const attendanceGridTemplate =
    "minmax(260px, 2.2fr) 72px repeat(6, 56px) minmax(220px, 1.8fr)";
    const [attendanceCells, setAttendanceCells] = useState<Record<string, AttendanceCellStatus>>({})
    const [todaySchedule, setTodaySchedule] = useState<any[]>([])
    const [session, setSession] = useState<any>(null)
    const [isAuthReady, setIsAuthReady] = useState(false)
    const [authError, setAuthError] = useState<string | null>(null)
    const [academicPeriod, setAcademicPeriod] = useState<'semester1' | 'semester2' | 'annual'>('semester1')
    const [isGuiaConfigOpen, setIsGuiaConfigOpen] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState<any | null>(null);
    const [isDeletingStudent, setIsDeletingStudent] = useState(false);
    const [scheduleConflict, setScheduleConflict] = useState<{ groupName: string, day: string, startTime: string, endTime: string } | null>(null);

    const BLOCKED_DOMAINS = ["mep.go.cr", "go.cr"];

    // Doble Inicialización: Levantamiento seguro de sesión
    useEffect(() => {
      let mounted = true;

      const checkSession = async () => {
        try {
          // Primero revisar si hay un bypass de debug activo (solo en localhost)
          const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const debugSession = localStorage.getItem('gd_debug_session');
          
          if (isLocal && debugSession) {
            setSession(JSON.parse(debugSession));
            setIsAuthReady(true);
            return;
          }

          const { data: { session: activeSession } } = await supabase.auth.getSession();
          if (!mounted) return;

          if (activeSession?.user?.email) {
            const domain = activeSession.user.email.split('@')[1].toLowerCase();
            if (BLOCKED_DOMAINS.some(d => domain.endsWith(d))) {
              await supabase.auth.signOut();
              if (mounted) {
                setAuthError("Usa un correo personal para ingresar. Los correos institucionales no están habilitados en esta etapa.");
                setSession(null);
                setIsAuthReady(true);
              }
              return;
            }
            setSession(activeSession);
            setAuthError(null);
          } else {
            setSession(null);
          }
        } catch (err) {
          console.error("Error inicializando sesión:", err);
        } finally {
          if (mounted) setIsAuthReady(true);
        }
      };

      checkSession();

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (!mounted) return;
        
        if (newSession?.user?.email) {
          const domain = newSession.user.email.split('@')[1].toLowerCase();
          if (BLOCKED_DOMAINS.some(d => domain.endsWith(d))) {
            await supabase.auth.signOut();
            if (mounted) {
              setAuthError("Usa un correo personal para ingresar. Los correos institucionales no están habilitados en esta etapa.");
              setSession(null);
            }
          } else {
            setSession(newSession);
            setAuthError(null);
          }
        } else {
          setSession(null);
        }
        setIsAuthReady(true);
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }, []);

  useEffect(() => {
    // Check if onboarding was already seen
    if (session?.user?.id) {
      const hasSeenOnboarding = localStorage.getItem('gd_onboarding_seen');
      if (!hasSeenOnboarding) {
        // Delay slightly for smooth entry and ensure DOM is ready
        const timer = setTimeout(() => {
          setShowOnboarding(true);
          console.log("🚀 Onboarding triggered for user:", session.user.email);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [session?.user?.id]);

  const handleCloseOnboarding = () => {
    localStorage.setItem('gd_onboarding_seen', 'true');
    setShowOnboarding(false);
  };

    const handleUserMigration = async (user: any) => {
      // Si el email coincide con el real del docente registrado, actualizamos el UUID
      // Esto solo ocurre una vez por migración
      const { email, id: uuid } = user
      
      try {
        const { data, error } = await supabase
          .from("user_migration_map")
          .update({ 
            new_auth_user_id: uuid, 
            migration_status: 'active',
            first_login_at: new Date().toISOString() 
          })
          .eq("email_real", email)
          .is("new_auth_user_id", null) // Solo si no ha sido mapeado aún
          .select()

        if (data && data.length > 0) {
          console.log("✅ Identidad vinculada exitosamente:", email, uuid)
        }
      } catch (err) {
        console.error("Error en mapeo de identidad:", err)
      }
    }
    const [currentClass, setCurrentClass] = useState<any | null>(null)
    const [nextClass, setNextClass] = useState<any | null>(null)
    const [scheduleItems, setScheduleItems] = useState<
      {
    id: number
    groupId: number
    groupName?: string
    day: string
    startTime: string
    endTime: string
    subject: string
    lessons: number
  }[]
>([]);
const [showSchedulePreview, setShowSchedulePreview] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([])
  const [newScheduleGroup, setNewScheduleGroup] = useState<number | "">("")
  const [scheduleDay, setScheduleDay] = useState("")
  const [scheduleStartTime, setScheduleStartTime] = useState("")
  const [scheduleEndTime, setScheduleEndTime] = useState("")
  const [scheduleSubject, setScheduleSubject] = useState("")
  const [scheduleLessons, setScheduleLessons] = useState("1")
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null)
    // 1. DÍAS
  const dayOrder = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
  // 2. FILTRAR HORARIOS
const selectedScheduleItems =
  newScheduleGroup === ""
    ? []
    : scheduleItems
        .filter((item) => item.groupId === Number(newScheduleGroup))
        .sort((a, b) => {
          const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
          if (dayDiff !== 0) return dayDiff
          return a.startTime.localeCompare(b.startTime)
        })
        // 3. HORAS ÚNICAS
const scheduleTimeSlots = Array.from(
  new Set(selectedScheduleItems.map((item) => item.startTime))
).sort((a, b) => a.localeCompare(b))

  // 4. BUSCAR CELDA
function getScheduleCell(day: string, startTime: string) {
  return selectedScheduleItems.find(
    (item) => item.day === day && item.startTime === startTime
  )
}

  const [showMoreMenu, setShowMoreMenu] = useState(false)
  // PDF Import Progress States
  const [isImportingPdf, setIsImportingPdf] = useState(false)
  const [pdfImportSteps, setPdfImportSteps] = useState<{ id: string; label: string; status: 'waiting' | 'loading' | 'done' }[]>([
    { id: 'read', label: 'Leyendo archivo PDF...', status: 'waiting' },
    { id: 'parse', label: 'Analizando contenido y páginas...', status: 'waiting' },
    { id: 'extract', label: 'Extrayendo estudiantes...', status: 'waiting' },
    { id: 'preview', label: 'Preparando vista previa...', status: 'waiting' }
  ])
  const [pdfProgress, setPdfProgress] = useState(0)

  const [students, setStudents] = useState<any[]>([])
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroupId] = useState<number | null>(null) 
  const selectedGroupId = Number(newScheduleGroup)
  const [activeSection, setActiveSection] = useState<
  "attendance" | "students" | "schedule" | "report" | "planning" | "settings" | "cotidiano" | "notas" | "anecdotal"
>("attendance")

  const [appSettings, setAppSettings] = useState<any>(() => {
    const saved = localStorage.getItem("gestion_docente_settings");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      institutionName: "Mi Institución",
      teacherName: "Docente",
      teacherEmail: "usuario@mep.go.cr",
      logoUrl: null,
      evaluationRubrics: [
        { id: "e1", name: "ASISTENCIA", percentage: 10 },
        { id: "e2", name: "COTIDIANO", percentage: 50 },
        { id: "e3", name: "PROYECTOS", percentage: 10 },
        { id: "e4", name: "PRUEBA 1", percentage: 15 },
        { id: "e5", name: "PRUEBA 2", percentage: 15 }
      ]
    };
  });
 
  const moreMenuRef = useRef<HTMLDivElement | null>(null) 
  
  // Stable derived values for child components
  const stableEvaluationRubrics = useMemo(() => appSettings.evaluationRubrics, [appSettings.evaluationRubrics]);
  const stableGroups = useMemo(() => groups.map(g => ({ id: g.id, name: g.name })), [groups]);

  // Per-group evaluation configs (minimum passing grade, etc.)
  const [groupConfigs, setGroupConfigs] = useState<Record<number, { minimumPassingGrade: number }>>(() => {
    const saved = localStorage.getItem("gestion_docente_group_configs");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {};
  });
 
 const selectedGroupName =
  groups.find((g) => g.id === selectedGroup)?.name || ""

  const scheduleGroupName =
  groups.find((g) => g.id === Number(newScheduleGroup))?.name || ""

  const subjectSuggestions = Array.from(
  new Set(
    scheduleItems
      .map((item: any) => item.subject?.trim())
      .filter(Boolean)
  )
).sort()

  const filteredSubjectSuggestions = subjectSuggestions.filter((subject) =>
  scheduleSubject.trim() === ""
    ? false
    : subject.toLowerCase().includes(scheduleSubject.toLowerCase())
)

  const totalGroupsCount = groups.length;
const totalStudentsCount = allStudents.length;

const activeGroupStudentsCount = selectedGroup
  ? students.filter((student) => student.group_id === selectedGroup).length
  : 0;
  
    useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (
      moreMenuRef.current &&
      !moreMenuRef.current.contains(event.target as Node)
    ) {
      setShowMoreMenu(false)
    }
  }

  document.addEventListener("mousedown", handleClickOutside)

  return () => {
    document.removeEventListener("mousedown", handleClickOutside)
  }
}, [])
  
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
const orderedGroups = useMemo(() => {
  const groupsWithCounts = groups.map((group) => ({
    ...group,
    students: allStudents.filter((student) => student.group_id === group.id).length,
  }))


  return sortGroupsAsc(groupsWithCounts)
}, [groups, allStudents])

const totalLessonsGroup = selectedScheduleItems.reduce(
  (sum, item) => sum + item.lessons,
  0
)

const totalLessonsByDay = dayOrder.map((day) => {
  const total = selectedScheduleItems
    .filter((item) => item.day === day)
    .reduce((sum, item) => sum + item.lessons, 0)

  return { day, total }
})

const totalLessonsTeacher = scheduleItems.reduce(
  (sum, item) => sum + item.lessons,
  0
)

function getAttendanceCellKey(studentId: string, lessonNumber: number) {
  return `${studentId}-${lessonNumber}`
}

function cycleAttendanceStatus(studentId: string, lessonNumber: number) {
  const key = getAttendanceCellKey(studentId, lessonNumber)

  setAttendanceCells((prev) => {
    const current = prev[key] || "P"
    const currentIndex = STATUS_ORDER.indexOf(current)
    const nextStatus = STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length]

    return {
      ...prev,
      [key]: nextStatus
    }
  })
}

const selectedGroupData=

  selectedGroup === null
    ? null
    : orderedGroups.find((group) => group.id === selectedGroup) ?? null

const totalStudents = orderedGroups.reduce((acc, group) => acc + (group.students ?? 0), 0)
 
const lessonsCount =
  selectedGroup === null
    ? 6
    : Math.max(
        ...scheduleItems
          .filter((item) => item.groupId === selectedGroup)
          .map((item) => item.lessons),
        6
      )


async function loadGroups() {
  if (!session) return;
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("owner_id", session.user.id)
    .order("name", { ascending: true })

  if (error) {
    console.error("Error cargando grupos:", error)
    return
  }

    const mapped: Group[] = (data || []).map((g: any) => ({
  id: g.id,
  name: g.name,
  subject: g.subject || "",
  grade: "",
  students: 0,
  lessons_per_day: g.lessons_per_day ?? 6,
  guia_name: g.guia_name || "",
  guia_phone: g.guia_phone || "",
}))

  setGroups(sortGroupsAsc(mapped))

  if (mapped.length > 0) {
    setSelectedGroupId(mapped[0].id)
  } else {
    setSelectedGroupId(null)
  }
  }

async function loadStudents(groupId: number) {
  if (!session) return;
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("group_id", groupId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error cargando estudiantes:", error);
    return;
  }
  setStudents(data || []);
}

async function loadAllStudents() {
  if (!session) return;
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("owner_id", session.user.id);

  if (error) {
    console.error("Error cargando todos los estudiantes:", error);
    return;
  }

  setAllStudents(data ?? []);
}




useEffect(() => {
  if (selectedGroup) {
    loadStudents(selectedGroup)
  } else {
    setStudents([])
  }
}, [selectedGroup])


useEffect(() => {
  if (isAuthReady && session) {
    loadGroups();
    loadAllStudents();
    loadSchedules();
  }
}, [session, isAuthReady]);

function getTodayName() {
  const days = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ]
  return days[new Date().getDay()]
}

function toMinutes(hour: string) {
  const [h, m] = hour.split(":").map(Number)
  return h * 60 + m
}

function updateTodaySchedule(items: any[]) {
  const todayName = getTodayName()
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const todayItems = items
    .filter((item) => item.day?.toLowerCase() === todayName)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))

  let current = null
  let next = null

  for (const item of todayItems) {
    const start = toMinutes(item.startTime)
    const end = toMinutes(item.endTime)

    if (currentMinutes >= start && currentMinutes <= end) {
      current = item
      break
    }

    if (currentMinutes < start) {
      next = item
      break
    }
  }

  setTodaySchedule(todayItems)
  setCurrentClass(current)
  setNextClass(current ? null : next)
}



async function loadSchedules() {
  if (!session) return;
  const { data, error } = await supabase
    .from("schedules")
    .select(`
  *,
  groups(name)
`)
    .eq("owner_id", session.user.id)
    .order("day", { ascending: true })

  if (error) {
    console.error("Error cargando horarios:", error)
    return
  }
console.log("SCHEDULES RAW:", data)
  const mappedSchedules = (data || []).map((item: any) => ({
    id: item.id,
    groupId: item.group_id,
    groupName: item.groups?.name || "",
    day: item.day,
    startTime: item.start_time,
    endTime: item.end_time,
    subject: item.subject,
    lessons: Number(item.lessons ?? 1),
  }))

  setScheduleItems(mappedSchedules)
  updateTodaySchedule(mappedSchedules)
}

function generateSchedulePDF() {
  const doc = new jsPDF('l', 'mm', 'a4');
  
  // Header
  doc.setFontSize(22);
  doc.setTextColor(79, 70, 229);
  doc.text("HORARIO SEMANAL - GESTIÓN DOCENTE", 14, 22);
  
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(`Docente: ${appSettings.teacherName || 'Nombre no asignado'}`, 14, 30);
  doc.text(`Institución: ${appSettings.institutionName || 'Mi Institución'}`, 14, 36);

  const tableData = dayOrder.map(day => {
    const dayItems = scheduleItems
      .filter(item => item.day === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    if (dayItems.length === 0) return [day, "Sin lecciones"];
    
    const scheduleStr = dayItems.map(item => 
      `${item.startTime}-${item.endTime}: ${item.groupName} (${item.subject})`
    ).join("\n\n");
    
    return [day, scheduleStr];
  });

  autoTable(doc, {
    startY: 45,
    head: [['Día', 'Horario Detallado']],
    body: tableData,
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 12, fontStyle: 'bold' },
    bodyStyles: { fontSize: 10, cellPadding: 8, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 200 }
    },
    theme: 'striped',
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`BY MARKETING IA CR - ${new Date().toLocaleDateString()}`, 14, doc.internal.pageSize.height - 10);
  }

  doc.save(`horario_${new Date().getTime()}.pdf`);
  setShowSchedulePreview(false);
}


  /* System Clock Disabled */

  const timeLabel = now.toLocaleTimeString("es-CR", {
    hour: "numeric",
    minute: "2-digit",
  })

  const dateLabel = now.toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  async function saveNewGroup() {
    // TAREA 1: Obtener usuario autenticado
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // TAREA 4: Mensaje claro de error
      alert("Error creando grupo: usuario no autenticado");
      return;
    }
    
    // TAREA 3: Log de validación
    console.log("USER_ID:", user.id);

    const trimmed = newGroupName.trim()
    const finalName = trimmed || "Nuevo grupo"

    try {
      // TAREA 2: Corregir INSERT
      const { data, error } = await supabase
        .from("groups")
        .insert([
          {
            name: finalName,
            owner_id: user.id,
          }
        ])
        .select(`*`)

      if (error) {
        console.error("Error creando grupo:", error)
        // TAREA 4: Mensaje amigable
        alert("No pudimos crear el grupo en este momento. Por favor, intenta de nuevo.");
        return
      }

      const created = data?.[0]
      if (!created) return

    const newGroup: Group = {
      id: created.id,
      name: created.name,
      grade: "",
      students: 0,
    }

    setGroups((prev) => sortGroupsAsc([...prev, newGroup]))
    setSelectedGroupId(newGroup.id)
    setIsCreatingGroup(false)
    setNewGroupName("Nuevo grupo")
    showToast("Grupo creado con éxito", "success", setToast)
  } catch (err) {
    console.error("Error inesperado creando grupo:", err)
    showToast("Error al crear grupo", "error", setToast)
  }
  }

  function startEditingGroup(group: Group) {
    setIsCreatingGroup(false)
    setNewGroupName("Nuevo grupo")
    setEditingGroupId(group.id)
    setTempGroupName(group.name)
    setSelectedGroupId(group.id)
    loadStudents(group.id)
  }

  async function saveGroupName(groupId: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert("Error actualizando grupo: usuario no autenticado");
      return;
    }
    const trimmed = tempGroupName.trim()
    const finalName = trimmed || "Nuevo grupo"

    setGroups((prev) =>
      sortGroupsAsc(
        prev.map((group) =>
          group.id === groupId
            ? {
                ...group,
                name: finalName,
              }
            : group
        )
      )
    )

    await supabase.from("groups").update({
      name: finalName,
      owner_id: user.id
    }).eq("id", groupId)

    setEditingGroupId(null)
    setTempGroupName("")
    showToast("Cambios guardados", "success", setToast)
  }


  function cancelEditingGroup() {
    setEditingGroupId(null)
    setTempGroupName("")
  }

  function handleDeleteGroup(groupId: number) {
    const targetGroup = groups.find((group) => group.id === groupId)
    if (!targetGroup) return

    setGroupToDelete(targetGroup)
  }

  function cancelDeleteModal() {
    setGroupToDelete(null)
  }

  function handleAddGroup() {
    if (isCreatingGroup) return

    setIsCreatingGroup(true)
    setEditingGroupId(null)
    setTempGroupName("")
    setNewGroupName("Nuevo grupo")
    setSidebarOpen(true)
  }

  function handleEditSchedule(item: any) {
    setEditingScheduleId(item.id)
    setNewScheduleGroup(item.groupId)
    setScheduleDay(item.day)
    setScheduleStartTime(item.startTime)
    setScheduleEndTime(item.endTime)
    setScheduleSubject(item.subject)
    setScheduleLessons(String(item.lessons))
  }


async function confirmDeleteGroup() {
  if (!session?.user?.id) {
    showAuthError();
    return;
  }
  if (!groupToDelete) return

  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupToDelete.id)

  if (error) {
    console.error("Error eliminando grupo:", error)
    return
  }

  const updatedGroups = groups.filter((g) => g.id !== groupToDelete.id)
  setGroups(updatedGroups)
  setGroupToDelete(null)

  if (updatedGroups.length > 0) {
    setSelectedGroupId(updatedGroups[0].id)
  } else {
    setSelectedGroupId(null)
  }
}

async function handleAddStudent() {
  if (!session?.user?.id) {
    showAuthError();
    return;
  }

  if (!selectedGroup) {
    alert("Selecciona un grupo antes de agregar un estudiante.");
    return;
  }
  if (!newStudentName.trim()) {
    alert("Escribe el nombre del estudiante.");
    return;
  }

  const studentData = {
    name: newStudentName.trim(),
    cedula: newStudentCedula.trim() || null,
    gender: newStudentGender || null,
    mep_email: newStudentEmail.trim() || null,
    parent1_phone: newStudentGuardian1.trim() || null,
    parent2_phone: newStudentGuardian2.trim() || null,
    apoyo_curricular: newStudentApoyo || null,
    group_id: selectedGroup,
    owner_id: session.user.id,
  };

  if (editingStudentId) {
    const { error } = await supabase
      .from("students")
      .update(studentData)
      .eq("id", editingStudentId);

    if (error) {
      console.error("Error actualizando estudiante:", error);
      alert("Error al guardar: " + error.message);
      return;
    }
  } else {
    const { error } = await supabase
      .from("students")
      .insert([studentData]);

    if (error) {
      console.error("Error agregando estudiante:", error);
      alert(`Error agregando estudiante:\nCódigo: ${error.code}\nMensaje: ${error.message}\nDetalle: ${error.details || 'Ninguno'}`);
      return;
    }
  }

  await loadStudents(selectedGroup);
  await loadAllStudents();

  setEditingStudentId(null);
  setNewStudentCedula("");
  setNewStudentName("");
  setNewStudentGender("");
  setNewStudentEmail("");
  setNewStudentApoyo("");
  setNewStudentGuardian1("");
  setNewStudentGuardian2("");
}

function startEditingStudent(student: any) {
  setEditingStudentId(student.id);
  setNewStudentName(student.name || "");
  setNewStudentCedula(student.cedula || "");
  setNewStudentGender(student.gender || "");
  setNewStudentEmail(student.mep_email || "");
  setNewStudentGuardian1(student.parent1_phone || "");
  setNewStudentGuardian2(student.parent2_phone || "");
  setNewStudentApoyo(student.apoyo_curricular || "");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelEditStudent() {
  setEditingStudentId(null);
  setNewStudentCedula("");
  setNewStudentName("");
  setNewStudentGender("");
  setNewStudentEmail("");
  setNewStudentApoyo("");
  setNewStudentGuardian1("");
  setNewStudentGuardian2("");
}

async function saveGroupGuiaInfo() {
  if (!selectedGroup) return;
  
  const { error } = await supabase
    .from("groups")
    .update({
      guia_name: newStudentGuiaName.trim() || null,
      guia_phone: newStudentGuiaPhone.trim() || null,
    })
    .eq("id", selectedGroup);

  if (error) {
    console.error("Error guardando guía de grupo:", error);
    showToast("Error al guardar guía", "error", setToast);
    return;
  }

  handleShowToast({ message: "Información del guía actualizada", type: "success" });
  await loadGroups();
}
  
async function handleDeleteSchedule(id: number) {
  if (!session?.user?.id) {
    showAuthError();
    return;
  }
  const confirmed = window.confirm("¿Deseas eliminar este bloque de horario?")
  if (!confirmed) return

  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error eliminando horario:", error)
    alert("No se pudo eliminar el horario")
    return
    }

    setScheduleItems((prev) => prev.filter((item) => item.id !== id))
     await loadSchedules()
}

  function formatTime(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 4)

  if (numbers.length <= 2) return numbers
  return numbers.slice(0, 2) + ":" + numbers.slice(2)
}

async function handleAddSchedule() {
  if (!session?.user?.id) {
    showAuthError();
    return;
  }
  if (!newScheduleGroup || !scheduleDay || !scheduleStartTime || !scheduleEndTime || !scheduleSubject) {
    alert("Completa todos los campos")
    return
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

if (!timeRegex.test(scheduleStartTime) || !timeRegex.test(scheduleEndTime)) {
  alert("La hora debe estar en formato HH:MM, por ejemplo 07:40")
  return
}

const newStart = scheduleStartTime
const newEnd = scheduleEndTime

if (newStart >= newEnd) {
  alert("La hora final debe ser mayor que la hora de inicio")
  return
}

const overlappingItem = scheduleItems.find((item) => {
  if (item.day !== scheduleDay) return false
  return newStart < item.endTime && newEnd > item.startTime
})

if (overlappingItem) {
  setScheduleConflict({
    groupName: overlappingItem.groupName || "Otro grupo",
    day: scheduleDay,
    startTime: overlappingItem.startTime,
    endTime: overlappingItem.endTime
  });
  return
}

const selectedGroupId = Number(newScheduleGroup)

const scheduleData = {
  group_id: selectedGroupId,
  day: scheduleDay,
  start_time: scheduleStartTime,
  end_time: scheduleEndTime,
  lessons: Number(scheduleLessons),
  subject: scheduleSubject,
  owner_id: session.user.id,
}

if (editingScheduleId != null) {
  const { data, error } = await supabase
    .from("schedules")
    .update(scheduleData)
    .eq("id", editingScheduleId)
    .select()

  if (error) {
    console.error("Error actualizando horario:", error)
      showToast("No se pudo actualizar el horario", "error", setToast);
    return
  }

  if (data && data[0]) {
  await loadSchedules()
}

} else {
  const { data, error } = await supabase
    .from("schedules")
    .insert([scheduleData])
    .select()
  
  if (error) {
    console.error("Error guardando horario:", error)
      showToast("No se pudo guardar el horario", "error", setToast);
    return
  }

  if (data && data[0]) {
  await loadSchedules()
}
}

function getTodayName() {
  const days = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ]
  return days[new Date().getDay()]
}

function toMinutes(hour: string) {
  const [h, m] = hour.split(":").map(Number)
  return h * 60 + m
}

setScheduleDay("")
setScheduleStartTime("")
setScheduleEndTime("")
setScheduleSubject("")
setScheduleLessons("1")
setEditingScheduleId(null)
}

async function handleImportPdf(file: File) {
  if (!session) return;
  if (!selectedGroup) {
      showToast("Selecciona un grupo antes de importar estudiantes.", "error", setToast);
    return;
  }

  // Reset steps
  const initialSteps: any[] = [
    { id: 'read', label: 'Leyendo archivo PDF...', status: 'loading' },
    { id: 'parse', label: 'Analizando contenido y páginas...', status: 'waiting' },
    { id: 'extract', label: 'Extrayendo estudiantes...', status: 'waiting' },
    { id: 'preview', label: 'Preparando vista previa...', status: 'waiting' }
  ];
  setPdfImportSteps(initialSteps);
  setPdfProgress(0);
  setIsImportingPdf(true);
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Step 1 done
    setPdfImportSteps(prev => prev.map(s => s.id === 'read' ? { ...s, status: 'done' } : s.id === 'parse' ? { ...s, status: 'loading' } : s));
    
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    const totalPages = pdf.numPages;
    
    for (let i = 1; i <= totalPages; i++) {
        setPdfProgress(Math.round((i / totalPages) * 100));
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];
        
        const lines: { [y: string]: any[] } = {};
        for (const item of items) {
            const y = Math.round(item.transform[5] / 5) * 5;
            if (!lines[y]) lines[y] = [];
            lines[y].push(item);
        }
        
        const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);
        
        for (const y of sortedY) {
            const lineItems = lines[y].sort((a, b) => a.transform[4] - b.transform[4]);
            const lineStr = lineItems.map((item) => item.str).join(" ");
            fullText += lineStr + "\n";
        }
    }
    
    // Step 2 done
    setPdfImportSteps(prev => prev.map(s => s.id === 'parse' ? { ...s, status: 'done' } : s.id === 'extract' ? { ...s, status: 'loading' } : s));
    
    const textLines = fullText.split('\n');
    const detectedStudents = [];
    
    for (const line of textLines) {
        // Formato típico de cédula: 1-2053-0550 o similar
        const cedulaMatch = line.match(/\b\d{1,2}-\d{4}-\d{4}\b/);
        if (cedulaMatch) {
            const cedula = cedulaMatch[0];
            
            // Limpieza de la línea para extraer el nombre
            // Eliminamos la cédula y números de índice al inicio (e.g. "1. ", "12 ")
            let restLine = line.replace(cedula, "").trim();
            restLine = restLine.replace(/^\d+[\.\-\)]?\s*/, ""); // Eliminar 1. o 12-
            
            // Buscamos palabras en mayúscula sospechosas de ser nombres
            const nameMatch = restLine.match(/[A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,})+/i);
            const name = nameMatch ? nameMatch[0].trim().toUpperCase() : "ESTUDIANTE ENCONTRADO";
            
            // Email (deducir si no hay uno explícito)
            const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            const email = emailMatch ? emailMatch[0] : `${cedula.replace(/\D/g, "")}@est.mep.go.cr`;
            
            detectedStudents.push({
                name,
                cedula,
                gender: null,
                mep_email: email,
                parent1_phone: null,
                parent2_phone: null,
                apoyo_curricular: null,
                group_id: selectedGroup
            });
        }
    }

    if (detectedStudents.length === 0) {
        setIsImportingPdf(false);
      showToast("No se detectaron estudiantes con formato de Cédula en el PDF.", "error", setToast);
        return;
    }
    
    // Step 3 done
    setPdfImportSteps(prev => prev.map(s => s.id === 'extract' ? { ...s, status: 'done' } : s.id === 'preview' ? { ...s, status: 'loading' } : s));
    
    // Simular un poco de delay para el Step 4 (Premium Feel)
    await new Promise(r => setTimeout(r, 800));

    // Step 4 done
    setPdfImportSteps(prev => prev.map(s => s.id === 'preview' ? { ...s, status: 'done' } : s));
    await new Promise(r => setTimeout(r, 200));

    setPdfPreviewStudents(detectedStudents);
    setIsImportingPdf(false);
    setShowPdfPreview(true);
    
  } catch (err) {
    console.error(err);
    setIsImportingPdf(false);
      showToast("Error procesando PDF. Asegúrate de que sea un archivo de texto válido.", "error", setToast);
  }
  
  const input = document.getElementById("pdfFileInput") as HTMLInputElement;
  if(input) input.value = '';
}

async function handleDeleteStudent() {
  if (!studentToDelete || !session?.user?.id) return;
  
  setIsDeletingStudent(true);
  try {
    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", studentToDelete.id);

    if (error) throw error;

    showToast("Estudiante eliminado correctamente", "success", setToast);
    setAllStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
    setStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
    setStudentToDelete(null);
  } catch (error: any) {
    console.error("Error eliminando estudiante:", error);
    showToast("Error al eliminar estudiante: " + error.message, "error", setToast);
  } finally {
    setIsDeletingStudent(false);
  }
}

async function confirmPdfImport() {
  if (!session?.user?.id) {
    showAuthError();
    return;
  }
  const cedulasImportadas = pdfPreviewStudents.map((s) => s.cedula).filter(Boolean);
  
  const { data: existingStudents } = await supabase
    .from("students")
    .select("cedula")
    .eq("group_id", selectedGroup)
    .in("cedula", cedulasImportadas);
    
  const existingCedulas = new Set((existingStudents || []).map((s) => s.cedula));
  
  const studentsToInsert = pdfPreviewStudents.filter((s) => {
    if (!s.cedula) return true;
    return !existingCedulas.has(s.cedula);
  });
  
  if (studentsToInsert.length === 0) {
      showToast("Todos los estudiantes del PDF ya existen en este grupo.", "success", setToast);
    setShowPdfPreview(false);
    return;
  }
  
  const skippedCount = pdfPreviewStudents.length - studentsToInsert.length;
  
  const { data: inserted, error } = await supabase.from("students").insert(
    studentsToInsert.map(s => ({ ...s, owner_id: session.user.id }))
  ).select();
  if (error) {
    console.error(error);
      showToast("Error al importar: " + error.message, "error", setToast);
    return;
  }
  
  if (inserted) {
    setAllStudents((prev) => [...prev, ...inserted]);
    if (selectedGroup) loadStudents(selectedGroup);
    
      showToast(`${inserted.length} importados exitosamente. ${skippedCount > 0 ? skippedCount + " omitidos por duplicado." : ""}`, "success", setToast);
    setShowPdfPreview(false);
  }
}

async function handleImportStudents(file: File) {
  if (!session?.user?.id) {
    showAuthError();
    return;
  }
  if (!selectedGroup) {
    showToast("Selecciona un grupo antes de importar estudiantes.", "error", setToast);
    return;
  }

  let importedStudents;
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const students = parseStudentsFromExcel(workbook);
    
    importedStudents = (students as ImportedStudent[]).map(s => ({
      ...s,
      group_id: selectedGroup
    }));
  } catch (error: any) {
    console.error("Error parseando Excel:", error);
    showToast(error.message || "No se pudieron identificar las columnas requeridas del Excel.", "error", setToast);
    return;
  }

  const cedulasImportadas = importedStudents
    .map((student: any) => student.cedula)
    .filter(Boolean);

  const { data: existingStudents, error: existingError } = await supabase
    .from("students")
    .select("cedula")
    .eq("group_id", selectedGroup)
    .in("cedula", cedulasImportadas);

  if (existingError) {
    console.error("Error verificando duplicados:", existingError);
    handleShowToast({ message: "Error verificando duplicados: " + existingError.message, type: "error" });
    return;
  }

  const existingCedulas = new Set(
    (existingStudents || []).map((student) => student.cedula)
  );

  const studentsToInsert = importedStudents.filter((student: any) => {
    if (!student.cedula) return true;
    return !existingCedulas.has(student.cedula);
  });

  if (studentsToInsert.length === 0) {
    handleShowToast({ message: "Todos los estudiantes del archivo ya existen en este grupo.", type: "success" });
    return;
  }

  const skippedCount = importedStudents.length - studentsToInsert.length;

  const { data: insertedStudents, error } = await supabase
    .from("students")
    .insert(studentsToInsert.map((s: any) => ({ ...s, owner_id: session.user.id })))
    .select();

  if (error) {
    console.error("Error importando estudiantes:", error);
      showToast("Error al importar estudiantes: " + error.message, "error", setToast);
    return;
  }

  if (insertedStudents) {
    setAllStudents((prev) => [...prev, ...insertedStudents]);
    setStudents((prev) => [...prev, ...insertedStudents]);

    if (skippedCount > 0) {
      handleShowToast({ message: `${insertedStudents.length} estudiantes importados correctamente. ${skippedCount} repetidos fueron omitidos.`, type: "success" });
    } else {
      handleShowToast({ message: `${insertedStudents.length} estudiantes importados correctamente.`, type: "success" });
    }
  }
}

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans">
        <div className="p-8 bg-white rounded-[32px] shadow-2xl shadow-blue-500/5 flex flex-col items-center gap-6 border border-slate-100">
          <div className="w-12 h-12 border-2 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="text-center">
            <h2 className="text-lg font-extrabold text-slate-900 mb-1">Iniciando con Seguridad</h2>
            <p className="text-sm text-slate-500 font-medium tracking-tight">Restaurando tu sesión blindada...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth externalError={authError} />;
  }

  return (
  <div className={`app-shell ${isDarkMode ? "dark-mode" : ""}`}>
    <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
      <div className="sidebar-top">
        <div className="brand-card" style={{ flexDirection: "row", gap: "14px", padding: "14px 16px", alignItems: "center" }}>
          {appSettings.logoUrl ? (
            <img src={appSettings.logoUrl} alt="Logo" style={{ width: "64px", height: "64px", borderRadius: "14px", objectFit: "contain", border: "2px solid #e0e7ff", background: "#fff", padding: "4px", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.08)", flexShrink: 0 }} />
          ) : (
            <div className="brand-icon">▦</div>
          )}

          {sidebarOpen && (
            <div className="brand-copy" style={{ alignItems: "flex-start", textAlign: "left" }}>
              <h2 style={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", fontSize: "16px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em", lineHeight: 1.25, margin: 0, wordBreak: "break-word" }}>{appSettings.institutionName || "Mi Institución"}</h2>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Gestión Docente</p>
            </div>
          )}
        </div>

        <div className="section-header section-header-fixed">
          {sidebarOpen && <span>GRUPOS</span>}

          <button
            className="icon-action"
            type="button"
            title="Crear grupo"
            onClick={handleAddGroup}
          >
            +
          </button>

          <button
            className="icon-action"
            type="button"
            title="Mostrar u ocultar barra lateral"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            ☰
          </button>
        </div>
          
       <div className="sidebar-section">
            <div className="group-list">
              {isCreatingGroup && (
                <div className="new-group-wrap" onClick={(e) => e.stopPropagation()} style={{display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '8px'}}>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Nuevo grupo"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        void saveNewGroup()
                      }
                      if (e.key === "Escape") {
                        setIsCreatingGroup(false)
                        setNewGroupName("Nuevo grupo")
                      }
                    }}
                    className="new-group-input"
                  />
                  <div style={{ display: 'flex', gap: '4px', padding: '0 4px 8px 4px' }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); void saveNewGroup(); }}
                      style={{ flex: 1, background: '#4f46e5', color: '#fff', padding: '6px', fontSize: '11px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}
                    >
                      Guardar
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsCreatingGroup(false); }}
                      style={{ flex: 1, background: '#f1f5f9', color: '#475569', padding: '6px', fontSize: '11px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}   
              {orderedGroups.map((group) => (
                <div
                  key={group.id}
                  className={`group-item ${selectedGroup === group.id ? "active" : ""}`}
                >
                  <button
                    type="button"
                    className="group-main"
                   onClick={() => {
                      setSelectedGroupId(group.id)
                      loadStudents(group.id)
                    }}

                  >
                    <div className="group-avatar">{getInitials(group.name)}</div>

                    {sidebarOpen && (
                      <div className="group-copy">
                        {editingGroupId === group.id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                            <input
                              autoFocus
                              type="text"
                              value={tempGroupName}
                              onChange={(e) => setTempGroupName(e.target.value)}
                              className="group-name-input"
                              placeholder="Nombre"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void saveGroupName(group.id)
                                if (e.key === "Escape") cancelEditingGroup()
                              }}
                            />
                            <div style={{display: 'flex', gap: '4px', marginTop: '6px'}}>
                               <button onClick={(e) => { e.stopPropagation(); void saveGroupName(group.id) }} style={{ flex: 1, backgroundColor: '#4f46e5', color: 'white', fontSize: '11px', padding: '4px', borderRadius: '4px'}}>Guardar</button>
                               <button onClick={(e) => { e.stopPropagation(); cancelEditingGroup() }} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', fontSize: '11px', padding: '4px', borderRadius: '4px'}}>Cerrar</button>
                            </div>
                          </div>
                        ) : (
                         <>
                          <strong>{group.name}</strong>
                            {group.subject ? (
                              <small>{group.subject}, {group.students} estudiantes</small>
                            ) : (
                              <small>{group.students} estudiantes</small>
                            )}
                        </> 
                        
                        )}
                      </div>
                    )}
                  </button>
                    

                  {sidebarOpen && editingGroupId !== group.id && (
                    <div className="group-actions">
                      <button
                        type="button"
                        className="group-action-button danger"
                        title="Eliminar grupo"
                        onClick={() => handleDeleteGroup(group.id)}
                      >
                        🗑
                      </button>

                      <button
                        type="button"
                        className="group-action-button edit"
                        title="Editar nombre"
                        onClick={() => startEditingGroup(group)}
                      >
                        ✎
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      
        <div className="sidebar-bottom">
          {sidebarOpen && (
            <>
              <div className="mini-card">
                <div className="mini-card-header">
                <span>Estadísticas</span>
                <button
                  type="button"
                  className="theme-toggle"
                  title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                  onClick={() => setIsDarkMode((prev) => !prev)}
                >
                  {isDarkMode ? "☀" : "☾"}
                </button>
            </div>
          
            <div className="app">
          <div className="mini-stats">
  <div className="stat-box">
    <small>GRUPOS</small>
    <strong>{orderedGroups.length}</strong>
  </div>

  <div className="stat-box">
    <small>TOTAL ESTUDIANTES</small>
    <strong>{totalStudentsCount}</strong>
  </div>

  </div>
</div>
              </div> { /* Closes mini-card at 1500 */ }
           <div className="teacher-card">
                <div className="teacher-avatar">{appSettings.teacherName ? appSettings.teacherName.charAt(0).toUpperCase() : "D"}</div>
                <div style={{ overflow: "hidden" }}>
                  <small style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{appSettings.teacherEmail || "Docente"}</small>
                  <strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{appSettings.teacherName || "Nombre no asignado"}</strong>
                </div>
              </div>

              <div 
                style={{ 
                  marginTop: "auto", 
                  padding: "24px 0 16px 0", 
                  textAlign: "center",
                  borderTop: "1px solid #f1f5f9",
                  background: "linear-gradient(to bottom, #ffffff, #f8faff)"
                }}
              >
                <div 
                  style={{ 
                    fontSize: "14px", 
                    fontWeight: 900, 
                    color: "#4f46e5", 
                    textTransform: "uppercase", 
                    letterSpacing: "0.2em",
                    textShadow: "0 2px 4px rgba(79, 70, 229, 0.1)",
                    opacity: 0.9,
                    position: "relative",
                    zIndex: 10
                  }}
                >
                  MARKETING IA CR
                </div>
              </div>
            </> 
          )}
        </div>
        {!sidebarOpen && (
            <div className="collapsed-tools">
              <button className="icon-action" type="button" title="Estadísticas">
                ◔
              </button>
              <button className="icon-action" type="button" title="Docente">
                D
              </button>
              <button className="icon-action" type="button" title="Salir">
                ⎋
              </button>
            </div>
            )}          
         </aside>

     <main className="main-area">
      <div className="app-header">
       <header className="topbar">
          <div className="topbar-main">
            <div className="topbar-left">
              
              <div className="clock-card">
                <strong>{timeLabel}</strong>
                <span>{dateLabel}</span>
              </div>

             <div className="headline">
              <h1 className="text-2xl font-bold text-gray-800 tracking-tight leading-none mb-1">{selectedGroupName || "Sin grupos"}</h1>
              <p className="text-gray-500 font-medium text-[12px] uppercase tracking-wider">Panel de control educativo</p>
            </div>

            </div>
          
          <div
  className="topbar-right"
  ref={moreMenuRef}
  style={{
    position: "relative",
    zIndex: 100
  }}
>
  <nav className="nav-tabs">
    {navItems.map((item, index) => (
      <button
        key={item}
        type="button"
        className={`nav-tab ${
          (item === "Asistencia" && activeSection === "attendance") ||
          (item === "Cotidiano" && activeSection === "cotidiano") ||
          (item === "Notas" && activeSection === "notas") ||
          (item === "Anecdotario" && activeSection === "anecdotal") ||
          (item === "Más" && showMoreMenu)
            ? "active"
            : ""
        }`}
        onClick={() => {
          if (item === "Más") {
            setShowMoreMenu((prev) => !prev)
            return
          }

          if (item === "Asistencia") {
            setActiveSection("attendance")
            setShowMoreMenu(false)
          }

          if (item === "Cotidiano") {
            setActiveSection("cotidiano")
            setShowMoreMenu(false)
          }

          if (item === "Notas") {
            setActiveSection("notas")
            setShowMoreMenu(false)
          }

          if (item === "Anecdotario") {
            setActiveSection("anecdotal")
            setShowMoreMenu(false)
          }
        }}
      >
        <span className="nav-tab-icon">
          {item === "Asistencia" && <CalendarCheck size={16} />}
          {item === "Cotidiano" && <NotebookPen size={16} />}
          {item === "Notas" && <StickyNote size={16} />}
          {item === "Anecdotario" && <ScrollText size={16} />}
          {item === "Asistente IA" && <Bot size={16} />}
          {item === "Más" && <Ellipsis size={16} />}
        </span>
        <span>{item}</span>
      </button>
    ))}
  </nav>
{showMoreMenu && (
  <div className="more-menu">

    <button
      className="more-menu-item"
    onClick={() => {
        setActiveSection("report")
         setShowMoreMenu(false)
         }}
    >
      <span className="more-menu-icon">
        <FileBarChart size={18} />
      </span>
      Reporte
    </button>

    <button
  className="more-menu-item"
  onClick={() => {
    setActiveSection("schedule")
    setShowMoreMenu(false)
  }}
>
  <span className="more-menu-icon">
    <Clock size={18} />
  </span>
  Horario
</button>

   <button
  className="more-menu-item"
  onClick={() => {
    setActiveSection("students")
    setShowMoreMenu(false)
  }}
>
  <span className="more-menu-icon">
    <Users size={18} />
  </span>
  Estudiantes
</button>

    <button
      className="more-menu-item"
      onClick={() => {
  setActiveSection("planning");
  setShowMoreMenu(false);
}}
    >
      <span className="more-menu-icon">
        <FileText size={18} />
      </span>
      Planeamiento
    </button>

    <button
      className="more-menu-item"
      onClick={() => {
  setActiveSection("settings");
  setShowMoreMenu(false);
}}

    >
      <span className="more-menu-icon">
        <Settings size={18} />
      </span>
      Configuración
    </button>

    <div style={{ height: "1px", background: "#f1f5f9", margin: "8px 12px" }} />

    <button
      className="more-menu-item"
      style={{ color: "#ef4444" }}
      onClick={async () => {
        await supabase.auth.signOut();
        setShowMoreMenu(false);
      }}
    >
      <span className="more-menu-icon" style={{ color: "#ef4444" }}>
        <LogOut size={18} />
      </span>
      Cerrar sesión
    </button>

    </div>
  )}
</div> 
    </div> 
  </header> 
</div> 

  {/* Selector de Periodo Académico (Opción B) */}
  <div style={{ 
    padding: "8px 32px", 
    background: academicPeriod === 'semester2' ? "#ecfdf5" : "#f8fafc", 
    borderBottom: academicPeriod === 'semester2' ? "2px solid #10b981" : "1px solid #e2e8f0", 
    display: "flex", alignItems: "center", gap: "24px", transition: "all 0.3s" 
  }}>
    <span style={{ fontSize: "12px", fontWeight: 800, color: academicPeriod === 'semester2' ? "#047857" : "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", transition: "color 0.3s" }}>Periodo Lectivo:</span>
    <div style={{ background: academicPeriod === 'semester2' ? "#d1fae5" : "#edf2f7", padding: "4px", borderRadius: "12px", display: "flex", gap: "4px", transition: "background 0.3s" }}>
      <button 
        onClick={() => setAcademicPeriod('semester1')}
        style={{ 
          padding: "6px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, border: "none", cursor: "pointer", transition: "all 0.2s",
          background: academicPeriod === 'semester1' ? "#fff" : "transparent",
          color: academicPeriod === 'semester1' ? "#4f46e5" : (academicPeriod === 'semester2' ? "#059669" : "#64748b"),
          boxShadow: academicPeriod === 'semester1' ? "0 4px 6px -1px rgba(0, 0, 0, 0.1)" : "none"
        }}>
        I Semestre
      </button>
      <button 
        onClick={() => setAcademicPeriod('semester2')}
        style={{ 
          padding: "6px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, border: "none", cursor: "pointer", transition: "all 0.2s",
          background: academicPeriod === 'semester2' ? "#10b981" : "transparent",
          color: academicPeriod === 'semester2' ? "#ffffff" : "#64748b",
          boxShadow: academicPeriod === 'semester2' ? "0 4px 12px -2px rgba(16, 185, 129, 0.4)" : "none"
        }}>
        II Semestre
      </button>
      <button 
        onClick={() => setAcademicPeriod('annual')}
        style={{ 
          padding: "6px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, border: "none", cursor: "pointer", transition: "all 0.2s",
          background: academicPeriod === 'annual' ? "#fff" : "transparent",
          color: academicPeriod === 'annual' ? "#4f46e5" : (academicPeriod === 'semester2' ? "#059669" : "#64748b"),
          boxShadow: academicPeriod === 'annual' ? "0 4px 6px -1px rgba(0, 0, 0, 0.1)" : "none"
        }}>
        Total Anual
      </button>
    </div>
    
    {academicPeriod === 'annual' && (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto", background: "rgba(79, 70, 229, 0.05)", padding: "4px 12px", borderRadius: "20px", border: "1px dashed #c7d2fe" }}>
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4f46e5" }}></div>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#4f46e5" }}>Vista de Consolidación (Lectura)</span>
      </div>
    )}
  </div>

    {activeSection === "schedule" && (
      <section className="content-wrap" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "24px", alignItems: "start" }}>
          <div className="module-card" style={{ position: "sticky", top: "24px" }}>
            <div style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                <div style={{ background: "#eff6ff", color: "#3b82f6", padding: "10px", borderRadius: "14px" }}>
                  <CalendarCheck size={24} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: "#0f172a" }}>Agregar Horario</h2>
                  <p style={{ margin: 0, fontSize: "11px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Asignación de lecciones</p>
                </div>
              </div>
              
              <div style={{ display: "grid", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 700, color: "#475569" }}>GRUPO</label>
                  <select
                    value={newScheduleGroup}
                    onChange={(e) => {
                      const value = e.target.value
                      setNewScheduleGroup(value === "" ? "" : Number(value))
                    }}
                    style={{ width: "100%", height: "48px", borderRadius: "14px", border: "1px solid #dfe3f0", padding: "0 14px", fontSize: "15px", background: "#fff", fontWeight: 500 }}
                  >
                    <option value="">Selecciona un grupo</option>
                    {orderedGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 700, color: "#475569" }}>DÍA</label>
                  <select 
                    value={scheduleDay} 
                    onChange={(e) => setScheduleDay(e.target.value)} 
                    style={{ width: "100%", height: "48px", borderRadius: "14px", border: "1px solid #dfe3f0", padding: "0 14px", fontSize: "15px", background: "#fff", fontWeight: 500 }}
                  >
                    <option value="">Selecciona un día</option>
                    {dayOrder.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 700, color: "#475569" }}>INICIO</label>
                    <input type="text" placeholder="07:00" value={scheduleStartTime} onChange={(e) => setScheduleStartTime(formatTime(e.target.value))} style={{ width: "100%", height: "48px", borderRadius: "14px", border: "1px solid #dfe3f0", padding: "0 14px", fontSize: "15px", fontWeight: 500 }} />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 700, color: "#475569" }}>FIN</label>
                    <input type="text" placeholder="07:40" value={scheduleEndTime} onChange={(e) => setScheduleEndTime(formatTime(e.target.value))} style={{ width: "100%", height: "48px", borderRadius: "14px", border: "1px solid #dfe3f0", padding: "0 14px", fontSize: "15px", fontWeight: 500 }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "60% 40%", gap: "12px" }}>
                  <div style={{ minWidth: 0 }}>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 700, color: "#475569" }}>MATERIA</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Informática" 
                      value={scheduleSubject} 
                      onChange={(e) => setScheduleSubject(e.target.value)} 
                      list="subject-suggestions-repaired-v3" 
                      style={{ width: "100%", height: "48px", borderRadius: "14px", border: "1px solid #dfe3f0", padding: "0 14px", fontSize: "15px", fontWeight: 500 }} 
                    />
                    <datalist id="subject-suggestions-repaired-v3">
                      {subjectSuggestions.map((s) => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 700, color: "#475569" }}>LECCIONES</label>
                    <select
                      value={scheduleLessons}
                      onChange={(e) => setScheduleLessons(e.target.value)}
                      style={{ width: "100%", height: "48px", borderRadius: "14px", border: "1px solid #dfe3f0", padding: "0 14px", fontSize: "15px", background: "#fff", fontWeight: 500 }}
                    >
                      {[1, 2, 3, 4, 5, 6].map(num => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleAddSchedule}
                  className="primary-button"
                  style={{ width: "100%", height: "54px", borderRadius: "16px", marginTop: "10px", fontSize: "16px", fontWeight: 800, boxShadow: "0 10px 15px -3px rgba(37, 99, 235, 0.2)" }}
                >
                  {editingScheduleId !== null ? "Guardar Cambios" : "Agregar Horario"}
                </button>
              </div>
            </div>
          </div>


          {/* COLUMNA DERECHA: RESULTADOS */}
          <div style={{ display: "grid", gap: "24px" }}>


            {/* TABLA HORARIO CLASES GRUPO */}
            <div className="module-card">
              <div className="module-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ background: "#f5f3ff", color: "#4f46e5", padding: "10px", borderRadius: "14px" }}>
                    <Clock size={24} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: "#0f172a" }}>Horario de clases (grupo)</h2>
                    <p style={{ margin: 0, fontSize: "11px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Resumen del curso seleccionado</p>
                  </div>
                </div>
              </div>
              <div style={{ padding: "0 24px 24px 24px" }}>
                {newScheduleGroup === "" ? (
                   <div style={{ textAlign: "center", padding: "40px", background: "#f8fafc", borderRadius: "24px", border: "1px dashed #e2e8f0", marginTop: "20px" }}>
                     <p style={{ color: "#64748b", fontWeight: 600 }}>Selecciona un grupo a la izquierda para ver su horario.</p>
                   </div>
                ) : selectedScheduleItems.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", background: "#f8fafc", borderRadius: "24px", border: "1px dashed #e2e8f0", marginTop: "20px" }}>
                     <p style={{ color: "#64748b", fontWeight: 600 }}>Este grupo no tiene horarios registrados.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto", marginTop: "20px" }}>
                    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "12px", textAlign: "left", fontSize: "11px", color: "#94a3b8", fontWeight: 800, textTransform: "uppercase" }}>DÍA</th>
                          <th style={{ padding: "12px", textAlign: "left", fontSize: "11px", color: "#94a3b8", fontWeight: 800, textTransform: "uppercase" }}>HORA</th>
                          <th style={{ padding: "12px", textAlign: "left", fontSize: "11px", color: "#94a3b8", fontWeight: 800, textTransform: "uppercase" }}>MATERIA</th>
                          <th style={{ padding: "12px", textAlign: "center", fontSize: "11px", color: "#94a3b8", fontWeight: 800, textTransform: "uppercase" }}>ACCIONES</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedScheduleItems.map((item) => (
                          <tr key={item.id} style={{ background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                            <td style={{ padding: "14px 12px", borderRadius: "12px 0 0 12px", fontWeight: 700, color: "#1e293b" }}>{item.day}</td>
                            <td style={{ padding: "14px 12px", color: "#64748b", fontWeight: 500 }}>{item.startTime} - {item.endTime}</td>
                            <td style={{ padding: "14px 12px", fontWeight: 800, color: "#4f46e5" }}>{item.subject}</td>
                            <td style={{ padding: "14px 12px", borderRadius: "0 12px 12px 0", textAlign: "center" }}>
                                <button 
                                  onClick={() => handleDeleteSchedule(item.id)}
                                  className="flex items-center justify-center mx-auto w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200"
                                >
                                  <Trash2 size={14} />
                                </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* CUADRÍCULA SEMANAL */}
            <div className="module-card">
              <div className="module-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ background: "#f5f3ff", color: "#4f46e5", padding: "10px", borderRadius: "14px" }}>
                    <CalendarCheck size={24} />
                  </div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: "#0f172a" }}>Horario de la Semana</h2>
                </div>
                
                <div style={{ background: "#eff6ff", color: "#1e40af", padding: "6px 12px", borderRadius: "8px", fontWeight: 800, fontSize: "12px", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>TOTAL SEMANAL:</span>
                  <span style={{ background: "#3b82f6", color: "#fff", padding: "2px 8px", borderRadius: "6px" }}>{totalLessonsTeacher} LECCIONES</span>
                </div>

                <button 
                  onClick={() => setShowSchedulePreview(true)} 
                  className="secondary-button"
                  style={{ background: "#f5f3ff", color: "#4f46e5", border: "1px solid #c7d2fe", padding: "10px 18px", borderRadius: "14px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <FileText size={16} />
                  VISTA PREVIA PDF
                </button>
              </div>
              <div style={{ padding: "24px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
                  {dayOrder.map(day => (
                    <div key={day} style={{ background: "#f8fafc", borderRadius: "18px", padding: "12px", border: "1px solid #e2e8f0", minHeight: "200px" }}>
                      <h3 style={{ fontSize: "11px", fontWeight: 900, color: "#4f46e5", textAlign: "center", textTransform: "uppercase", marginBottom: "12px", letterSpacing: "0.05em" }}>{day}</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {scheduleItems.filter(s => s.day === day).map(item => (
                          <div key={item.id} style={{ background: "#fff", padding: "8px 10px", borderRadius: "12px", fontSize: "10px", border: "1px solid #f1f5f9", boxShadow: "0 2px 6px rgba(0,0,0,0.03)", position: "relative" }}>
                            <div style={{ fontWeight: 800, color: "#94a3b8", fontSize: "9px" }}>{item.startTime} - {item.endTime}</div>
                            <div style={{ fontWeight: 800, color: "#1e293b", marginTop: "2px" }}>{item.groupName}</div>
                            <div style={{ color: "#64748b", fontSize: "9px", marginTop: "1px", fontWeight: 600 }}>{item.subject}</div>
                            <div style={{ color: "#4f46e5", fontSize: "9px", marginTop: "2px", fontWeight: 800 }}>Lecciones: {item.lessons}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    )}



{activeSection === "attendance" && <AsistenciaPage session={session} academicPeriod={academicPeriod} />}
{activeSection === "cotidiano" && (
  <CotidianoPage 
    session={session} 
    students={students} 
    selectedGroupId={selectedGroup}
    groupName={selectedGroupName}
  />
)}
{activeSection === "settings" && <ConfiguracionPage session={session} appSettings={appSettings} setAppSettings={setAppSettings} groups={stableGroups} selectedGroupId={selectedGroup} groupConfigs={groupConfigs} setGroupConfigs={setGroupConfigs} />}
{activeSection === "notas" && (
  <NotasPage 
    session={session} 
    academicPeriod={academicPeriod} 
    evaluationRubrics={stableEvaluationRubrics} 
    students={students} 
    groupName={selectedGroupName} 
    groupId={selectedGroup} 
    minimumPassingGrade={selectedGroup ? (groupConfigs[selectedGroup]?.minimumPassingGrade ?? 65) : 65} 
    setToast={handleShowToast}
  />
)}
{activeSection === "anecdotal" && <AnecdoticoPage session={session} groups={stableGroups} allStudents={allStudents} activeGroupId={selectedGroup} />}
{activeSection === "report" && (
  <ReportesPage 
    session={session}
    appSettings={appSettings} 
    groups={stableGroups} 
    activeGroupId={selectedGroup} 
    allStudents={allStudents} 
    academicPeriod={academicPeriod}
    evaluationRubrics={stableEvaluationRubrics}
  />
)}


  {activeSection === "students" && (
  <section className="content-wrap">



    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.7fr 0.9fr",
        gap: "24px",
        alignItems: "start",
      }}
    >
      <div className="module-card">
        <div
          className="module-header"
          style={{
            position: "sticky",
            top: "84px",
            zIndex: 40,
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(8px)",
            padding: "16px 18px",
            margin: "-18px -18px 18px -18px",
            borderBottom: "1px solid #e2e8f0",
            borderTopLeftRadius: "24px",
            borderTopRightRadius: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div style={{ flex: '0 0 auto' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Estudiantes</h2>
          </div>

          {selectedGroupData && (
            <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
               <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                  <Users size={14} />
                  <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                    Grupo Activo: {selectedGroupData.name}
                  </span>
               </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
               onClick={() => {
                 setIsGuiaConfigOpen(!isGuiaConfigOpen);
                 if (!isGuiaConfigOpen && selectedGroupData) {
                   setNewStudentGuiaName(selectedGroupData.guia_name || "");
                   setNewStudentGuiaPhone(selectedGroupData.guia_phone || "");
                 }
               }}
               className="secondary-button"
               style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", borderRadius: "10px", fontSize: "12px" }}
            >
              <Users size={14} />
              {isGuiaConfigOpen ? "Cerrar Panel" : "Configurar Guía"}
            </button>

            <input
              type="text"
              placeholder="Buscar estudiante"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="date-input"
              style={{ maxWidth: "220px" }}
            />
          </div>
        </div>

        {isGuiaConfigOpen && (
          <div style={{ 
            padding: "16px 18px", 
            background: "#f8faff", 
            borderBottom: "1px solid #e0e7ff",
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto",
            gap: "16px",
            alignItems: "flex-end",
            animation: "slideDown 0.2s ease-out"
          }}>
            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 800, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.05em" }}>Profesor Guía de la Sección</label>
              <input
                placeholder="Nombre del profesor guía"
                value={newStudentGuiaName}
                onChange={(e) => setNewStudentGuiaName(e.target.value)}
                className="date-input"
                style={{ background: "#fff" }}
              />
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 800, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.05em" }}>Teléfono del Guía</label>
              <input
                placeholder="Teléfono"
                value={newStudentGuiaPhone}
                onChange={(e) => setNewStudentGuiaPhone(e.target.value)}
                className="date-input"
                style={{ background: "#fff" }}
              />
            </div>
            <button 
              className="primary-button" 
              onClick={saveGroupGuiaInfo}
              style={{ padding: "10px 20px" }}
            >
              Guardar Guía
            </button>
          </div>
        )}

        <div style={{ padding: "20px" }}>
          {(() => {
            const lowerSearch = studentSearch.toLowerCase().trim();
            const filteredStudents = lowerSearch
              ? students.filter((s: any) =>
                  s.name.toLowerCase().includes(lowerSearch) ||
                  (s.cedula && s.cedula.toLowerCase().includes(lowerSearch))
                )
              : students;

            if (students.length === 0) {
              return (
                <div style={{ color: "#64748b" }}>
                  No hay estudiantes registrados en este grupo.
                </div>
              );
            }

            if (filteredStudents.length === 0) {
              return (
                <div style={{ color: "#64748b" }}>
                  No se encontraron resultados para "{studentSearch}".
                </div>
              );
            }

            return filteredStudents.map((student: any) => (
              <div
                key={student.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  padding: "18px 22px",
                  marginBottom: "16px",
                  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.03)",
                }}
                className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                {/* Header (Student Name + Edit) */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "14px",
                  borderBottom: "1px solid #f1f5f9",
                  paddingBottom: "12px",
                }}>
                  <div style={{ fontWeight: 800, fontSize: "16px", color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.2px" }}>
                    {student.name}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button 
                      title="Editar estudiante"
                      onClick={() => startEditingStudent(student)}
                      className="flex justify-center items-center w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border border-transparent shadow-sm hover:border-indigo-100 cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[15px] h-[15px]">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.12l-3.122.936.936-3.122a4.5 4.5 0 011.12-1.89l13.04-13.04z" />
                      </svg>
                    </button>
                    <button 
                      title="Eliminar estudiante"
                      onClick={() => setStudentToDelete(student)}
                      className="flex justify-center items-center w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors border border-transparent shadow-sm hover:border-red-100 cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Soft Grid Data */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: "16px 24px",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Cédula</span>
                    <span style={{ fontSize: "14px", color: "#334155", fontWeight: 500 }}>{student.cedula || "—"}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Género</span>
                    <span style={{ fontSize: "14px", color: "#334155", fontWeight: 500, textTransform: "capitalize" }}>{student.gender?.toLowerCase() || "—"}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Correo MEP</span>
                    {student.mep_email ? (
                      <a href={`mailto:${student.mep_email}`} style={{ fontSize: "14px", color: "#4f46e5", fontWeight: 500, textDecoration: "none", wordBreak: "break-all" }} className="hover:underline">
                        {student.mep_email}
                      </a>
                    ) : (
                      <span style={{ fontSize: "14px", color: "#334155", fontWeight: 500 }}>—</span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Encargado 1</span>
                    <span style={{ fontSize: "14px", color: "#334155", fontWeight: 500 }}>{student.parent1_phone || "—"}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Encargado 2</span>
                    <span style={{ fontSize: "14px", color: "#334155", fontWeight: 500 }}>{student.parent2_phone || "—"}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Apoyo Curricular</span>
                    <span style={{ 
                      fontSize: "12px", 
                      fontWeight: 600, 
                      padding: "4px 8px", 
                      borderRadius: "6px", 
                      background: student.apoyo_curricular === "significativo" ? "#fee2e2" : student.apoyo_curricular === "no_significativo" ? "#e0e7ff" : "#f1f5f9",
                      color: student.apoyo_curricular === "significativo" ? "#991b1b" : student.apoyo_curricular === "no_significativo" ? "#3730a3" : "#64748b"
                    }}>
                      {student.apoyo_curricular === "no_significativo"
                        ? "No significativo"
                        : student.apoyo_curricular === "significativo"
                        ? "Significativo"
                        : "Sin apoyo"}
                    </span>
                  </div>

                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      <div className="module-card sticky top-28 self-start">
        <div className="module-header">
          <h2>{editingStudentId ? "Editar Estudiante" : "Registrar Estudiante"}</h2>
        </div>

        <div style={{ padding: "20px", display: "grid", gap: "16px" }}>
          <div style={{ display: "grid", gap: "6px" }}>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cédula</label>
            <input
              type="text"
              placeholder="Ej: 112340567"
              value={newStudentCedula}
              onChange={(e) => {
                const val = e.target.value;
                setNewStudentCedula(val);
                const stripped = val.replace(/\D/g, "");
                if (stripped) {
                  setNewStudentEmail(`${stripped}@est.mep.go.cr`);
                } else {
                  setNewStudentEmail("");
                }
              }}
              className="date-input"
            />
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Nombre completo</label>
            <input
              type="text"
              placeholder="Nombre del estudiante"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              className="date-input"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Género</label>
              <select
                value={newStudentGender}
                onChange={(e) => setNewStudentGender(e.target.value)}
                className="date-input"
              >
                <option value="">Seleccionar...</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Apoyo Curricular</label>
              <select
                value={newStudentApoyo}
                onChange={(e) => setNewStudentApoyo(e.target.value as any)}
                className="date-input"
              >
                <option value="">Sin apoyo</option>
                <option value="no_significativo">No significativo</option>
                <option value="significativo">Significativo</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Correo MEP</label>
            <input
              placeholder="Auto-generado / Manual"
              value={newStudentEmail}
              onChange={(e) => setNewStudentEmail(e.target.value)}
              className="date-input"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Teléfono Encargado 1</label>
              <input
                placeholder="Ej: 8888-8888"
                value={newStudentGuardian1}
                onChange={(e) => setNewStudentGuardian1(e.target.value)}
                className="date-input"
              />
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Teléfono Encargado 2</label>
              <input
                placeholder="Ej: 7777-7777"
                value={newStudentGuardian2}
                onChange={(e) => setNewStudentGuardian2(e.target.value)}
                className="date-input"
              />
            </div>
          </div>

          {!selectedGroup && (
            <p style={{ fontSize: "11px", color: "#ef4444", fontWeight: 700, marginBottom: "8px", textAlign: "center" }}>
              Debes seleccionar un grupo para registrar estudiantes
            </p>
          )}
          <button 
            className="primary-button" 
            onClick={handleAddStudent}
            disabled={!selectedGroup}
            style={{
              width: "100%",
              opacity: selectedGroup ? 1 : 0.5,
              cursor: selectedGroup ? "pointer" : "not-allowed",
              padding: "14px"
            }}
          >
            {editingStudentId ? "Guardar Cambios" : "+ Agregar Estudiante"}
          </button>
          
          {editingStudentId && (
            <button className="secondary-button" onClick={cancelEditStudent} style={{ marginTop: "8px", width: "100%" }}>
              Cancelar Edición
            </button>
          )}

          <div
            style={{
              marginTop: "18px",
              borderTop: "1px solid #e5e7eb",
              paddingTop: "14px",
            }}
          >
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleImportStudents(file);
              }}
              onClick={() => document.getElementById("studentFileInput")?.click()}
              style={{
                border: "2px dashed #c7d2fe",
                background: "linear-gradient(180deg, #f8faff 0%, #f3f6ff 100%)",
                borderRadius: "20px",
                padding: "18px 16px",
                textAlign: "center",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(79, 70, 229, 0.08)",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#374151",
                  marginBottom: "6px",
                }}
              >
                📄 Carga Masiva
              </div>

              <div
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  marginBottom: "10px",
                }}
              >
                Arrastra aquí tu archivo Excel del PIAD o haz clic para subirlo
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadTemplate();
                  }}
                >
                  ⬇ Plantilla
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById("studentFileInput")?.click();
                  }}
                >
                  ⬆ Subir Excel
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  style={{ borderColor: "#c7d2fe", color: "#4f46e5", background: "#f5f7ff" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById("pdfFileInput")?.click();
                  }}
                >
                  📄 Subir PDF
                </button>
              </div>

              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                id="studentFileInput"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportStudents(file);
                }}
              />

              <input
                type="file"
                accept=".pdf"
                style={{ display: "none" }}
                id="pdfFileInput"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportPdf(file);
                }}
              />
           </div>
        </div>
      </div>
    </div>
  </div>
    </section>
  )}

{groupToDelete && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 42, 0.45)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "16px",
    }}
      >
    <div
      style={{
        width: "100%",
        maxWidth: "520px",
        background: "#ffffff",
        borderRadius: "20px",
        padding: "24px",
        boxShadow: "0 20px 60px rgba(15, 23, 42, 0.20)",
        border: "1px solid #e5e7eb",
      }}
      >
      <h3
        style={{
          margin: 0,
          fontSize: "22px",
          fontWeight: 800,
          color: "#0f172a",
        }}
             
      >
        Eliminar grupo
      </h3>

      <p
        style={{
          marginTop: "14px",
          marginBottom: "10px",
          fontSize: "15px",
          lineHeight: 1.6,
          color: "#475569",
        }}
      >
        Vas a eliminar el grupo <strong>{groupToDelete.name}</strong> de forma
        definitiva.
      </p>

      <p
        style={{
          marginTop: 0,
          marginBottom: "22px",
          fontSize: "14px",
          lineHeight: 1.6,
          color: "#64748b",
        }}
      >
        También se eliminarán todos los datos asociados a este grupo.
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={cancelDeleteModal}
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#334155",
            borderRadius: "12px",
            padding: "10px 16px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={confirmDeleteGroup}
          style={{
            border: "1px solid #ef4444",
            background: "#ef4444",
            color: "#ffffff",
            borderRadius: "12px",
            padding: "10px 16px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Sí, eliminar
        </button>
      </div>
    </div>
  </div>
)}

{isImportingPdf && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
    <div style={{ background: "#fff", padding: "32px", borderRadius: "28px", width: "100%", maxWidth: "420px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
        <div style={{ background: "#eef2ff", padding: "12px", borderRadius: "16px", color: "#4f46e5" }}>
          <Loader2 size={28} className="animate-spin" />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>Procesando PDF</h3>
          <p style={{ margin: "2px 0 0", fontSize: "14px", color: "#64748b" }}>Analizando lista oficial...</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {pdfImportSteps.map((step) => (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: "12px", opacity: step.status === 'waiting' ? 0.4 : 1, transition: "all 0.3s" }}>
            {step.status === 'done' ? (
              <CheckCircle2 size={18} color="#10b981" />
            ) : step.status === 'loading' ? (
              <Loader2 size={18} color="#4f46e5" className="animate-spin" />
            ) : (
              <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: "2px solid #e2e8f0" }} />
            )}
            <span style={{ fontSize: "14px", fontWeight: step.status === 'loading' ? 700 : 500, color: step.status === 'done' ? "#0f172a" : "#475569" }}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Progreso de análisis</span>
          <span style={{ fontSize: "12px", fontWeight: 800, color: "#4f46e5" }}>{pdfProgress}%</span>
        </div>
        <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
          <div style={{ width: `${pdfProgress}%`, height: "100%", background: "#4f46e5", borderRadius: "999px", transition: "width 0.3s ease" }} />
        </div>
      </div>
        </div>
      </div>
    )}

{showPdfPreview && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "24px" }}>
    <div style={{ background: "#fff", width: "100%", maxWidth: "840px", maxHeight: "85vh", borderRadius: "28px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.25)", border: "1px solid #e2e8f0" }}>
      <div style={{ padding: "28px 32px", borderBottom: "1px solid #f1f5f9" }}>
        <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 900, color: "#0f172a" }}>Vista Previa de Estudiantes ({pdfPreviewStudents.length})</h2>
        <p style={{ margin: "8px 0 0 0", color: "#64748b", fontSize: "15px", fontWeight: 500 }}>Revisa los datos extraídos del PDF antes de guardarlos en este grupo.</p>
      </div>
      
      <div style={{ padding: "16px 32px", overflowY: "auto", flex: 1 }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px", textAlign: "left" }}>
          <thead>
            <tr>
              <th style={{ padding: "8px 0", color: "#94a3b8", fontWeight: 800, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Nombre</th>
              <th style={{ padding: "8px 0", color: "#94a3b8", fontWeight: 800, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cédula</th>
              <th style={{ padding: "8px 0", color: "#94a3b8", fontWeight: 800, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Correo MEP</th>
            </tr>
          </thead>
          <tbody>
            {pdfPreviewStudents.map((s, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "14px 0", fontWeight: 700, color: "#1e293b", fontSize: "15px", textTransform: "uppercase" }}>{s.name}</td>
                <td style={{ padding: "14px 0", color: "#64748b", fontSize: "14px", fontWeight: 500 }}>{s.cedula}</td>
                <td style={{ padding: "14px 0", color: "#6366f1", fontWeight: 600, fontSize: "14px" }}>{s.mep_email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div style={{ padding: "24px 32px", background: "#f8fafc", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "16px" }}>
        <button 
          onClick={() => setShowPdfPreview(false)}
          style={{ background: "transparent", border: "none", color: "#64748b", fontWeight: 700, fontSize: "15px", cursor: "pointer", transition: "color 0.2s" }}
          onMouseOver={(e) => e.currentTarget.style.color = "#0f172a"}
          onMouseOut={(e) => e.currentTarget.style.color = "#64748b"}
        >
          Cancelar
        </button>
        <button 
          className="primary-button" 
          onClick={confirmPdfImport}
          style={{ padding: "12px 32px", borderRadius: "16px", fontSize: "15px", fontWeight: 700, boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.3)" }}
        >
          Confirmar y Guardar
        </button>
      </div>
    </div>
  </div>
)}

</main>
{/* Sistema de Toasts */}
      {toast && (
        <div 
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: toast.type === 'success' ? '#10b981' : '#ef4444',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
            zIndex: 9999,
            fontWeight: 700,
            animation: 'slideUp 0.3s ease-out'
          }}
        >
          {toast.message}
        </div>
      )}
      {showOnboarding && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '16px',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '480px',
            background: '#ffffff',
            borderRadius: '32px',
            padding: '40px',
            boxShadow: '0 25px 70px rgba(0,0,0,0.15)',
            position: 'relative',
            overflow: 'hidden',
            animation: 'modalEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Background Accent */}
            <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', borderRadius: '0 0 0 100%', opacity: 0.5 }}></div>

            <div style={{ position: 'relative' }}>
              <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', marginBottom: '12px', letterSpacing: '-0.02em' }}>
                🚀 Bienvenido(a) a Gestión Docente
              </h2>
              <p style={{ fontSize: '16px', color: '#64748b', marginBottom: '32px', fontWeight: 500, lineHeight: 1.5 }}>
                Organiza tu trabajo en pocos pasos y deja tu espacio listo para empezar.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '40px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f5f3ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800 }}>1</div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>📝 Paso 1: Crear tu primer grupo</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>Ve a la barra lateral <strong>Grupos</strong> y presiona el botón <strong>+</strong>.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f5f3ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800 }}>2</div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>👥 Paso 2: Agregar estudiantes</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>Ingresa a <strong>Más &gt; Estudiantes</strong> para cargar tu lista de forma manual o masiva.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f5f3ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800 }}>3</div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>🗓️ Paso 3: Crear el horario</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>Ingresa a <strong>Más &gt; Horarios</strong> y define los días, horas y materias.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f5f3ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800 }}>4</div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>⚙️ Paso 4: Configurar la evaluación</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>Ingresa a <strong>Más &gt; Configuración</strong> para definir los porcentajes.</p>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
                <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', marginBottom: '20px', fontWeight: 600 }}>
                  Cuando completes estos pasos, tendrás tu grupo listo para trabajar.
                </p>
                <button 
                  onClick={handleCloseOnboarding}
                  style={{
                    width: '100%',
                    background: '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    padding: '16px',
                    borderRadius: '16px',
                    fontSize: '16px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 10px 20px rgba(79, 70, 229, 0.2)',
                    transition: 'transform 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  Entendido, empezar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {studentToDelete && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-card animate-in fade-in zoom-in duration-200" style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: '#fef2f2', color: '#ef4444', display: 'grid', placeItems: 'center', marginBottom: '20px' }}>
                <AlertTriangle size={28} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>¿Eliminar estudiante?</h3>
              <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, marginBottom: '24px' }}>
                Estás a punto de eliminar permanentemente a <strong>{studentToDelete.name}</strong>. Esta acción no se puede deshacer.
              </p>
              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <button 
                  onClick={() => setStudentToDelete(null)}
                  disabled={isDeletingStudent}
                  style={{ flex: 1, padding: '12px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeleteStudent}
                  disabled={isDeletingStudent}
                  style={{ flex: 1, padding: '12px', borderRadius: '14px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {isDeletingStudent ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {scheduleConflict && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-card animate-in fade-in zoom-in duration-200" style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: '#fff7ed', color: '#f97316', display: 'grid', placeItems: 'center', marginBottom: '24px', boxShadow: '0 8px 16px rgba(249, 115, 22, 0.1)' }}>
                <AlertTriangle size={32} />
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#1e293b', marginBottom: '12px' }}>¡Conflicto de Horario!</h3>
              <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '20px', width: '100%', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '15px', color: '#475569', margin: 0, fontWeight: 500 }}>
                  El grupo <strong style={{ color: '#0f172a' }}>{scheduleConflict.groupName}</strong> ya tiene asignado este espacio el día <strong style={{ color: '#0f172a' }}>{scheduleConflict.day}</strong> de <strong style={{ color: '#0f172a' }}>{scheduleConflict.startTime} a {scheduleConflict.endTime}</strong>.
                </p>
              </div>
              <button 
                onClick={() => setScheduleConflict(null)}
                className="primary-button"
                style={{ width: '100%', background: '#f97316', padding: '14px', borderRadius: '16px' }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {showSchedulePreview && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-card animate-in fade-in zoom-in duration-200" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>Vista Previa del PDF</h3>
                <button onClick={() => setShowSchedulePreview(false)} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
              
              <div style={{ background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '24px', padding: '32px', marginBottom: '32px' }}>
                <div style={{ textAlign: 'center' }}>
                  <Clock size={40} style={{ color: '#4f46e5', marginBottom: '16px' }} />
                  <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>Generando Horario Profesional</h4>
                  <p style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>El archivo incluirá todos tus grupos ordenados por día, con el formato oficial seleccionado.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => setShowSchedulePreview(false)}
                  className="secondary-button"
                  style={{ flex: 1, padding: '14px' }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={generateSchedulePDF}
                  className="primary-button"
                  style={{ flex: 1, padding: '14px' }}
                >
                  Descargar Ahora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalEntrance {
          from { transform: scale(0.9) translateY(20px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

