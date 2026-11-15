"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { LinkButton } from "@/components/ui";
import { KIND_LABEL, className, currentSession, type TestKind } from "@/lib/school";
import { loadMyClasses, type MyClass } from "@/lib/teacher";

type Row = { id: string; title: string; kind: TestKind; held_on: string; total_marks: number; class_id: string; subjects: { name: string } | null; results: { count: number }[] };

const KIND_TONE: Record<TestKind, string> = { daily: "bg-bg text-sub", weekly: "bg-gold/40 text-ink", monthly: "bg-navy text-white" };

function Tests({ teacherId }: { teacherId: string }) {
  const [classes, setClasses] = useState<MyClass[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sizes, setSizes] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let active = true;
    (async () => {
      const [all, session] = await Promise.all([loadMyClasses(teacherId), currentSession()]);
      const mine = all.filter((c) => c.subjects.length > 0);
      const ids = mine.map((c) => c.id);
      if (!ids.length) {
        if (active) setRows([]);
        return;
      }
      let q = supabase
        .from("tests")
        .select("id, title, kind, held_on, total_marks, class_id, subject_id, subjects(name), results(count)")
        .in("class_id", ids)
        .order("held_on", { ascending: false })
        .limit(60);
      if (session) q = q.eq("academic_year_id", session.id);
      const [t, st] = await Promise.all([q, supabase.from("students").select("class_id").in("class_id", ids).eq("status", "active")]);
      const count = new Map<string, number>();
      for (const s of st.data ?? []) count.set(s.class_id, (count.get(s.class_id) ?? 0) + 1);
      if (!active) return;
      setClasses(mine);
      const own = new Set(mine.flatMap((c) => c.subjects.map((sub) => `${c.id}|${sub.id}`)));
      setRows(((t.data ?? []) as unknown as (Row & { subject_id: string })[]).filter((r) => own.has(`${r.class_id}|${r.subject_id}`)));
      setSizes(count);
    })();
    return () => {
      active = false;
    };
  }, [teacherId]);

  const cls = new Map(classes.map((c) => [c.id, c]));

  return (
    <>
      <div className="mt-5">
        <LinkButton href="/teacher/tests/new" icon="plus">
          Test taken
        </LinkButton>
      </div>
      <h2 className="mt-6 text-base font-medium">Recent tests</h2>
      <ul className="mt-3 rounded-3xl border border-line bg-white px-4 py-1">
        {!rows && <li className="py-4 text-sm text-sub">Loading tests</li>}
        {rows?.length === 0 && <li className="py-4 text-sm text-sub">No tests yet. Tap &quot;Test taken&quot; after a test.</li>}
        {rows?.map((t) => {
          const entered = t.results?.[0]?.count ?? 0;
          const size = sizes.get(t.class_id) ?? 0;
          return (
            <li key={t.id} className="border-b border-line last:border-b-0">
              <Link href={`/teacher/tests/${t.id}`} className="flex items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-[15px]">
                    {t.subjects?.name}
                    {t.title ? ` · ${t.title}` : ""}
                  </span>
                  <span className="flex items-center gap-2 text-sm text-sub">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${KIND_TONE[t.kind]}`}>{KIND_LABEL[t.kind].replace(" tests", "")}</span>
                    {className(cls.get(t.class_id))} · {new Date(t.held_on).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
                  <span className={entered < size ? "text-warn" : "text-ok"}>
                    {entered}/{size}
                  </span>
                  <ChevronRight aria-hidden className="size-[18px] text-sub" strokeWidth={1.75} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function TestsPage() {
  return (
    <Portal role={["teacher", "admin"]} title="Tests and results" back={(p) => (p.role === "admin" ? "/admin/settings" : "/teacher")}>
      {(p) => <Tests teacherId={p.id} />}
    </Portal>
  );
}
