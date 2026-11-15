"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardCheck, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { className } from "@/lib/school";
import { loadMyClasses, todayIso, type MyClass } from "@/lib/teacher";

type FeeCount = { cls: MyClass; paid: number; pending: number };

function Home({ teacherId }: { teacherId: string }) {
  const [classes, setClasses] = useState<MyClass[] | null>(null);
  const [marked, setMarked] = useState(0);
  const [fees, setFees] = useState<FeeCount[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const mine = await loadMyClasses(teacherId);
      const ids = mine.map((c) => c.id);
      const [lec, ...fee] = await Promise.all([
        ids.length ? supabase.from("lectures").select("id", { count: "exact", head: true }).in("class_id", ids).eq("held_on", todayIso()) : Promise.resolve({ count: 0 }),
        ...mine.filter((c) => c.isClassTeacher).map((c) => supabase.rpc("class_fee_reminder", { p_class: c.id }).then((r) => ({ c, rows: (r.data ?? []) as { is_paid: boolean }[] }))),
      ]);
      if (!active) return;
      setClasses(mine);
      setMarked(lec.count ?? 0);
      setFees(fee.map(({ c, rows }) => ({ cls: c, paid: rows.filter((r) => r.is_paid).length, pending: rows.filter((r) => !r.is_paid).length })));
    })();
    return () => {
      active = false;
    };
  }, [teacherId]);

  if (!classes) return <p className="mt-6 text-sm text-sub">Loading your classes</p>;

  if (classes.length === 0)
    return (
      <div className="mt-5 rounded-[28px] bg-navy p-5 text-white">
        <h2 className="text-xl font-medium">No classes yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-mist">The principal will add the classes you teach. They will show here.</p>
      </div>
    );

  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <section className="mt-5 rounded-[28px] bg-navy p-5 text-white">
        <p className="text-sm text-mist">{date}</p>
        <p className="mt-1 text-[34px] font-medium leading-none tracking-tight tabular-nums">{marked}</p>
        <p className="mt-1 text-sm text-mist">{marked === 1 ? "lecture marked today" : "lectures marked today"}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {classes.map((c) => (
            <span key={c.id} className="rounded-full bg-white/10 px-3 py-1 text-sm">
              {className(c)}
              {c.isClassTeacher ? " · class teacher" : ""}
            </span>
          ))}
        </div>
      </section>

      <nav className="mt-4 grid grid-cols-2 gap-2">
        {[
          { href: "/teacher/attendance", label: "Mark attendance", urdu: "حاضری", Icon: ClipboardCheck },
          { href: "/teacher/tests", label: "Tests and results", urdu: "ٹیسٹ اور نتائج", Icon: FileText },
        ].map(({ href, label, urdu, Icon }) => (
          <Link key={href} href={href} className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-4 hover:bg-bg">
            <span className="flex size-11 items-center justify-center rounded-full bg-gold">
              <Icon aria-hidden className="size-[20px] text-ink" strokeWidth={1.75} />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-medium">{label}</span>
              <span lang="ur" dir="rtl" className="font-urdu text-xs leading-[2] text-sub">
                {urdu}
              </span>
            </span>
          </Link>
        ))}
      </nav>

      {fees.map((f) => (
        <Link key={f.cls.id} href={`/teacher/fees?class=${f.cls.id}`} className="mt-4 flex items-center justify-between rounded-[28px] border border-line bg-white p-5 hover:bg-bg">
          <span className="flex flex-col">
            <span className="text-sm text-sub">Fees in {className(f.cls)}</span>
            <span className="mt-1 text-[15px]">
              <span className="font-medium text-ok tabular-nums">{f.paid} paid</span>
              <span className="text-sub"> · </span>
              <span className={`font-medium tabular-nums ${f.pending ? "text-warn" : "text-ok"}`}>{f.pending} pending</span>
            </span>
          </span>
          <ChevronRight aria-hidden className="size-[18px] text-sub" strokeWidth={1.75} />
        </Link>
      ))}
    </>
  );
}

export default function TeacherPage() {
  return (
    <Portal role="teacher" title="Home">
      {(p) => <Home teacherId={p.id} />}
    </Portal>
  );
}
