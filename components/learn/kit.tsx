"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Atom, BookA, BookOpen, Calculator, ChevronRight, Dna, FlaskConical, Landmark, Microscope, Monitor, MoonStar, Square, SquareCheck, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { chapterLabel, isUrdu, loadChapters, type Chapter } from "@/lib/chapters";

// Flat colour boxes, one look per subject.
type Look = { Icon: LucideIcon | null; letter?: string; bg: string; fg: string; urdu: string };
const LOOKS: Record<string, Look> = {
  Biology: { Icon: Dna, bg: "#E3F2EA", fg: "#1F7A4D", urdu: "حیاتیات" },
  Physics: { Icon: Atom, bg: "#E4ECFA", fg: "#2856A8", urdu: "طبیعیات" },
  Chemistry: { Icon: FlaskConical, bg: "#F3E6F7", fg: "#7B3A96", urdu: "کیمیا" },
  Maths: { Icon: Calculator, bg: "#FCEBDD", fg: "#B4561A", urdu: "ریاضی" },
  Computers: { Icon: Monitor, bg: "#E0F2F4", fg: "#147582", urdu: "کمپیوٹر" },
  English: { Icon: BookA, bg: "#FBE7E9", fg: "#B3364A", urdu: "انگریزی" },
  Urdu: { Icon: null, letter: "ا", bg: "#FDF3D8", fg: "#8A6410", urdu: "اردو" },
  "Islamic studies": { Icon: MoonStar, bg: "#E2F1E4", fg: "#2D6B36", urdu: "اسلامیات" },
  "Pak studies": { Icon: Landmark, bg: "#E6EEE6", fg: "#33613A", urdu: "مطالعہ پاکستان" },
  Quran: { Icon: BookOpen, bg: "#E5EFEA", fg: "#245C45", urdu: "قرآن" },
  "Tarjma tul Quran": { Icon: BookOpen, bg: "#E5EFEA", fg: "#245C45", urdu: "ترجمۃ القرآن" },
  Science: { Icon: Microscope, bg: "#E4F0F9", fg: "#1D6694", urdu: "سائنس" },
};
const lookOf = (name: string): Look => LOOKS[name] ?? { Icon: BookOpen, bg: "#EEF1F4", fg: "#13233A", urdu: "" };

export function SubjectIcon({ name, size = 52 }: { name: string; size?: number }) {
  const l = lookOf(name);
  return (
    <span className="flex shrink-0 items-center justify-center rounded-2xl" style={{ background: l.bg, color: l.fg, width: size, height: size }}>
      {l.Icon ? <l.Icon aria-hidden strokeWidth={1.75} style={{ width: size * 0.48, height: size * 0.48 }} /> : <span className="font-urdu font-bold leading-none" style={{ fontSize: size * 0.5 }}>{l.letter}</span>}
    </span>
  );
}

export type Subject = { id: string; name: string };

const subjCache = new Map<string, Promise<Subject[]>>();
export function useClassSubjects(classId: string | null) {
  const [list, setList] = useState<Subject[] | null>(null);
  useEffect(() => {
    let active = true;
    if (!classId) return;
    if (!subjCache.has(classId))
      subjCache.set(
        classId,
        Promise.resolve(supabase.rpc("class_subjects", { p_class: classId })).then((r) => (r.data ?? []) as Subject[]),
      );
    subjCache.get(classId)!.then((s) => active && setList(s));
    return () => {
      active = false;
    };
  }, [classId]);
  return classId ? list : [];
}

// Subject boxes. `note` is a small line under the name (e.g. "4 videos").
export function SubjectGrid({ subjects, hrefFor, noteFor }: { subjects: Subject[]; hrefFor: (s: Subject) => string; noteFor?: (s: Subject) => string | null }) {
  if (!subjects.length) return <p className="mt-6 text-sm text-sub">No subjects are set for this class yet.</p>;
  return (
    <ul className="mt-5 grid grid-cols-2 gap-3">
      {subjects.map((s) => {
        const l = lookOf(s.name);
        const note = noteFor?.(s);
        return (
          <li key={s.id}>
            <Link href={hrefFor(s)} className="flex h-full flex-col gap-3 rounded-[24px] border border-line bg-white p-4 transition-transform active:scale-[0.98] hover:border-line-strong">
              <SubjectIcon name={s.name} />
              <span className="flex flex-col">
                <span className="text-[16px] font-medium leading-tight">{s.name}</span>
                {l.urdu && (
                  <span lang="ur" dir="rtl" className="font-urdu text-[13px] leading-[2] text-sub">
                    {l.urdu}
                  </span>
                )}
                {note && <span className="text-[13px] text-sub">{note}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// A row of big option boxes (for Short / Long / MCQs / E-books).
export function OptionGrid({ items }: { items: { href: string; label: string; urdu: string; note?: string; Icon: LucideIcon; bg: string; fg: string }[] }) {
  return (
    <ul className="mt-5 grid grid-cols-2 gap-3">
      {items.map(({ href, label, urdu, note, Icon, bg, fg }) => (
        <li key={href}>
          <Link href={href} className="flex h-full flex-col gap-3 rounded-[24px] border border-line bg-white p-4 transition-transform active:scale-[0.98] hover:border-line-strong">
            <span className="flex size-[52px] items-center justify-center rounded-2xl" style={{ background: bg, color: fg }}>
              <Icon aria-hidden className="size-6" strokeWidth={1.75} />
            </span>
            <span className="flex flex-col">
              <span className="text-[16px] font-medium leading-tight">{label}</span>
              <span lang="ur" dir="rtl" className="font-urdu text-[13px] leading-[2] text-sub">
                {urdu}
              </span>
              {note && <span className="text-[13px] text-sub">{note}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// The header strip for a chosen subject.
export function SubjectHeader({ name, line }: { name: string; line?: ReactNode }) {
  const l = lookOf(name);
  return (
    <section className="mt-5 flex items-center gap-4 rounded-[28px] p-4" style={{ background: l.bg }}>
      <SubjectIcon name={name} size={56} />
      <div className="min-w-0">
        <h2 className="text-xl font-medium leading-tight" style={{ color: l.fg }}>
          {name}
        </h2>
        {line && <p className="text-sm text-sub">{line}</p>}
      </div>
    </section>
  );
}

export function useChapters(classId: string | null, subjectId: string | null) {
  const [list, setList] = useState<Chapter[] | null>(null);
  useEffect(() => {
    let active = true;
    if (!classId || !subjectId) return;
    loadChapters(classId, subjectId).then((c) => active && setList(c));
    return () => {
      active = false;
    };
  }, [classId, subjectId]);
  return list;
}

export const Ur = ({ text, className = "" }: { text: string; className?: string }) => (
  <span lang={isUrdu(text) ? "ur" : undefined} dir={isUrdu(text) ? "rtl" : undefined} className={`${isUrdu(text) ? "font-urdu leading-[2]" : ""} ${className}`}>
    {text}
  </span>
);

// Every book chapter, in book order. Tap one, or tick several when `picked` is given.
export function ChapterList({
  chapters,
  countFor,
  unit = "",
  hrefFor,
  picked,
  onToggle,
}: {
  chapters: Chapter[];
  countFor?: (c: Chapter) => number;
  unit?: string;
  hrefFor?: (c: Chapter) => string;
  picked?: Set<string>;
  onToggle?: (c: Chapter) => void;
}) {
  if (!chapters.length) return <p className="mt-4 text-sm text-sub">The chapters of this book are not listed yet. A teacher can add them.</p>;
  const grades = [...new Set(chapters.map((c) => c.grade))];
  return (
    <>
      {grades.map((g) => (
        <div key={g} className="mt-4">
          {grades.length > 1 && <h3 className="mb-2 text-sm font-medium text-sub">Class {g} book</h3>}
          <ul className="flex flex-col rounded-3xl border border-line bg-white px-2 py-1">
            {chapters
              .filter((c) => c.grade === g)
              .map((c) => {
                const n = countFor?.(c) ?? 0;
                const on = picked?.has(c.id) ?? false;
                const inner = (
                  <>
                    {picked ? (
                      on ? <SquareCheck aria-hidden className="size-6 shrink-0 text-navy" strokeWidth={1.75} /> : <Square aria-hidden className="size-6 shrink-0 text-sub" strokeWidth={1.5} />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bg text-sm font-medium tabular-nums text-navy">{c.number || "•"}</span>
                    )}
                    <span className="min-w-0 flex-1 text-[15px]">
                      {picked && c.number ? <span className="text-sub">{c.number}. </span> : null}
                      <Ur text={c.title} />
                    </span>
                    {countFor && <span className={`shrink-0 text-[13px] tabular-nums ${n ? "text-navy" : "text-sub/60"}`}>{n ? `${n}${unit ? ` ${unit}` : ""}` : "–"}</span>}
                    {hrefFor && <ChevronRight aria-hidden className="size-4 shrink-0 text-sub" strokeWidth={1.75} />}
                  </>
                );
                return (
                  <li key={c.id} className="border-b border-line last:border-b-0">
                    {hrefFor ? (
                      <Link href={hrefFor(c)} className="flex min-h-14 items-center gap-3 px-2 py-2">
                        {inner}
                      </Link>
                    ) : (
                      <button type="button" aria-pressed={on} onClick={() => onToggle?.(c)} className="flex min-h-14 w-full items-center gap-3 px-2 py-2 text-left">
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </>
  );
}

export function ChapterHeader({ chapter, showGrade }: { chapter: Chapter | undefined; showGrade?: boolean }) {
  if (!chapter) return null;
  return (
    <p className="mt-4 text-[15px] font-medium">
      <Ur text={chapterLabel(chapter, showGrade)} />
    </p>
  );
}

export function qs(params: Record<string, string | null | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}
