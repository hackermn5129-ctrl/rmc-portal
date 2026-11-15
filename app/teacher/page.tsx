"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardCheck, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { className } from "@/lib/school";
import { jobsLabel, loadMyClasses, todayIso, type MyClass } from "@/lib/teacher";

type FeeCount = { cls: MyClass; paid: number; pending: number };

function Home({ teacherId }: { teacherId: string }) {
  const [classes, setClasses] = useState<MyClass[] | null>(null);
  const [marked, setMarked] = useState(0);
  const [fees, setFees] = useState<FeeCount[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const mine = await loadMyClasses(teacherId);
      const attendanceIds = mine.filter((c) => c.isClassIncharge).map((c) => c.id);
      const [lec, ...fee] = await Promise.all([
        attendanceIds.length
          ? supabase.from("lectures").select("id", { count: "exact", head: true }).in("class_id", attendanceIds).eq("held_on", todayIso())
          : Promise.resolve({ count: 0 }),
        ...mine
          .filter((c) => c.isFeeIncharge)
          .map((c) => supabase.rpc("class_fee_reminder", { p_class: c.id }).then((r) => ({ c, rows: (r.data ?? []) as { is_paid: boolean }[] }))),
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
        <p className="mt-2 text-sm leading-relaxed text-mist">The principal will add your classes and subjects. They will show here.</p>
      </div>
    );

  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const incharge = classes.filter((c) => c.isClassIncharge);
  const teaching = classes.filter((c) => c.subjects.length > 0);
  const actions = [
    incharge.length > 0 && { href: "/teacher/attendance", label: "Mark attendance", urdu: "حاضری", Icon: ClipboardCheck },
    teaching.length > 0 && { href: "/teacher/tests", label: "Tests and results", urdu: "ٹیسٹ اور نتائج", Icon: FileText },
  ].filter(Boolean) as { href: string; label: string; urdu: string; Icon: typeof FileText }[];

  return (
    <>
      <section className="mt-5 rounded-[28px] bg-navy p-5 text-white">
        <p className="text-sm text-mist">{date}</p>
        {incharge.length > 0 ? (
          <>
            <p className="mt-1 text-[34px] font-medium leading-none tracking-tight tabular-nums">{marked}</p>
            <p className="mt-1 text-sm text-mist">
              {marked === 1 ? "lecture" : "lectures"} marked today in {incharge.map(className).join(", ")}
            </p>
          </>
        ) : (
          <p className="mt-1 text-xl font-medium">Your classes</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {classes.map((c) => (
            <span key={c.id} className="rounded-full bg-white/10 px-3 py-1 text-sm">
              {className(c)}
              {jobsLabel(c) ? ` · ${jobsLabel(c)}` : ""}
            </span>
          ))}
        </div>
      </section>

      {actions.length > 0 && (
        <nav className={`mt-4 grid gap-2 ${actions.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {actions.map(({ href, label, urdu, Icon }) => (
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
      )}

      {fees.map((f) => (
        <Link key={f.cls.id} href={`/teacher/fees?class=${f.cls.id}`} className="mt-4 flex items-center justify-between rounded-[28px] border border-line bg-white p-5 hover:bg-bg">
          <span className="flex flex-col">
            <span className="text-sm text-sub">Fees in {className(f.cls)}</span>
            <span className="mt-1 text-[15px]">
              <span className="font-medium text-ok tabular-nums">{f.paid} paid</span>
              <span className="text-sub"> · </span>
              <span className={`font-medium tabular-nums ${f.pending ? "text-warn" : "text-ok"}`}>{f.pending} not paid</span>
            </span>
          </span>
          <ChevronRight aria-hidden className="size-[18px] text-sub" strokeWidth={1.75} />
        </Link>
      ))}

      {teaching.length > 0 && (
        <section className="mt-4 rounded-[28px] border border-line bg-white p-5">
          <h2 className="text-base font-medium">My subjects</h2>
          <ul className="mt-2">
            {teaching.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
                <span className="text-[15px]">{className(c)}</span>
                <span className="text-right text-sm text-sub">{c.subjects.map((s) => s.name).join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
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
