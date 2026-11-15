"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Megaphone, TriangleAlert } from "lucide-react";
import { monthStart, rs } from "@/lib/fees";
import {
  countDays,
  dayPercent,
  firstName,
  iso,
  loadDays,
  loadFees,
  loadNotices,
  loadTestResults,
  scoreOf,
  thisWeek,
  type Day,
  type Notice,
  type TestResult,
} from "@/lib/family";
import { DayDot, LineChart, Ring, Urdu, toneColor } from "./visuals";
import { NextTestCard } from "./learn";
import type { Ctx } from "./shell";

type Data = { days: Day[]; tests: TestResult[]; fees: Awaited<ReturnType<typeof loadFees>>; notices: Notice[] };
const isRecent = (n: Notice) => Date.now() - new Date(n.created_at).getTime() < 14 * 864e5;

function useHomeData({ child, session }: Ctx) {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([loadDays(child.id, session?.id), loadTestResults(child, session?.id), loadFees(child.id), loadNotices(3)]).then(([days, tests, fees, notices]) => {
      if (active) setData({ days, tests, fees, notices: notices.filter(isRecent) });
    });
    return () => {
      active = false;
    };
  }, [child, session]);
  return data;
}

function subjectScores(tests: TestResult[]) {
  const names = [...new Set(tests.filter((t) => t.marks !== null).map((t) => t.subject))];
  return names.map((n) => ({ name: n, score: scoreOf(tests.filter((t) => t.subject === n)) })).filter((x) => x.score !== null) as { name: string; score: number }[];
}

function Week({ days }: { days: Day[] }) {
  const week = thisWeek();
  const marked = week.map((d) => days.find((x) => x.held_on === iso(d)) ?? null);
  const counted = marked.filter((d) => d && d.day_status !== "leave");
  const full = counted.filter((d) => d!.day_status === "present").length;
  return (
    <>
      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-base font-medium">This week</h2>
        <span className="text-[13px] text-sub tabular-nums">{counted.length ? `${full} of ${counted.length} days` : "Not marked yet"}</span>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-1 rounded-3xl border border-line bg-white p-4">
        {week.map((d, i) => {
          const label = d.toLocaleDateString("en-GB", { weekday: "short" });
          return (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <DayDot status={marked[i]?.day_status ?? null} label={label} size={36} />
              <span className="text-xs text-sub">{label}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function NoticeCard({ notices }: { notices: Notice[] }) {
  if (!notices.length) return null;
  const n = notices[0];
  return (
    <section className="mt-4 rounded-3xl border border-line bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold">
          <Megaphone aria-hidden className="size-[18px] text-ink" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-medium">{n.title}</p>
          {n.body && <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-sm text-sub">{n.body}</p>}
          <p className="mt-1 text-xs text-sub">{new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
        </div>
      </div>
    </section>
  );
}

export function ParentHome(ctx: Ctx) {
  const data = useHomeData(ctx);
  if (!data) return <p className="mt-6 text-sm text-sub">Loading</p>;
  const { child, base } = ctx;
  const { days, tests, fees, notices } = data;
  const name = firstName(child.full_name);

  const month = days.filter((d) => d.held_on >= monthStart());
  const attPct = dayPercent(month);
  const attDone = countDays(month, "present") + countDays(month, "partial");
  const attTotal = month.filter((d) => d.day_status !== "leave").length;
  const overall = scoreOf(tests);
  const subjects = subjectScores(tests);
  const weakest = [...subjects].sort((a, b) => a.score - b.score)[0];

  const serious = (attPct !== null && attPct < 75) || (overall !== null && overall < 50) || fees.unpaidMonths >= 2;
  const minor = (attPct !== null && attPct < 90) || (weakest && weakest.score < 50) || fees.unpaidMonths === 1;
  const noData = attPct === null && overall === null;
  const status = noData
    ? { bg: "bg-bg border border-line", dot: "bg-mist", ink: "text-ink", text: `Welcome. ${name}'s results will show here`, urdu: "نتائج جلد یہاں نظر آئیں گے", Icon: Check }
    : serious
      ? { bg: "bg-bad-soft", dot: "bg-bad", ink: "text-bad-ink", text: `${name} needs attention`, urdu: "توجہ کی ضرورت ہے", Icon: TriangleAlert }
      : minor
        ? { bg: "bg-[#FBF1E1]", dot: "bg-warn", ink: "text-[#5C3D0F]", text: `${name} is doing okay`, urdu: "تھوڑی توجہ چاہیے", Icon: Check }
        : { bg: "bg-[#E7F2EC]", dot: "bg-ok", ink: "text-[#17402E]", text: `${name} is doing well`, urdu: "کارکردگی اچھی ہے", Icon: Check };

  const alert =
    weakest && weakest.score < 50
      ? { title: `Weak in ${weakest.name}`, urdu: "اس مضمون میں کمزور", value: `${Math.round(weakest.score)}%`, href: `${base}/progress` }
      : fees.unpaidMonths >= 2
        ? { title: `Fee due for ${fees.unpaidMonths} months`, urdu: "فیس باقی ہے", value: rs(fees.owed), href: `${base}/fees` }
        : null;

  const last5 = tests.filter((t) => t.percent !== null).slice(-5);
  const change = last5.length >= 2 ? last5[last5.length - 1].percent! - last5[0].percent! : null;

  const rows = [
    {
      href: `${base}/attendance`,
      label: "Attendance",
      urdu: "حاضری",
      visual: <Ring percent={attPct} size={48} stroke={5} color={toneColor(attPct, 90, 75)} label={`${Math.round(attPct ?? 0)} percent attendance`} />,
      value: attTotal ? `${attDone}/${attTotal}` : "–",
      tone: "",
    },
    {
      href: `${base}/progress`,
      label: "Marks",
      urdu: "نمبر",
      visual: <Ring percent={overall} size={48} stroke={5} color={toneColor(overall)} label={`${Math.round(overall ?? 0)} percent marks`} />,
      value: overall === null ? "–" : `${Math.round(overall)}%`,
      tone: "",
    },
    {
      href: `${base}/fees`,
      label: "Fee",
      urdu: "فیس",
      visual:
        fees.owed > 0 ? (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-bad">
            <TriangleAlert aria-hidden className="size-6 text-white" strokeWidth={2.25} />
          </span>
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ok">
            <Check aria-hidden className="size-6 text-white" strokeWidth={2.5} />
          </span>
        ),
      value: fees.owed > 0 ? rs(fees.owed) : fees.billed ? "Paid" : "–",
      tone: fees.owed > 0 ? "text-bad" : "text-ok",
    },
  ];

  return (
    <>
      <section className={`mt-5 flex items-center gap-4 rounded-[28px] px-5 py-6 ${status.bg}`}>
        <span className={`flex size-[60px] shrink-0 items-center justify-center rounded-full ${status.dot}`}>
          <status.Icon aria-hidden className="size-[30px] text-white" strokeWidth={2.75} />
        </span>
        <div className="flex flex-col">
          <h2 className={`text-2xl font-medium leading-tight tracking-tight ${status.ink}`}>{status.text}</h2>
          <Urdu className={`text-base ${status.ink}`}>{status.urdu}</Urdu>
        </div>
      </section>

      <div className="mt-3 flex flex-col rounded-3xl border border-line bg-white px-4 py-1">
        {rows.map((r) => (
          <Link key={r.label} href={r.href} className="flex min-h-20 items-center gap-3.5 border-b border-line last:border-b-0">
            {r.visual}
            <span className="flex flex-1 flex-col">
              <span className="text-base">{r.label}</span>
              <Urdu className="text-sub">{r.urdu}</Urdu>
            </span>
            <span className={`text-lg font-medium tabular-nums ${r.tone}`}>{r.value}</span>
            <ChevronRight aria-hidden className="size-[18px] text-mist" strokeWidth={1.75} />
          </Link>
        ))}
      </div>

      {alert && (
        <Link href={alert.href} className="mt-3 flex items-center gap-3.5 rounded-3xl bg-bad-soft px-4 py-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-bad">
            <TriangleAlert aria-hidden className="size-6 text-white" strokeWidth={2.25} />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="text-base font-medium text-bad-ink">{alert.title}</span>
            <Urdu className="text-bad-ink">{alert.urdu}</Urdu>
          </span>
          <span className="text-lg font-medium text-bad-ink tabular-nums">{alert.value}</span>
        </Link>
      )}

      <NoticeCard notices={notices} />

      {last5.length > 0 && (
        <>
          <div className="mt-6 flex items-baseline justify-between">
            <h2 className="text-base font-medium">Progress</h2>
            <span className="text-[13px] text-sub">Last {last5.length} tests</span>
          </div>
          <div className="mt-3 flex flex-col gap-2.5 rounded-3xl border border-line bg-white p-4">
            <LineChart
              label={`Marks in the last ${last5.length} tests: ${last5.map((t) => Math.round(t.percent!)).join(", ")} percent`}
              points={last5.map((t) => ({ label: new Date(t.held_on).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), value: t.percent! }))}
              color={change !== null && change < 0 ? "#B4443C" : "#2E7D5B"}
            />
            <Link href={`${base}/progress`} className="flex min-h-11 items-center justify-between">
              <span className={`text-sm font-medium tabular-nums ${change === null ? "text-sub" : change >= 0 ? "text-ok" : "text-bad"}`}>
                {change === null ? "One test so far" : `${change >= 0 ? "↑" : "↓"} ${Math.abs(Math.round(change))}% in ${last5.length} tests`}
              </span>
              <span className="inline-flex items-center gap-1 text-sm text-navy">
                Full progress <ChevronRight aria-hidden className="size-4" strokeWidth={1.75} />
              </span>
            </Link>
          </div>
        </>
      )}

      <Week days={days} />
    </>
  );
}

export function StudentHome(ctx: Ctx) {
  const data = useHomeData(ctx);
  if (!data) return <p className="mt-6 text-sm text-sub">Loading</p>;
  const { base } = ctx;
  const { days, tests, notices } = data;

  const month = days.filter((d) => d.held_on >= monthStart());
  const attPct = dayPercent(month);
  const attDone = countDays(month, "present") + countDays(month, "partial");
  const attTotal = month.filter((d) => d.day_status !== "leave").length;
  const sat = tests.filter((t) => t.percent !== null);
  const last = sat[sat.length - 1];
  const prev = sat[sat.length - 2];
  const overall = scoreOf(tests);
  const monthName = new Date().toLocaleDateString("en-GB", { month: "long" });

  return (
    <>
      <section className="mt-5 flex flex-col gap-4 rounded-[28px] bg-navy p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-mist">Your overall score</span>
          <span className="rounded-full border border-mist/35 px-2.5 py-1 text-[13px] text-mist">This session</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[48px] font-medium leading-none tracking-tight text-bg tabular-nums">
              {overall === null ? "–" : Math.round(overall)}
              {overall !== null && <span className="text-[22px] text-mist">%</span>}
            </p>
            <p className="mt-1 text-sm text-mist">{sat.length ? `From ${sat.length} ${sat.length === 1 ? "test" : "tests"}` : "No marks yet"}</p>
          </div>
          <Ring percent={overall} size={84} stroke={9} color="#E3BE6A" track="rgba(241,244,247,0.18)" label={`Overall ${Math.round(overall ?? 0)} percent`} />
        </div>
        <Link href={`${base}/progress`} className="flex h-12 items-center gap-2.5 self-start rounded-full bg-gold pl-5 pr-[18px] text-[15px] font-medium text-ink">
          See progress
          <ArrowRight aria-hidden className="size-[18px]" strokeWidth={1.75} />
        </Link>
      </section>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link href={`${base}/attendance`} className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-4">
          <span className="text-sm text-sub">Attendance</span>
          <span className="flex items-center justify-between gap-2">
            <span className="text-[34px] font-medium leading-none tracking-tight tabular-nums">
              {attTotal ? attDone : "–"}
              {attTotal > 0 && <span className="text-base text-sub">/{attTotal}</span>}
            </span>
            <Ring percent={attPct} label={`${Math.round(attPct ?? 0)} percent attendance this month`} showText />
          </span>
          <span className="text-[13px] text-sub">days in {monthName}</span>
        </Link>
        <Link href={`${base}/progress`} className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-4">
          <span className="text-sm text-sub">Last test</span>
          <span className="flex items-center justify-between gap-2">
            <span className="text-[34px] font-medium leading-none tracking-tight tabular-nums">
              {last ? Math.round(last.percent!) : "–"}
              {last && <span className="text-base text-sub">%</span>}
            </span>
            <Ring percent={last?.percent ?? null} label={`${Math.round(last?.percent ?? 0)} percent in the last test`} />
          </span>
          {last && prev ? (
            <span className={`text-[13px] ${last.percent! >= prev.percent! ? "text-ok" : "text-bad"}`}>
              {last.percent! >= prev.percent! ? "+" : "−"}
              {Math.abs(Math.round(last.percent! - prev.percent!))}% vs last test
            </span>
          ) : (
            <span className="text-[13px] text-sub">{last ? last.subject : "No tests yet"}</span>
          )}
        </Link>
      </div>

      <NextTestCard {...ctx} />

      <NoticeCard notices={notices} />

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-base font-medium">Recent results</h2>
        <Link href={`${base}/progress`} className="-my-3 py-3 text-sm text-navy">
          See all
        </Link>
      </div>
      <div className="mt-3 flex flex-col rounded-3xl border border-line bg-white px-4 py-1">
        {sat.length === 0 && <p className="py-4 text-sm text-sub">Marks show here when teachers enter them.</p>}
        {sat
          .slice(-4)
          .reverse()
          .map((t) => (
            <Link key={t.id} href={`${base}/progress/${t.subject_id}`} className="flex h-14 items-center justify-between border-b border-line last:border-b-0">
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px]">{t.subject}</span>
                <span className="text-[13px] text-sub">
                  {new Date(t.held_on).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {t.kind}
                </span>
              </span>
              <span className="text-[15px] font-medium tabular-nums">
                {t.marks}/{t.total_marks}
              </span>
            </Link>
          ))}
      </div>

      <Week days={days} />
    </>
  );
}
