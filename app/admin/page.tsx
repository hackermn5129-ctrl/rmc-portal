"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Settings, Users, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { monthStart, rs } from "@/lib/fees";
import { className, loadClasses, type ClassRow } from "@/lib/school";

type Home = {
  counts: { students: number; teachers: number; classes: number };
  collection: { month: string; label: string; amount: number }[];
  attendance: { cls: ClassRow; percent: number | null; marked: number }[];
};

async function fetchHome(): Promise<Home> {
  const from = monthStart(-5);
  const today = new Date().toLocaleDateString("en-CA");
  const [students, teachers, classes, payments, att] = await Promise.all([
    supabase.from("students").select("id, class_id").eq("status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher"),
    loadClasses(),
    supabase.from("fee_payments").select("amount, paid_on").gte("paid_on", from),
    supabase.from("daily_attendance").select("student_id, day_status").eq("held_on", today),
  ]);

  const collection = Array.from({ length: 6 }, (_, i) => {
    const m = monthStart(i - 5);
    const [y, mo] = m.split("-").map(Number);
    return { month: m.slice(0, 7), label: new Date(y, mo - 1, 1).toLocaleDateString("en-GB", { month: "short" }), amount: 0 };
  });
  for (const p of payments.data ?? []) {
    const row = collection.find((c) => c.month === String(p.paid_on).slice(0, 7));
    if (row) row.amount += Number(p.amount);
  }

  const classOf = new Map((students.data ?? []).map((s) => [s.id, s.class_id]));
  const tally = new Map<string, { counted: number; score: number }>();
  for (const a of att.data ?? []) {
    if (a.day_status === "leave") continue;
    const c = classOf.get(a.student_id);
    if (!c) continue;
    const t = tally.get(c) ?? { counted: 0, score: 0 };
    t.counted += 1;
    t.score += a.day_status === "present" ? 1 : a.day_status === "partial" ? 0.5 : 0;
    tally.set(c, t);
  }
  const attendance = classes.map((cls) => {
    const t = tally.get(cls.id);
    return { cls, marked: t?.counted ?? 0, percent: t && t.counted ? (t.score / t.counted) * 100 : null };
  });

  return {
    counts: { students: students.data?.length ?? 0, teachers: teachers.count ?? 0, classes: classes.length },
    collection,
    attendance,
  };
}

const SECTIONS = [
  { href: "/admin/students", label: "Students", urdu: "طلبہ", Icon: GraduationCap },
  { href: "/admin/fees", label: "Fees", urdu: "فیس", Icon: Wallet },
  { href: "/admin/teachers", label: "Teachers", urdu: "اساتذہ", Icon: Users },
  { href: "/admin/settings", label: "School setup", urdu: "ترتیبات", Icon: Settings },
];

function Overview() {
  const [home, setHome] = useState<Home | null>(null);

  useEffect(() => {
    let active = true;
    fetchHome().then((h) => active && setHome(h));
    return () => {
      active = false;
    };
  }, []);

  const stats = [
    { label: "Students", value: home?.counts.students ?? 0 },
    { label: "Teachers", value: home?.counts.teachers ?? 0 },
    { label: "Classes", value: home?.counts.classes ?? 0 },
  ];
  const max = Math.max(1, ...(home?.collection.map((c) => c.amount) ?? [1]));
  const thisMonth = home?.collection.at(-1)?.amount ?? 0;
  const marked = home?.attendance.filter((a) => a.marked > 0) ?? [];

  return (
    <>
      <section aria-label="School totals" className="mt-5 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-2 rounded-3xl border border-line bg-white px-4 py-3.5">
            <span className="text-sm text-sub">{s.label}</span>
            <span className="text-[28px] font-medium leading-none tracking-tight tabular-nums">{s.value}</span>
          </div>
        ))}
      </section>

      <nav aria-label="Sections" className="mt-3 grid grid-cols-2 gap-2">
        {SECTIONS.map(({ href, label, urdu, Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-3xl border border-line bg-white px-4 py-3 hover:bg-bg">
            <span className="flex size-10 items-center justify-center rounded-full bg-bg">
              <Icon aria-hidden className="size-[18px] text-navy" strokeWidth={1.75} />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px]">{label}</span>
              <span lang="ur" dir="rtl" className="font-urdu text-xs leading-[2] text-sub">
                {urdu}
              </span>
            </span>
          </Link>
        ))}
      </nav>

      <Link href="/admin/fees" className="mt-4 block rounded-[28px] bg-navy p-5 text-white">
        <p className="text-sm text-mist">Fee collected this month</p>
        <p className="mt-1 text-[34px] font-medium leading-none tracking-tight tabular-nums">{rs(thisMonth)}</p>
        <div className="mt-5 flex h-28 items-end gap-2" role="img" aria-label="Fee collected in each of the last six months">
          {(home?.collection ?? []).map((c, i, all) => (
            <div key={c.month} className="flex flex-1 flex-col items-center gap-2">
              <div
                className={`w-full rounded-t-lg ${i === all.length - 1 ? "bg-gold" : "bg-white/25"}`}
                style={{ height: `${Math.max(4, (c.amount / max) * 88)}px` }}
                title={rs(c.amount)}
              />
              <span className="text-xs text-mist">{c.label}</span>
            </div>
          ))}
        </div>
      </Link>

      <section className="mt-4 rounded-[28px] border border-line bg-white p-5">
        <h2 className="text-base font-medium">Attendance today</h2>
        {marked.length === 0 ? (
          <p className="mt-2 text-sm text-sub">Not marked yet today. It shows here once teachers mark attendance.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {marked.map((a) => (
              <li key={a.cls.id} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm">
                  <span>{className(a.cls)}</span>
                  <span className={`font-medium tabular-nums ${(a.percent ?? 0) >= 85 ? "text-ok" : (a.percent ?? 0) >= 70 ? "text-warn" : "text-bad"}`}>{Math.round(a.percent ?? 0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full bg-navy" style={{ width: `${Math.round(a.percent ?? 0)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function AdminPage() {
  return (
    <Portal role="admin" title="School overview">
      {() => <Overview />}
    </Portal>
  );
}
