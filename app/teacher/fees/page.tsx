"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { WithQuery } from "@/components/route";
import { className } from "@/lib/school";
import { loadMyClasses, type MyClass } from "@/lib/teacher";

type Row = { student_id: string; full_name: string; roll_no: string | null; is_paid: boolean; unpaid_months: number };

// The class teacher sees who has paid and who hasn't. No amounts, by design.
function ClassFees({ teacherId, classId }: { teacherId: string; classId: string | null }) {
  const [cls, setCls] = useState<MyClass | null | undefined>(undefined);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const mine = (await loadMyClasses(teacherId)).filter((c) => c.isClassTeacher);
      const pick = mine.find((c) => c.id === classId) ?? mine[0] ?? null;
      const { data } = pick ? await supabase.rpc("class_fee_reminder", { p_class: pick.id }) : { data: [] };
      if (!active) return;
      setCls(pick);
      setRows((data ?? []) as Row[]);
    })();
    return () => {
      active = false;
    };
  }, [teacherId, classId]);

  if (cls === undefined) return <p className="mt-6 text-sm text-sub">Loading</p>;
  if (cls === null) return <p className="mt-6 text-sm text-sub">You are not a class teacher yet.</p>;

  const pending = rows.filter((r) => !r.is_paid).sort((a, b) => b.unpaid_months - a.unpaid_months);
  const paid = rows.filter((r) => r.is_paid);

  return (
    <>
      <section className="mt-5 rounded-[28px] bg-navy p-5 text-white">
        <p className="text-sm text-mist">Fees in {className(cls)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[34px] font-medium leading-none tabular-nums">{paid.length}</p>
            <p className="mt-1 text-sm text-mist">Paid</p>
          </div>
          <div>
            <p className="text-[34px] font-medium leading-none tabular-nums text-gold">{pending.length}</p>
            <p className="mt-1 text-sm text-mist">Not paid</p>
          </div>
        </div>
      </section>

      <h2 className="mt-6 text-base font-medium">Please remind</h2>
      <ul className="mt-3 rounded-3xl border border-line bg-white px-4 py-1">
        {pending.length === 0 && <li className="py-4 text-sm text-ok">Everyone has paid.</li>}
        {pending.map((r) => (
          <li key={r.student_id} className="flex h-14 items-center justify-between gap-3 border-b border-line last:border-b-0">
            <span className="flex items-center gap-2 truncate text-[15px]">
              {r.unpaid_months >= 2 && <span className="size-2 shrink-0 rounded-full bg-bad" aria-label="Unpaid for 2 months or more" />}
              {r.full_name}
            </span>
            <span className={`shrink-0 text-sm ${r.unpaid_months >= 2 ? "text-bad" : "text-warn"}`}>
              {r.unpaid_months} {r.unpaid_months === 1 ? "month" : "months"}
            </span>
          </li>
        ))}
      </ul>

      {paid.length > 0 && (
        <>
          <h2 className="mt-6 text-base font-medium">Paid</h2>
          <ul className="mt-3 rounded-3xl border border-line bg-white px-4 py-1">
            {paid.map((r) => (
              <li key={r.student_id} className="flex h-12 items-center justify-between border-b border-line text-[15px] last:border-b-0">
                {r.full_name}
                <span className="text-sm text-ok">Paid</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export default function TeacherFeesPage() {
  return (
    <Portal role="teacher" title="Class fees" back="/teacher">
      {(p) => <WithQuery name="class" render={(c) => <ClassFees teacherId={p.id} classId={c} />} />}
    </Portal>
  );
}
