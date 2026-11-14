import { supabase } from "./supabase";

export type ClassRow = { id: string; name: string; section: string; class_teacher_id?: string | null };
export type Session = { id: string; name: string; starts_on: string; ends_on: string; is_current: boolean };
export type TestKind = "daily" | "weekly" | "monthly";

export const className = (c?: { name: string; section: string } | null) => (c ? `${c.name}${c.section ? `-${c.section}` : ""}` : "");

export function sortClasses<T extends { name: string; section: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || a.section.localeCompare(b.section));
}

export async function loadClasses(): Promise<ClassRow[]> {
  const { data } = await supabase.from("classes").select("id, name, section, class_teacher_id");
  return sortClasses((data ?? []) as ClassRow[]);
}

export async function currentSession(): Promise<Session | null> {
  const { data } = await supabase.from("academic_years").select("id, name, starts_on, ends_on, is_current").eq("is_current", true).maybeSingle();
  return (data as Session | null) ?? null;
}

// Daily tests count least, monthly tests most.
export const KIND_WEIGHT: Record<TestKind, number> = { daily: 1, weekly: 2, monthly: 3 };
export const KIND_LABEL: Record<TestKind, string> = { daily: "Daily tests", weekly: "Weekly tests", monthly: "Monthly tests" };

export type TestRow = { id: string; subject_id: string; kind: TestKind; total_marks: number; title: string; held_on: string };
export type ResultRow = { test_id: string; student_id: string; marks: number };

// Weighted percentage: each test's percentage counts by its kind's weight.
export function weightedPercent(items: { marks: number; total: number; kind: TestKind }[]): number | null {
  let sum = 0;
  let weight = 0;
  for (const i of items) {
    if (!(i.total > 0)) continue;
    const w = KIND_WEIGHT[i.kind];
    sum += (Number(i.marks) / Number(i.total)) * 100 * w;
    weight += w;
  }
  return weight ? sum / weight : null;
}

export const pct = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${Math.round(n)}%`);

export function toneFor(p: number | null | undefined): string {
  if (p === null || p === undefined) return "text-sub";
  if (p >= 70) return "text-ok";
  if (p >= 50) return "text-warn";
  return "text-bad";
}

// 03001234567 -> 923001234567 for WhatsApp links
export const waNumber = (phone: string) => "92" + phone.replace(/\D/g, "").replace(/^0/, "");
