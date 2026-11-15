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

export type MyClass = ClassRow & {
  isClassIncharge: boolean; // marks attendance
  isFeeIncharge: boolean; // sees who has not paid
  subjects: { id: string; name: string }[]; // enters test marks for these
};

// Every class this teacher has a job in, with what that job is.
export async function loadMyClasses(teacherId: string): Promise<MyClass[]> {
  const [ts, cls] = await Promise.all([
    supabase.from("teacher_subjects").select("class_id, subjects(id, name)").eq("teacher_id", teacherId),
    supabase.from("classes").select("id, name, section, class_teacher_id, fee_incharge_id"),
  ]);
  const subs = new Map<string, { id: string; name: string }[]>();
  for (const r of (ts.data ?? []) as unknown as { class_id: string; subjects: { id: string; name: string } | null }[]) {
    if (!r.subjects) continue;
    subs.set(r.class_id, [...(subs.get(r.class_id) ?? []), r.subjects].sort((a, b) => a.name.localeCompare(b.name)));
  }
  const rows = ((cls.data ?? []) as (ClassRow & { fee_incharge_id: string | null })[])
    .map((c) => ({
      ...c,
      isClassIncharge: c.class_teacher_id === teacherId,
      isFeeIncharge: c.fee_incharge_id === teacherId,
      subjects: subs.get(c.id) ?? [],
    }))
    .filter((c) => c.isClassIncharge || c.isFeeIncharge || c.subjects.length > 0);
  return sortClasses(rows);
}

export function jobsLabel(c: MyClass): string {
  return [c.isClassIncharge && "class incharge", c.isFeeIncharge && "fee incharge"].filter(Boolean).join(", ");
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

