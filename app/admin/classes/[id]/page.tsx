"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { residenceLabel, rs, type Residence } from "@/lib/fees";

type Row = { id: string; full_name: string; father_name: string | null; roll_no: string | null; residence?: Residence; total?: number };

function ClassStudents({ classId }: { classId: string }) {
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const [cls, st] = await Promise.all([
        supabase.from("classes").select("name, section").eq("id", classId).maybeSingle(),
        supabase.from("students").select("id, full_name, father_name, roll_no").eq("class_id", classId).eq("status", "active").order("full_name"),
      ]);
      if (cls.data) setTitle(`${cls.data.name}${cls.data.section ? `-${cls.data.section}` : ""}`);
      const students = (st.data ?? []) as Row[];
      const ids = students.map((s) => s.id);
      if (ids.length) {
        const { data: fees } = await supabase.from("student_current_fee").select("student_id, residence, monthly_total").in("student_id", ids);
        for (const f of fees ?? []) {
          const s = students.find((x) => x.id === f.student_id);
          if (s) Object.assign(s, { residence: f.residence, total: Number(f.monthly_total) });
        }
      }
      setRows(students);
    })();
  }, [classId]);

  return (
    <>
      <h2 className="mt-5 text-xl font-medium tracking-tight">{title || "Class"}</h2>
      <Link
        href={`/admin/students/new?class=${classId}`}
        className="mt-4 flex h-14 items-center justify-between rounded-full bg-navy pl-6 pr-2 text-base font-medium text-white hover:bg-ink"
      >
        <span>Add student</span>
        <span className="flex size-10 items-center justify-center rounded-full bg-gold">
          <Plus aria-hidden className="size-[18px] text-ink" strokeWidth={1.75} />
        </span>
      </Link>

      <div className="mt-5 rounded-3xl border border-line bg-white px-4 py-1">
        {!rows ? (
          <p className="py-4 text-sm text-sub">Loading students</p>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-sub">No students in this class yet.</p>
        ) : (
          <ul>
            {rows.map((s) => (
              <li key={s.id} className="border-b border-line last:border-b-0">
                <Link href={`/admin/students/${s.id}`} className="flex items-center justify-between gap-3 py-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px]">{s.full_name}</span>
                    <span className="truncate text-sm text-sub">
                      {s.residence ? residenceLabel(s.residence) : "No fee set"}
                      {s.roll_no ? ` · Roll ${s.roll_no}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
                    {s.total !== undefined && rs(s.total)}
                    <ChevronRight aria-hidden className="size-[18px] text-sub" strokeWidth={1.75} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function FromAddress() {
  const { id } = useParams<{ id: string }>();
  return <ClassStudents classId={id} />;
}

export default function Page() {
  return (
    <Portal role="admin" title="Students" back="/admin/students">
      {() => (
        <Suspense>
          <FromAddress />
        </Suspense>
      )}
    </Portal>
  );
}
