import { supabase } from "../../../supabaseClient";

export async function loadAttendanceByDate(groupId: number, date: string, period: string, ownerId: string) {
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id")
    .eq("group_id", groupId)
    .eq("owner_id", ownerId);

  if (studentsError) throw studentsError;

  const studentIds = (students ?? []).map((s: any) => s.id);

  if (studentIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("attendance_lessons")
    .select(`
      id,
      student_id,
      attendance_date,
      lesson_number,
      status,
      location,
      observation,
      period
    `)
    .eq("attendance_date", date)
    .eq("period", period)
    .eq("owner_id", ownerId)
    .in("student_id", studentIds)
    .order("lesson_number", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

export async function saveAttendanceLesson(params: {
  studentId: number;
  date: string;
  lessonNumber: number;
  status: string;
  location?: string | null;
  observation?: string | null;
  ownerId: string;
  period: string;
}) {
  if (!params.ownerId) {
    throw new Error("Prohibido persistir sin ownerId (Security Guard)");
  }
  const { error } = await supabase
    .from("attendance_lessons")
    .upsert(
      {
        student_id: params.studentId,
        attendance_date: params.date,
        lesson_number: params.lessonNumber,
        status: params.status,
        location: params.location ?? null,
        observation: params.observation ?? null,
        owner_id: params.ownerId || null,
        period: params.period,
      },
      {
        onConflict: "student_id,attendance_date,lesson_number",
      }
    );

  if (error) throw error;
}

export async function loadHistoricalAccumulatedRisk(groupId: number, currentSelectedDate: string, period: string, ownerId: string) {
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id")
    .eq("group_id", groupId)
    .eq("owner_id", ownerId);

  if (studentsError) throw studentsError;

  const studentIds = (students ?? []).map((s: any) => s.id);

  if (studentIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("attendance_lessons")
    .select("student_id, status")
    .eq("period", period)
    .eq("owner_id", ownerId)
    .in("student_id", studentIds)
    .neq("attendance_date", currentSelectedDate);

  if (error) throw error;

  const pointsPerStudent: Record<number, number> = {};
  studentIds.forEach((id: number) => { pointsPerStudent[id] = 0; });

  (data ?? []).forEach((record) => {
    if (record.status === "ausente") pointsPerStudent[record.student_id] += 1;
    else if (record.status === "tardía") pointsPerStudent[record.student_id] += 0.5;
  });

  return pointsPerStudent;
}

export async function loadAnnualAttendanceSummary(groupId: number, ownerId: string) {
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, name")
    .eq("group_id", groupId)
    .eq("owner_id", ownerId);

  if (studentsError) throw studentsError;

  const studentIds = (students ?? []).map((s: any) => s.id);
  if (studentIds.length === 0) return [];

  const { data, error } = await supabase
    .from("attendance_lessons")
    .select("student_id, status, period")
    .eq("owner_id", ownerId)
    .in("student_id", studentIds);

  if (error) throw error;

  const summary: Record<number, { 
    s1P: number, s1A: number, 
    s2P: number, s2A: number,
    totalP: number, totalA: number
  }> = {};

  studentIds.forEach((id: number) => {
    summary[id] = { s1P: 0, s1A: 0, s2P: 0, s2A: 0, totalP: 0, totalA: 0 };
  });

  (data ?? []).forEach((record) => {
    const sId = record.student_id;
    const isPresent = record.status === "presente" || record.status === "tardía";
    const isAbsent = record.status === "ausente";

    if (record.period === "semester1") {
      if (isPresent) summary[sId].s1P++;
      if (isAbsent) summary[sId].s1A++;
    } else if (record.period === "semester2") {
      if (isPresent) summary[sId].s2P++;
      if (isAbsent) summary[sId].s2A++;
    }

    if (isPresent) summary[sId].totalP++;
    if (isAbsent) summary[sId].totalA++;
  });

  return students.map((s: any) => ({
    id: s.id,
    name: s.name,
    ...summary[s.id]
  }));
}