"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { monthStart } from "@/lib/fees";
import { countDays, dayPercent, iso, loadDays, loadLectures, monthsOf, shortMonth, thisWeek, type Day, type LectureMark } from "@/lib/family";
import { DayDot, DayLegend, Ring, toneColor } from "./visuals";
import type { Ctx } from "./shell";

const SHIFT_LABEL = { morning: "Morning", evening: "Evening", night: "Night" } as const;
const MARK_STYLE = {
  present: "bg-[#E7F2EC] text-[#17402E]",
  late: "bg-[#FBF1E1] text-[#5C3D0F]",
  absent: "bg-bad-soft text-bad-ink",
  leave: "bg-bg text-sub",
} as const;
const MARK_WORD = { present: "", late: " (late)", absent: " (absent)", leave: " (leave)" } as const;

function useDays(ctx: Ctx, allSessions = false) {
  const [days, setDays] = useState<Day[] | null>(null);
  useEffect(() => {
    let active = true;
    loadDays(ctx.child.id, allSessions ? undefined : ctx.session?.id).then((d) => active && setDays(d));
    return () => {
      active = false;
    };
  }, [ctx.child.id, ctx.session, allSessions]);
  return days;
}

// The lectures of one day, grouped by shift.
export function DayBreakdown({ studentId, date, day }: { studentId: string; date: string; day: Day | null }) {
  const [marks, setMarks] = useState<LectureMark[] | null>(null);
  useEffect(() => {
    let active = true;
    loadLectures(studentId, date).then((m) => active && setMarks(m));
    return () => {
      active = false;
    };
  }, [studentId, date]);

  const attended = (marks ?? []).filter((m) => m.status === "present" || m.status === "late").length;
  const statusLabel = day ? { present: "Full day", partial: "Partly present", absent: "Absent", leave: "Leave" }[day.day_status] : "Not marked";
  const statusColor = day ? { present: "bg-ok", partial: "bg-warn", absent: "bg-bad", leave: "bg-mist" }[day.day_status] : "bg-line-strong";

  return (
    <div className="flex flex-col gap-3.5 rounded-3xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-medium tabular-nums">{marks ? `${attended} of ${marks.length} lectures` : "Loading"}</span>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
          <span aria-hidden className={`size-3 rounded-full ${statusColor}`} />
          {statusLabel}
        </span>
      </div>
      {marks?.length === 0 && <p className="text-sm text-sub">No lectures marked on this day.</p>}
      {(["morning", "evening", "night"] as const).map((shift) => {
        const list = (marks ?? []).filter((m) => m.lectures?.shift === shift);
        if (!list.length) return null;
        return (
          <div key={shift} className="grid grid-cols-[64px_1fr] items-start gap-2">
            <span className="text-[13px] leading-8 text-sub">{SHIFT_LABEL[shift]}</span>
            <div className="flex flex-wrap gap-1.5">
              {list.map((m, i) => (
                <span key={i} className={`inline-flex h-8 items-center rounded-full px-3 text-[13px] ${MARK_STYLE[m.status]}`}>
                  {m.lectures?.subjects?.name}
                  {MARK_WORD[m.status]}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AttendanceOverview(ctx: Ctx) {
  const days = useDays(ctx);
  if (!days) return <p className="mt-6 text-sm text-sub">Loading</p>;
  const { child, base, session } = ctx;
  const month = days.filter((d) => d.held_on >= monthStart());
  const pct = dayPercent(month);
  const week = thisWeek();
  const latest = days[days.length - 1] ?? null;
  const todayIso = iso(new Date());
  const showDate = days.find((d) => d.held_on === todayIso) ? todayIso : latest?.held_on ?? todayIso;
  const yearPct = dayPercent(days);
  const monthName = new Date().toLocaleDateString("en-GB", { month: "long" });

  return (
    <>
      <section className="mt-5 flex flex-col gap-4 rounded-[28px] bg-navy p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-mist">{monthName}</span>
            <p className="text-[48px] font-medium leading-none tracking-tight text-bg tabular-nums">
              {pct === null ? "–" : Math.round(pct)}
              {pct !== null && <span className="text-[22px] text-mist">%</span>}
            </p>
            <span className="text-sm text-mist tabular-nums">
              {month.length
                ? `${countDays(month, "present")} full · ${countDays(month, "partial")} partly · ${countDays(month, "absent")} absent`
                : "Not marked yet this month"}
            </span>
          </div>
          <Ring percent={pct} size={84} stroke={9} color="#E3BE6A" track="rgba(241,244,247,0.18)" label={`${Math.round(pct ?? 0)} percent attendance in ${monthName}`} />
        </div>
        <Link href={`${base}/attendance/month`} className="flex h-12 items-center gap-2.5 self-start rounded-full bg-gold pl-5 pr-[18px] text-[15px] font-medium text-ink">
          See whole month
          <ArrowRight aria-hidden className="size-[18px]" strokeWidth={1.75} />
        </Link>
      </section>

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-base font-medium">This week</h2>
        <span className="text-[13px] text-sub tabular-nums">
          {week[0].getDate()} to {week[5].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-1 rounded-3xl border border-line bg-white p-4">
        {week.map((d) => {
          const label = d.toLocaleDateString("en-GB", { weekday: "short" });
          return (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <DayDot status={days.find((x) => x.held_on === iso(d))?.day_status ?? null} label={label} />
              <span className="text-xs text-sub">{label}</span>
            </div>
          );
        })}
      </div>
      <DayLegend />

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-base font-medium">{showDate === todayIso ? "Today" : "Last school day"}, lecture by lecture</h2>
        <span className="text-[13px] text-sub tabular-nums">{new Date(showDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
      </div>
      <div className="mt-3">
        <DayBreakdown studentId={child.id} date={showDate} day={days.find((d) => d.held_on === showDate) ?? null} />
      </div>

      <Link href={`${base}/attendance/year`} className="mt-3 flex min-h-16 items-center justify-between rounded-3xl border border-line bg-white px-4">
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-medium">Whole year</span>
          <span className="text-[13px] text-sub tabular-nums">
            Session {session?.name ?? ""} · {yearPct === null ? "nothing yet" : `${Math.round(yearPct)}% so far`}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-[18px] text-sub" strokeWidth={1.75} />
      </Link>
    </>
  );
}

export function AttendanceMonth(ctx: Ctx & { month: string | null }) {
  const days = useDays(ctx);
  const [month, setMonth] = useState((ctx.month && /^\d{4}-\d{2}$/.test(ctx.month) ? ctx.month : monthStart().slice(0, 7)) + "-01");
  const [picked, setPicked] = useState<string | null>(null);
  if (!days) return <p className="mt-6 text-sm text-sub">Loading</p>;

  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(y, m, 0).getDate();
  const inMonth = days.filter((d) => d.held_on.slice(0, 7) === month.slice(0, 7));
  const pct = dayPercent(inMonth);
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    setPicked(null);
  };
  const cell = { present: "bg-ok text-white", partial: "bg-warn text-white", absent: "bg-bad text-white", leave: "bg-mist text-white" } as const;
  const isFuture = month > monthStart();

  return (
    <>
      <div className="mt-5 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="flex size-11 items-center justify-center rounded-full border border-line-strong bg-white">
          <ChevronLeft aria-hidden className="size-[18px]" strokeWidth={1.75} />
        </button>
        <div className="text-center">
          <p className="text-lg font-medium">{first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
          <p className="text-sm tabular-nums" style={{ color: toneColor(pct, 90, 75) }}>
            {pct === null ? "Not marked" : `${Math.round(pct)}% attendance`}
          </p>
        </div>
        <button type="button" onClick={() => shift(1)} disabled={isFuture || month === monthStart()} aria-label="Next month" className="flex size-11 items-center justify-center rounded-full border border-line-strong bg-white disabled:opacity-40">
          <ChevronRight aria-hidden className="size-[18px]" strokeWidth={1.75} />
        </button>
      </div>

      <div className="mt-4 rounded-3xl border border-line bg-white p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-sub">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: lead }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {Array.from({ length: count }, (_, i) => {
            const date = `${month.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`;
            const d = inMonth.find((x) => x.held_on === date);
            return (
              <button
                key={date}
                type="button"
                onClick={() => setPicked(date)}
                aria-label={`${i + 1}: ${d ? d.day_status : "not marked"}`}
                aria-pressed={picked === date}
                className={`flex aspect-square items-center justify-center rounded-full text-sm tabular-nums ${d ? cell[d.day_status] : "text-sub"} ${picked === date ? "ring-2 ring-navy ring-offset-2" : ""}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
      <DayLegend />

      <div className="mt-3 grid grid-cols-3 gap-2">
        {(
          [
            ["present", "Full days"],
            ["partial", "Partly"],
            ["absent", "Absent"],
          ] as const
        ).map(([s, label]) => (
          <div key={s} className="flex flex-col items-center rounded-2xl border border-line bg-white py-2.5">
            <span className="text-xl font-medium tabular-nums">{countDays(inMonth, s)}</span>
            <span className="text-xs text-sub">{label}</span>
          </div>
        ))}
      </div>

      {picked && (
        <>
          <h2 className="mt-6 text-base font-medium">{new Date(picked).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h2>
          <div className="mt-3">
            <DayBreakdown studentId={ctx.child.id} date={picked} day={inMonth.find((d) => d.held_on === picked) ?? null} />
          </div>
        </>
      )}
      {!picked && <p className="mt-4 text-sm text-sub">Tap a day to see each lecture.</p>}
    </>
  );
}

type Earlier = { id: string; name: string; percent: number | null };

export function AttendanceYear(ctx: Ctx) {
  const days = useDays(ctx, true);
  const [earlier, setEarlier] = useState<Earlier[]>([]);
  const all = days ?? [];
  const sessionDays = ctx.session ? all : [];

  useEffect(() => {
    if (!days) return;
    let active = true;
    supabase
      .from("daily_attendance")
      .select("academic_year_id, held_on, day_status, lectures_counted, lectures_attended")
      .eq("student_id", ctx.child.id)
      .then(async ({ data }) => {
        const other = new Map<string, Day[]>();
        for (const r of data ?? []) {
          if (r.academic_year_id === ctx.session?.id) continue;
          other.set(r.academic_year_id, [...(other.get(r.academic_year_id) ?? []), r as Day]);
        }
        if (!other.size) return;
        const { data: years } = await supabase.from("academic_years").select("id, name").in("id", [...other.keys()]);
        if (active) setEarlier((years ?? []).map((y) => ({ id: y.id, name: y.name, percent: dayPercent(other.get(y.id) ?? []) })));
      });
    return () => {
      active = false;
    };
  }, [days, ctx.child.id, ctx.session]);

  if (!days) return <p className="mt-6 text-sm text-sub">Loading</p>;
  const current = ctx.session ? days.filter((d) => d.held_on >= ctx.session!.starts_on && d.held_on <= ctx.session!.ends_on) : sessionDays;
  const pct = dayPercent(current);
  const months = monthsOf(ctx.session);

  return (
    <>
      <section className="mt-5 flex items-center justify-between gap-4 rounded-[28px] bg-navy p-5">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-mist">Session {ctx.session?.name ?? ""}</span>
          <p className="text-[48px] font-medium leading-none tracking-tight text-bg tabular-nums">
            {pct === null ? "–" : Math.round(pct)}
            {pct !== null && <span className="text-[22px] text-mist">%</span>}
          </p>
          <span className="text-sm text-mist tabular-nums">
            {countDays(current, "present")} full · {countDays(current, "partial")} partly · {countDays(current, "absent")} absent
          </span>
        </div>
        <Ring percent={pct} size={84} stroke={9} color="#E3BE6A" track="rgba(241,244,247,0.18)" label={`${Math.round(pct ?? 0)} percent this session`} />
      </section>

      <h2 className="mt-6 text-base font-medium">Month by month</h2>
      <ul className="mt-3 flex flex-col rounded-3xl border border-line bg-white px-4 py-1">
        {months.map((m) => {
          const list = current.filter((d) => d.held_on.slice(0, 7) === m.slice(0, 7));
          const p = dayPercent(list);
          return (
            <li key={m} className="border-b border-line last:border-b-0">
              <Link href={`${ctx.base}/attendance/month?m=${m.slice(0, 7)}`} className="grid h-12 grid-cols-[44px_1fr_44px_16px] items-center gap-3">
                <span className="text-sm">{shortMonth(m)}</span>
                <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-[#E6EBF0]">
                  <span className="block h-1.5 rounded-full" style={{ width: `${Math.round(p ?? 0)}%`, background: toneColor(p, 90, 75) }} />
                </span>
                <span className="text-right text-sm font-medium tabular-nums">{p === null ? "–" : `${Math.round(p)}%`}</span>
                <ChevronRight aria-hidden className="size-4 text-sub" strokeWidth={1.75} />
              </Link>
            </li>
          );
        })}
      </ul>

      {earlier.length > 0 && (
        <>
          <h2 className="mt-6 text-base font-medium">Earlier sessions</h2>
          <ul className="mt-3 flex flex-col rounded-3xl border border-line bg-white px-4 py-1">
            {earlier.map((e) => (
              <li key={e.id} className="flex h-12 items-center justify-between border-b border-line last:border-b-0">
                <span className="text-[15px]">{e.name}</span>
                <span className="text-sm font-medium tabular-nums">{e.percent === null ? "–" : `${Math.round(e.percent)}%`}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
