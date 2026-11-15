import { supabase } from "./supabase";

// Chapters of the Punjab textbooks (PCTB / PECTAA, session 2026-27).
// A class may study more than one book level: "Senior (7+8)" has the Class 7 and Class 8 books.
export type Chapter = { id: string; grade: number; subject_id: string; number: number; title: string; source: string };

const gradeCache = new Map<string, Promise<number[]>>();
export function classGrades(classId: string): Promise<number[]> {
  if (!gradeCache.has(classId))
    gradeCache.set(
      classId,
      Promise.resolve(supabase.from("classes").select("grades").eq("id", classId).maybeSingle()).then(({ data }) => ((data?.grades ?? []) as number[]).map(Number)),
    );
  return gradeCache.get(classId)!;
}

export async function loadChapters(classId: string, subjectId: string): Promise<Chapter[]> {
  const grades = await classGrades(classId);
  if (!grades.length) return [];
  const { data } = await supabase
    .from("chapters")
    .select("id, grade, subject_id, number, title, source")
    .eq("subject_id", subjectId)
    .in("grade", grades)
    .order("grade")
    .order("number");
  return (data ?? []) as Chapter[];
}

export async function loadChaptersByIds(ids: string[]): Promise<Map<string, Chapter>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map();
  const { data } = await supabase.from("chapters").select("id, grade, subject_id, number, title, source").in("id", uniq);
  return new Map(((data ?? []) as Chapter[]).map((c) => [c.id, c]));
}

// "Ch 3 · The Cell" — with the book level when a class has two books.
export function chapterLabel(c: Chapter | null | undefined, showGrade = false): string {
  if (!c) return "Other topic";
  const n = c.number === 0 ? "" : `Ch ${c.number} · `;
  return `${showGrade ? `Class ${c.grade} book · ` : ""}${n}${c.title}`;
}

// Is the text Urdu? (for right-to-left display)
export const isUrdu = (s: string) => /[؀-ۿ]/.test(s);

// Group items by chapter, in book order. Items without a chapter come last.
export function groupByChapter<T extends { chapter_id: string | null }>(items: T[], chapters: Map<string, Chapter>) {
  const groups = new Map<string, { chapter: Chapter | null; items: T[] }>();
  for (const it of items) {
    const key = it.chapter_id && chapters.has(it.chapter_id) ? it.chapter_id : "none";
    if (!groups.has(key)) groups.set(key, { chapter: key === "none" ? null : chapters.get(key)!, items: [] });
    groups.get(key)!.items.push(it);
  }
  return [...groups.values()].sort((a, b) => {
    if (!a.chapter) return 1;
    if (!b.chapter) return -1;
    return a.chapter.grade - b.chapter.grade || a.chapter.number - b.chapter.number;
  });
}
