"use client";
import { useEffect, useState } from "react";
import { supabase, type Profile } from "./supabase";
import { currentSession, weightedPercent, type Session, type TestKind } from "./school";
import { monthStart } from "./fees";

// Everything the student and parent portals show is about one child.
export type Child = { id: string; full_name: string; father_name: string | null; reg_no: string | null; roll_no: string | null; class_id: string | null; classes: { name: string; section: string } | null };

const CHILD_KEY = "rmc-child";

export async function loadChildren(profile: Profile): Promise<Child[]> {
  const cols = "id, full_name, father_name, reg_no, roll_no, class_id, classes(name, section)";
  if (profile.role === "student") {
    const { data } = await supabase.from("students").select(cols).eq("profile_id", profile.id);
    return (data ?? []) as unknown as Child[];
  }
  const { data: links } = await supabase.from("parent_students").select("student_id").eq("parent_id", profile.id);
  const ids = (links ?? []).map((l) => l.student_id);
  if (!ids.length) return [];
  const { data } = await supabase.from("students").select(cols).in("id", ids).eq("status", "active").order("full_name");
  return (data ?? []) as unknown as Child[];
}

const cache = new Map<string, Promise<Child[]>>();
const getChildren = (profile: Profile) => {
  if (!cache.has(profile.id)) cache.set(profile.id, loadChildren(profile));
  return cache.get(profile.id)!;
};

// The child picked on this phone (parents with more than one child). Every part of the page shares it.
export function useChild(profile: Profile) {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [childId, setChildId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const pick = (list: Child[]) => {
      if (!active) return;
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(CHILD_KEY);
      } catch {}
      setChildren(list);
      setChildId(list.find((c) => c.id === saved)?.id ?? list[0]?.id ?? null);
    };
    getChildren(profile).then(pick);
    const onChange = () => getChildren(profile).then(pick);
    window.addEventListener(CHILD_KEY, onChange);
    return () => {
      active = false;
      window.removeEventListener(CHILD_KEY, onChange);
    };
  }, [profile]);

  function choose(id: string) {
    try {
      localStorage.setItem(CHILD_KEY, id);
    } catch {}
    setChildId(id);
    window.dispatchEvent(new Event(CHILD_KEY));
  }

  return { children, child: children?.find((c) => c.id === childId) ?? null, choose };
}

export const firstName = (name: string) => name.split(/\s+/).find((w) => !/^(muhammad|m\.|syed|hafiz)$/i.test(w)) ?? name.split(/\s+/)[0];

// ---------- Attendance ----------

export type DayStatus = "present" | "partial" | "absent" | "leave";
export type Day = { held_on: string; day_status: DayStatus; lectures_counted: number; lectures_attended: number };

export async function loadDays(studentId: string, sessionId?: string): Promise<Day[]> {
  let q = supabase.from("daily_attendance").select("held_on, day_status, lectures_counted, lectures_attended").eq("student_id", studentId).order("held_on");
  if (sessionId) q = q.eq("academic_year_id", sessionId);
  const { data } = await q;
  return (data ?? []) as Day[];
}

export function dayPercent(days: Day[]): number | null {
  const counted = days.filter((d) => d.day_status !== "leave");
  if (!counted.length) return null;
  const score = counted.reduce((a, d) => a + (d.day_status === "present" ? 1 : d.day_status === "partial" ? 0.5 : 0), 0);
  return (score / counted.length) * 100;
}

export const countDays = (days: Day[], s: DayStatus) => days.filter((d) => d.day_status === s).length;

export const iso = (d: Date) => d.toLocaleDateString("en-CA");

// Monday to Saturday of this week.
export function thisWeek(today = new Date()): Date[] {
  const d = new Date(today);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  return Array.from({ length: 6 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return x;
  });
}

export type LectureMark = { status: "present" | "late" | "absent" | "leave"; lectures: { held_on: string; shift: "morning" | "evening" | "night"; subjects: { name: string } | null } | null };

export async function loadLectures(studentId: string, date: string): Promise<LectureMark[]> {
  const { data } = await supabase
    .from("lecture_attendance")
    .select("status, lectures!inner(held_on, shift, subjects(name))")
    .eq("student_id", studentId)
    .eq("lectures.held_on", date);
  return (data ?? []) as unknown as LectureMark[];
}

// ---------- Results ----------

export type TestResult = { id: string; title: string; kind: TestKind; held_on: string; total_marks: number; subject_id: string; subject: string; marks: number | null; percent: number | null };

export async function loadTestResults(child: Child, sessionId?: string): Promise<TestResult[]> {
  if (!child.class_id) return [];
  let q = supabase.from("tests").select("id, title, kind, held_on, total_marks, subject_id, subjects(name)").eq("class_id", child.class_id).order("held_on");
  if (sessionId) q = q.eq("academic_year_id", sessionId);
  const [{ data: tests }, { data: res }] = await Promise.all([q, supabase.from("results").select("test_id, marks").eq("student_id", child.id)]);
  const marks = new Map((res ?? []).map((r) => [r.test_id, Number(r.marks)]));
  return ((tests ?? []) as unknown as (Omit<TestResult, "subject" | "marks" | "percent"> & { subjects: { name: string } | null })[]).map((t) => {
    const m = marks.has(t.id) ? marks.get(t.id)! : null;
    return { ...t, total_marks: Number(t.total_marks), subject: t.subjects?.name ?? "", marks: m, percent: m === null ? null : (m / Number(t.total_marks)) * 100 };
  });
}

// Only tests the child sat count towards the average.
export const scoreOf = (tests: TestResult[]) => weightedPercent(tests.filter((t) => t.marks !== null).map((t) => ({ marks: t.marks!, total: t.total_marks, kind: t.kind })));

export const inMonth = (tests: TestResult[], month: string) => tests.filter((t) => t.held_on.slice(0, 7) === month.slice(0, 7));

export function monthsOf(session: Session | null): string[] {
  const start = session ? session.starts_on.slice(0, 7) + "-01" : monthStart(-6);
  const end = monthStart();
  const out: string[] = [];
  for (let m = start; m <= end && out.length < 13; ) {
    out.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = `${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, "0")}-01`;
  }
  return out;
}

export const shortMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-GB", { month: "short" });
};

// ---------- Fees ----------

export type FeeMonth = { fee_record_id: string; month: string; amount_due: number; amount_paid: number; status: "paid" | "part_paid" | "pending" };
export type Payment = { receipt_no: number; paid_on: string; amount: number; voucher_no: string | null };

export async function loadFees(studentId: string) {
  const [{ data: months }, { data: pays }] = await Promise.all([
    supabase.from("fee_status").select("fee_record_id, month, amount_due, amount_paid, status").eq("student_id", studentId).order("month", { ascending: false }),
    supabase.from("fee_payments").select("receipt_no, paid_on, amount, voucher_no, fee_records!inner(student_id)").eq("fee_records.student_id", studentId).order("paid_on", { ascending: false }),
  ]);
  const list = ((months ?? []) as FeeMonth[]).map((m) => ({ ...m, amount_due: Number(m.amount_due), amount_paid: Number(m.amount_paid) }));
  const due = list.filter((m) => m.month <= monthStart());
  const owed = due.reduce((a, m) => a + Math.max(0, m.amount_due - m.amount_paid), 0);
  const unpaidMonths = due.filter((m) => m.amount_paid < m.amount_due).length;
  const byReceipt = new Map<number, Payment>();
  for (const p of (pays ?? []) as unknown as Payment[]) {
    const e = byReceipt.get(p.receipt_no) ?? { receipt_no: p.receipt_no, paid_on: p.paid_on, amount: 0, voucher_no: p.voucher_no };
    e.amount += Number(p.amount);
    byReceipt.set(p.receipt_no, e);
  }
  return { months: list, owed, unpaidMonths, payments: [...byReceipt.values()], billed: list.length > 0 };
}

// ---------- Notices ----------

export type Notice = { id: string; title: string; body: string; created_at: string };

export async function loadNotices(limit = 20): Promise<Notice[]> {
  const { data } = await supabase.from("notices").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as Notice[];
}

export { currentSession };
