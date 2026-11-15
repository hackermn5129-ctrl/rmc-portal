"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { monthLabel, monthStart, rs } from "@/lib/fees";
import { className, type ClassRow } from "@/lib/school";
import { isPending, loadFeeOverview, type FeeOverview } from "@/lib/fee-data";

type Home = {
  fees: FeeOverview;
  teachers: number;
  admissions: number;
  left: number;
  paidStudents: number;
  billedStudents: number;
  collection: { month: string; label: string; amount: number }[];
  attendance: { cls: ClassRow; percent: number }[];
  presentToday: number;
  markedToday: number;
};

async function fetchHome(): Promise<Home> {
  const from = monthStart(-5);
  const thisMonth = monthStart();
  const today = new Date().toLocaleDateString("en-CA");
  const fees = await loadFeeOverview();
  const [teachers, admissions, left, payments, att, month] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher"),
    supabase.from("students").select("id", { count: "exact", head: true }).gte("admission_date", thisMonth),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "left").gte("left_date", thisMonth),
    supabase.from("fee_payments").select("amount, paid_on").gte("paid_on", from),
    supabase.from("daily_attendance").select("student_id, day_status").eq("held_on", today),
    supabase.from("fee_status").select("student_id, status").eq("month", thisMonth),
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

  const classOf = new Map(fees.students.map((s) => [s.id, s.class_id]));
  const tally = new Map<string, { counted: number; score: number }>();
  let presentToday = 0;
  let markedToday = 0;
  for (const a of att.data ?? []) {
    const c = classOf.get(a.student_id);
    if (!c) continue;
    markedToday += 1;
    if (a.day_status === "present" || a.day_status === "partial") presentToday += 1;
    if (a.day_status === "leave") continue;
    const t = tally.get(c) ?? { counted: 0, score: 0 };
    t.counted += 1;
    t.score += a.day_status === "present" ? 1 : a.day_status === "partial" ? 0.5 : 0;
    tally.set(c, t);
  }
  const attendance = fees.classes
    .filter((c) => tally.get(c.id)?.counted)
    .map((cls) => ({ cls, percent: (tally.get(cls.id)!.score / tally.get(cls.id)!.counted) * 100 }))
    .sort((a, b) => b.percent - a.percent);

  const rows = month.data ?? [];
  return {
    fees,
    teachers: teachers.count ?? 0,
    admissions: admissions.count ?? 0,
    left: left.count ?? 0,
    paidStudents: rows.filter((r) => r.status === "paid").length,
    billedStudents: rows.length,
    collection,
    attendance,
    presentToday,
    markedToday,
  };
}

const lakh = (n: number) => (n / 100000).toFixed(1);

function Overview() {
  const [home, setHome] = useState<Home | null>(null);

  useEffect(() => {
    let active = true;
    fetchHome().then((h) => active && setHome(h));
    return () => {
      active = false;
    };
  }, []);

  if (!home) return <p className="mt-6 text-sm text-sub">Loading the school overview</p>;

  const { fees } = home;
  const percent = fees.month.due > 0 ? Math.round((fees.month.paid / fees.month.due) * 100) : 0;
  const unpaid = fees.students.filter((s) => isPending(fees.balances.get(s.id))).length;
  const max = Math.max(1, ...home.collection.map((c) => c.amount));
  const pendingByClass = fees.classes
    .map((c) => {
      const list = fees.students.filter((s) => s.class_id === c.id && isPending(fees.balances.get(s.id)));
      return { cls: c, count: list.length, amount: list.reduce((a, s) => a + (fees.balances.get(s.id)?.outstanding ?? 0), 0) };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  const tiles = [
    { label: "Students", value: fees.students.length, tone: "" },
    { label: "Teachers", value: home.teachers, tone: "" },
    { label: "New admissions", value: home.admissions, tone: "text-ok" },
    { label: "Left this month", value: home.left, tone: "text-bad" },
  ];

  return (
    <>
      {fees.noSession && (
        <Link href="/admin/settings" className="mt-5 rounded-3xl bg-bad-soft px-4 py-3 text-sm text-bad-ink">
          Set the academic session in School setup to start monthly fees.
        </Link>
      )}

      <section className="mt-5 flex flex-col gap-4 rounded-[28px] bg-navy p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-mist">Fees collected</span>
          <span className="text-[13px] text-mist tabular-nums">
            {home.paidStudents} of {home.billedStudents} students
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[32px] font-medium leading-[1.1] tracking-tight text-bg tabular-nums">{rs(fees.month.paid)}</p>
          <p className="text-sm text-mist tabular-nums">of {rs(fees.month.due)} due this month</p>
        </div>
        <div role="img" aria-label={`${percent} percent of fees collected`} className="h-2 overflow-hidden rounded bg-bg/20">
          <div className="h-2 rounded bg-gold" style={{ width: `${Math.min(percent, 100)}%` }} />
        </div>
        <Link href="/admin/fees" className="flex h-12 items-center gap-2.5 self-start rounded-full bg-gold pl-5 pr-[18px] text-[15px] font-medium text-ink">
          See pending fees
          <ArrowRight aria-hidden className="size-[18px]" strokeWidth={1.75} />
        </Link>
      </section>

      <section aria-label="School totals" className="mt-3 grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col gap-2 rounded-3xl border border-line bg-white px-4 py-3.5">
            <span className="text-sm text-sub">{t.label}</span>
            <span className={`text-[28px] font-medium leading-none tracking-tight tabular-nums ${t.tone}`}>{t.value}</span>
          </div>
        ))}
      </section>

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-base font-medium">Fee collection</h2>
        <span className="text-[13px] text-sub">Rs lakh · last 6 months</span>
      </div>
      <div className="mt-3 flex flex-col gap-2 rounded-3xl border border-line bg-white p-4">
        <svg
          role="img"
          aria-label={`Fees collected each month in lakh rupees. ${home.collection.map((c) => `${c.label} ${lakh(c.amount)}`).join(", ")}`}
          viewBox="0 0 318 148"
          className="block h-auto w-full tabular-nums"
        >
          <line x1="0" y1="120.5" x2="318" y2="120.5" stroke="rgba(19,35,58,0.10)" strokeWidth="1" />
          {home.collection.map((c, i) => {
            const last = i === home.collection.length - 1;
            const h = Math.max(2, (c.amount / max) * 95);
            const x = 11.5 + i * 53;
            return (
              <g key={c.month}>
                <rect x={x} y={120 - h} width="30" height={h} rx="6" fill={last ? "#1F3A5F" : "#C9D2DD"} />
                <text x={x + 15} y={114 - h} textAnchor="middle" fontSize="11" fill={last ? "#13233A" : "#5F6B7A"} fontWeight={last ? 500 : 400}>
                  {lakh(c.amount)}
                </text>
                <text x={x + 15} y="140" textAnchor="middle" fontSize="12" fill={last ? "#13233A" : "#5F6B7A"}>
                  {c.label}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="text-[13px] text-sub">
          {monthLabel(monthStart()).split(" ")[0]} is still open, {unpaid} {unpaid === 1 ? "student" : "students"} yet to pay
        </p>
      </div>

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-base font-medium">Attendance today</h2>
        <span className="text-[13px] text-sub tabular-nums">
          {home.markedToday ? `${home.presentToday} of ${home.markedToday} present` : "Not marked yet"}
        </span>
      </div>
      <div className="mt-3 flex flex-col rounded-3xl border border-line bg-white px-4 py-2">
        {home.attendance.length === 0 ? (
          <p className="py-3 text-sm text-sub">Shows here once teachers mark today&apos;s lectures.</p>
        ) : (
          home.attendance.map((a) => (
            <div key={a.cls.id} className="grid h-11 grid-cols-[76px_1fr_40px] items-center gap-3">
              <span className="text-sm">{className(a.cls)}</span>
              <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-[#E6EBF0]">
                <div className={`h-1.5 rounded-full ${a.percent >= 90 ? "bg-navy" : a.percent >= 75 ? "bg-warn" : "bg-bad"}`} style={{ width: `${Math.round(a.percent)}%` }} />
              </div>
              <span className="text-right text-sm font-medium tabular-nums">{Math.round(a.percent)}%</span>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-base font-medium">Fees pending by class</h2>
        <Link href="/admin/fees" className="-my-3 py-3 text-sm text-navy">
          See all
        </Link>
      </div>
      <div className="mt-3 flex flex-col rounded-3xl border border-line bg-white px-4 py-1">
        {pendingByClass.length === 0 ? (
          <p className="py-3 text-sm text-ok">No fees pending.</p>
        ) : (
          pendingByClass.map((p) => (
            <Link key={p.cls.id} href={`/admin/fees/class/${p.cls.id}`} className="flex h-14 items-center justify-between border-b border-line last:border-b-0">
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px]">{className(p.cls)}</span>
                <span className="text-[13px] text-sub">
                  {p.count} {p.count === 1 ? "student" : "students"}
                </span>
              </span>
              <span className="text-[15px] font-medium tabular-nums">{rs(p.amount)}</span>
            </Link>
          ))
        )}
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <Portal role="admin" title={() => new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })} subtitle="School overview · Principal">
      {() => <Overview />}
    </Portal>
  );
}
