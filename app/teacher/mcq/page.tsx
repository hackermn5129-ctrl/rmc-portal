"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { LinkButton } from "@/components/ui";
import { useTeaching } from "@/components/class-subject";
import { chapterLabel, loadChaptersByIds, type Chapter } from "@/lib/chapters";
import { className } from "@/lib/school";

type Row = {
  id: string;
  class_id: string;
  chapter_id: string | null;
  title: string;
  minutes: number;
  published: boolean;
  subjects: { name: string } | null;
  mcq_questions: { count: number }[];
  mcq_attempts: { count: number }[];
};

function List({ teacherId }: { teacherId: string }) {
  const { classes } = useTeaching(teacherId);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [chapters, setChapters] = useState<Map<string, Chapter>>(new Map());

  useEffect(() => {
    let active = true;
    if (!classes) return;
    (async () => {
      const ids = classes.map((c) => c.id);
      if (!ids.length) {
        if (active) setRows([]);
        return;
      }
      const { data } = await supabase
        .from("mcq_tests")
        .select("id, class_id, subject_id, chapter_id, title, minutes, published, subjects(name), mcq_questions(count), mcq_attempts(count)")
        .in("class_id", ids)
        .order("created_at", { ascending: false });
      const mine = ((data ?? []) as unknown as (Row & { subject_id: string })[]).filter((t) => classes.find((c) => c.id === t.class_id)?.subjects.some((s) => s.id === t.subject_id));
      const ch = await loadChaptersByIds(mine.map((r) => r.chapter_id ?? ""));
      if (!active) return;
      setRows(mine);
      setChapters(ch);
    })();
    return () => {
      active = false;
    };
  }, [classes]);

  if (!rows || !classes) return <p className="mt-6 text-sm text-sub">Loading</p>;

  return (
    <>
      <div className="mt-5">
        <LinkButton href="/teacher/mcq/new" icon="plus">
          Make an MCQ test
        </LinkButton>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-sub">Students take these on their phone. The website checks the answers and shows the score at once.</p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-sub">No MCQ tests yet.</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {rows.map((t) => {
            const cls = classes.find((c) => c.id === t.class_id);
            const q = t.mcq_questions[0]?.count ?? 0;
            const a = t.mcq_attempts[0]?.count ?? 0;
            return (
              <li key={t.id}>
                <Link href={`/teacher/mcq/${t.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 hover:bg-bg">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{t.title}</p>
                    <p className="truncate text-sm text-sub">
                      {cls ? className(cls) : ""} · {t.subjects?.name} · {chapterLabel(t.chapter_id ? chapters.get(t.chapter_id) : null)}
                    </p>
                    <p className="mt-1 text-xs text-sub">
                      {q} questions · {t.minutes} min · {a} {a === 1 ? "student" : "students"} took it
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${t.published ? "bg-ok text-white" : "bg-bg text-sub"}`}>{t.published ? "Open" : "Draft"}</span>
                  <ChevronRight aria-hidden className="size-[18px] shrink-0 text-sub" strokeWidth={1.75} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function McqListPage() {
  return (
    <Portal role={["teacher", "admin"]} title="MCQ tests" back={(p) => (p.role === "admin" ? "/admin/settings" : "/teacher")}>
      {(p) => <List teacherId={p.id} />}
    </Portal>
  );
}
