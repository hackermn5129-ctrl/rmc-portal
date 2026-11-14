import { supabase } from "./supabase";
import { currentSession, weightedPercent, type ResultRow, type TestKind, type TestRow } from "./school";

export type Subject = { id: string; name: string };
export type ResultsData = { subjects: Subject[]; tests: TestRow[]; results: ResultRow[] };

// Tests and marks of the current session for one class or one student.
export async function loadResults(opts: { classId?: string; studentId?: string }): Promise<ResultsData> {
  const session = await currentSession();
  let tq = supabase.from("tests").select("id, subject_id, kind, total_marks, title, held_on").order("held_on", { ascending: false });
  if (session) tq = tq.eq("academic_year_id", session.id);
  if (opts.classId) tq = tq.eq("class_id", opts.classId);
  let rq = supabase.from("results").select("test_id, student_id, marks");
  if (opts.studentId) rq = rq.eq("student_id", opts.studentId);
  const [subjects, tests, results] = await Promise.all([supabase.from("subjects").select("id, name").order("name"), tq, rq]);
  const testRows = (tests.data ?? []) as TestRow[];
  const ids = new Set(testRows.map((t) => t.id));
  return {
    subjects: (subjects.data ?? []) as Subject[],
    tests: testRows,
    results: ((results.data ?? []) as ResultRow[]).filter((r) => ids.has(r.test_id)),
  };
}

function items(data: ResultsData, filter: (r: ResultRow, t: TestRow) => boolean) {
  const byId = new Map(data.tests.map((t) => [t.id, t]));
  const out: { marks: number; total: number; kind: TestKind }[] = [];
  for (const r of data.results) {
    const t = byId.get(r.test_id);
    if (t && filter(r, t)) out.push({ marks: Number(r.marks), total: Number(t.total_marks), kind: t.kind });
  }
  return out;
}

export const subjectPercent = (data: ResultsData, subjectId: string, studentId?: string) =>
  weightedPercent(items(data, (r, t) => t.subject_id === subjectId && (!studentId || r.student_id === studentId)));

export const studentPercent = (data: ResultsData, studentId: string) => weightedPercent(items(data, (r) => r.student_id === studentId));

export const subjectsWithTests = (data: ResultsData) => data.subjects.filter((s) => data.tests.some((t) => t.subject_id === s.id));
