import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fbncwutobgbkparudssw.supabase.co';
const supabaseAnonKey = 'sb_publishable_E81DHILIJ0qNYJUsjq1YAA_BXsPEqLA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const groupId = 33; // Let's find the group ID. Wait, let's query all groups first.
  const { data: groups } = await supabase.from("groups").select("id, name");
  console.log("GROUPS:", groups);

  // Let's assume the active group is the one with name "11-1/11-4" or similar.
  const targetGroup = groups?.find(g => g.name.includes("11-1")) || groups?.[0];
  if (!targetGroup) return;

  const gid = targetGroup.id;
  console.log("TARGET GROUP:", targetGroup);

  const { data: students } = await supabase
    .from("students")
    .select("id, name, cedula")
    .eq("group_id", gid);

  if (!students || students.length === 0) {
    console.log("No students in group", gid);
    return;
  }

  const studentIds = students.map(s => s.id);
  const periodToLoad = 'semester1';

  // 1. Asistencia
  const { data: attData } = await supabase
    .from("attendance_lessons")
    .select("student_id, status")
    .in("student_id", studentIds)
    .eq("period", periodToLoad);

  const attCounts: Record<number, { total: number; present: number }> = {};
  studentIds.forEach(id => { attCounts[id] = { total: 0, present: 0 }; });
  (attData || []).forEach(row => {
    const sid = row.student_id;
    if (!attCounts[sid]) attCounts[sid] = { total: 0, present: 0 };
    attCounts[sid].total += 1;
    const st = String(row.status).toUpperCase();
    if (st === "P" || st === "PRESENTE") attCounts[sid].present += 1;
    else if (st === "T" || st.includes("TARD")) attCounts[sid].present += 0.5;
  });

  const attPct: Record<number, number> = {};
  studentIds.forEach(id => {
    const a = attCounts[id];
    attPct[id] = a && a.total > 0 ? Math.round((a.present / a.total) * 100) : 0;
  });

  // 2. Cotidiano
  const { data: cwScores } = await supabase
    .from("daily_work_scores")
    .select("student_id, score, total_points")
    .in("student_id", studentIds)
    .eq("period", periodToLoad);

  const cotPct: Record<number, number> = {};
  studentIds.forEach(id => { cotPct[id] = 0; });
  (cwScores || []).forEach(d => {
    if (d.total_points && d.total_points > 0) {
      cotPct[d.student_id] = Math.round((d.score / d.total_points) * 100);
    }
  });

  // 3. Notas
  const { data: gradesData } = await supabase
    .from("grades")
    .select("student_id, projects, test1, test2")
    .in("student_id", studentIds)
    .eq("period", periodToLoad);

  const gradesMap: Record<number, { projects: number; test: number }> = {};
  studentIds.forEach(id => { gradesMap[id] = { projects: 0, test: 0 }; });
  (gradesData || []).forEach(row => {
    const sid = row.student_id;
    const projectsScore = row.projects != null ? Math.round(row.projects) : 0;
    let testScore = 0;
    if (row.test1 != null && row.test2 != null) {
      testScore = Math.round((row.test1 + row.test2) / 2);
    } else if (row.test1 != null) {
      testScore = Math.round(row.test1);
    } else if (row.test2 != null) {
      testScore = Math.round(row.test2);
    }
    gradesMap[sid] = { projects: projectsScore, test: testScore };
  });

  console.log("\n=== EXPORT DATA ===");
  students.forEach(s => {
    console.log({
      name: s.name,
      cedula: s.cedula,
      cotidiano_score_in_db: cwScores?.find(c => c.student_id === s.id)?.score,
      cotidiano_total_in_db: cwScores?.find(c => c.student_id === s.id)?.total_points,
      cotidiano_pct_exported: cotPct[s.id],
      tareas_pct_exported: gradesMap[s.id]?.projects,
      prueba_pct_exported: gradesMap[s.id]?.test,
      asistencia_pct_exported: attPct[s.id]
    });
  });
}

run();
