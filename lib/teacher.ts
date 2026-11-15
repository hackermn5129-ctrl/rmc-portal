import { supabase } from "./supabase";
import { sortClasses, type ClassRow } from "./school";

export type Shift = "morning" | "evening" | "night";
export const SHIFTS: { value: Shift; label: string; urdu: string }[] = [
  { value: "morning", label: "Morning class", urdu: "صبح" },
  { value: "evening", label: "Evening class", urdu: "شام" },
  { value: "night", label: "Night shift", urdu: "رات" },
];

export type AttendanceStatus = "present" | "late" | "absent" | "leave";
export const STATUSES: { value: AttendanceStatus; label: string; short: string; on: string }[] = [
  { value: "present", label: "Present", short: "P", on: "bg-ok text-white border-ok" },
  { value: "late", label: "Late", short: "L", on: "bg-warn text-white border-warn" },
  { value: "absent", label: "Absent", short: "A", on: "bg-bad text-white border-bad" },
  { value: "leave", label: "Leave", short: "Lv", on: "bg-navy text-white border-navy" },
];

export type MyClass = ClassRow & { isClassTeacher: boolean };

// Classes this teacher teaches, plus the one they are class teacher of.
export async function loadMyClasses(teacherId: string): Promise<MyClass[]> {
  const [tc, cls] = await Promise.all([
    supabase.from("teacher_classes").select("class_id").eq("teacher_id", teacherId),
    supabase.from("classes").select("id, name, section, class_teacher_id"),
  ]);
  const mine = new Set((tc.data ?? []).map((r) => r.class_id));
  const rows = ((cls.data ?? []) as ClassRow[])
    .filter((c) => mine.has(c.id) || c.class_teacher_id === teacherId)
    .map((c) => ({ ...c, isClassTeacher: c.class_teacher_id === teacherId }));
  return sortClasses(rows);
}

export async function loadSubjects() {
  const { data } = await supabase.from("subjects").select("id, name").order("name");
  return (data ?? []) as { id: string; name: string }[];
}

export async function loadClassStudents(classId: string) {
  const { data } = await supabase.from("students").select("id, full_name, roll_no").eq("class_id", classId).eq("status", "active").order("full_name");
  return (data ?? []) as { id: string; full_name: string; roll_no: string | null }[];
}

export const todayIso = () => new Date().toLocaleDateString("en-CA");

export function defaultShift(): Shift {
  const h = new Date().getHours();
  return h < 13 ? "morning" : h < 19 ? "evening" : "night";
}

