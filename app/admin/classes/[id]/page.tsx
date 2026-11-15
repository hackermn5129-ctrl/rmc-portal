"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { WithId } from "@/components/route";
import { LinkButton } from "@/components/ui";
import { residenceLabel, type Residence } from "@/lib/fees";
import { className, pct, toneFor } from "@/lib/school";
import { loadResults, studentPercent, subjectPercent, subjectsWithTests, type ResultsData } from "@/lib/results";

type Row = { id: string; full_name: string; roll_no: string | null; reg_no: string | null; residence?: Residence };

function ClassStudents({ classId }: { classId: string }) {
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [cls, st, res] = await Promise.all([
        supabase.from("classes").select("name, section").eq("id", classId).maybeSingle(),
        supabase.from("students").select("id, full_name, roll_no, reg_no").eq("class_id", classId).eq("status", "active").order("full_name"),
        loadResults({ classId }),
      ]);
      const students = (st.data ?? []) as Row[];
      if (students.length) {
        const { data: fees } = await supabase
          .from("student_current_fee")
          .select("student_id, residence")
          .in(
            "student_id",
            students.map((s) => s.id),
          );
        for (const f of fees ?? []) {
          const s = students.find((x) => x.id === f.student_id);
          if (s) s.residence = f.residence;
        }
      }
      if (!active) return;
      setTitle(className(cls.data));
      setRows(students);
      setResults(res);
    })();
    return () => {
      active = false;
    };
  }, [classId]);

  const subjects = results ? subjectsWithTests(results) : [];

  return (
    <>
      <h2 className="mt-5 text-xl font-medium tracking-tight">{title || "Class"}</h2>

      <section className="mt-4 rounded-[28px] border border-line bg-white p-5">
        <h3 className="text-base font-medium">Class result</h3>
        {subjects.length === 0 ? (
          <p className="mt-2 text-sm text-sub">No tests yet this session. Averages appear once teachers enter marks.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {subjects.map((s) => {
              const p = subjectPercent(results!, s.id);
              return (
                <li key={s.id} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{s.name}</span>
                    <span className={`font-medium tabular-nums ${toneFor(p)}`}>{pct(p)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-bg">
                    <div className="h-full rounded-full bg-navy" style={{ width: `${Math.round(p ?? 0)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-4">
        <LinkButton href={`/admin/students/new?class=${classId}`} icon="plus">
          Add student
        </LinkButton>
      </div>

      <div className="mt-4 rounded-3xl border border-line bg-white px-4 py-1">
        {!rows ? (
          <p className="py-4 text-sm text-sub">Loading students</p>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-sub">No students in this class yet.</p>
        ) : (
          <ul>
            {rows.map((s) => {
              const p = results ? studentPercent(results, s.id) : null;
              return (
                <li key={s.id} className="border-b border-line last:border-b-0">
                  <Link href={`/admin/students/${s.id}`} className="flex items-center justify-between gap-3 py-3">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[15px]">{s.full_name}</span>
                      <span className="truncate text-sm text-sub">
                        {s.reg_no ? `${s.reg_no} · ` : ""}
                        {s.residence ? residenceLabel(s.residence) : "No fee set"}
                        {s.roll_no ? ` · Roll ${s.roll_no}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={`text-[15px] font-medium tabular-nums ${toneFor(p)}`}>{pct(p)}</span>
                      <ChevronRight aria-hidden className="size-[18px] text-sub" strokeWidth={1.75} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

export default function ClassPage() {
  return (
    <Portal role="admin" title="Students" back="/admin/students">
      {() => <WithId render={(id) => <ClassStudents classId={id} />} />}
    </Portal>
  );
}
