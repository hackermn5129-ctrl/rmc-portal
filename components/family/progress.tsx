"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { monthStart } from "@/lib/fees";
import { KIND_LABEL, type TestKind } from "@/lib/school";
import { inMonth, loadTestResults, monthsOf, scoreOf, shortMonth, type TestResult } from "@/lib/family";
import { Change, LineChart, Ring, Sparkline, toneColor } from "./visuals";
import type { Ctx } from "./shell";

function useTests(ctx: Ctx) {
  const [tests, setTests] = useState<TestResult[] | null>(null);
  useEffect(() => {
    let active = true;
    loadTestResults(ctx.child, ctx.session?.id).then((t) => active && setTests(t));
    return () => {
      active = false;
    };
  }, [ctx.child, ctx.session]);
  return tests;
}

const prevMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return `${mo === 1 ? y - 1 : y}-${String(mo === 1 ? 12 : mo - 1).padStart(2, "0")}-01`;
};
const monthName = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-GB", { month: "long" });
};

export function Progress(ctx: Ctx) {
  const tests = useTests(ctx);
  const [view, setView] = useState<"month" | "test">("month");
  if (!tests) return <p className="mt-6 text-sm text-sub">Loading</p>;

  const sat = tests.filter((t) => t.marks !== null);
  if (!sat.length)
    return (
      <div className="mt-5 rounded-[28px] bg-navy p-5 text-white">
        <h2 className="text-xl font-medium">No marks yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-mist">Daily, weekly and monthly test marks show here as soon as teachers enter them.</p>
      </div>
    );

  // Use this month if there are marks, otherwise the latest month with marks.
  const latestMonth = sat[sat.length - 1].held_on.slice(0, 7) + "-01";
  const focus = inMonth(sat, monthStart()).length ? monthStart() : latestMonth;
  const focusScore = scoreOf(inMonth(tests, focus));
  const prevScore = scoreOf(inMonth(tests, prevMonth(focus)));
  const overall = scoreOf(tests);

  const monthPoints = monthsOf(ctx.session)
    .map((m) => ({ label: shortMonth(m), value: scoreOf(inMonth(tests, m)) }))
    .filter((p) => p.value !== null) as { label: string; value: number }[];
  const testPoints = sat.slice(-12).map((t) => ({ label: new Date(t.held_on).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), value: t.percent! }));
  const points = view === "month" ? monthPoints : testPoints;
  const trend = points.length >= 2 ? points[points.length - 1].value - points[0].value : null;

  const subjectNames = [...new Set(sat.map((t) => t.subject))];
  const subjects = subjectNames
    .map((name) => {
      const list = tests.filter((t) => t.subject === name);
      const thisM = scoreOf(inMonth(list, focus));
      const lastM = scoreOf(inMonth(list, prevMonth(focus)));
      return {
        name,
        id: list[0].subject_id,
        score: thisM ?? scoreOf(list),
        change: thisM !== null && lastM !== null ? thisM - lastM : null,
        spark: list.filter((t) => t.percent !== null).slice(-5).map((t) => t.percent!),
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <>
      <section className="mt-5 flex items-center justify-between gap-4 rounded-[28px] bg-navy p-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-mist">{monthName(focus)} overall</span>
          <p className="text-[48px] font-medium leading-none tracking-tight text-bg tabular-nums">
            {focusScore === null ? "–" : Math.round(focusScore)}
            <span className="text-[22px] text-mist">%</span>
          </p>
          {focusScore !== null && prevScore !== null && Math.round(focusScore - prevScore) !== 0 && (
            <span className={`text-sm font-medium tabular-nums ${focusScore >= prevScore ? "text-[#BFE5D2]" : "text-[#F2C4BF]"}`}>
              {focusScore >= prevScore ? "↑" : "↓"} {Math.abs(Math.round(focusScore - prevScore))}% vs {monthName(prevMonth(focus))}
            </span>
          )}
          <span className="text-[13px] text-mist tabular-nums">Whole session {overall === null ? "–" : `${Math.round(overall)}%`}</span>
        </div>
        <Ring percent={focusScore} size={84} stroke={9} color="#E3BE6A" track="rgba(241,244,247,0.18)" label={`Overall ${Math.round(focusScore ?? 0)} percent in ${monthName(focus)}`} />
      </section>

      <div role="group" aria-label="Graph range" className="mt-3 grid grid-cols-2 gap-1 rounded-3xl border border-line bg-white p-1">
        {(
          [
            ["month", "Month by month"],
            ["test", "Test by test"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`h-10 rounded-[20px] text-sm ${view === v ? "bg-navy font-medium text-white" : "text-sub"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2.5 rounded-3xl border border-line bg-white p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-medium">Overall score</span>
          <Change value={trend} suffix={view === "month" ? `since ${points[0]?.label ?? ""}` : `in ${points.length} tests`} />
        </div>
        <LineChart
          label={`Overall score ${view === "month" ? "month by month" : "test by test"}: ${points.map((p) => `${p.label} ${Math.round(p.value)} percent`).join(", ")}`}
          points={points}
          color={trend !== null && trend < 0 ? "#B4443C" : "#2E7D5B"}
        />
      </div>

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-base font-medium">Subjects in {monthName(focus)}</h2>
        <span className="text-[13px] text-sub">Tap for every test</span>
      </div>
      <div className="mt-3 flex flex-col rounded-3xl border border-line bg-white px-4 py-1">
        {subjects.map((s) => {
          const color = s.change !== null && s.change < 0 ? "#B4443C" : "#2E7D5B";
          return (
            <Link key={s.id} href={`${ctx.base}/progress/${s.id}`} className="grid min-h-16 grid-cols-[1fr_56px_52px_16px] items-center gap-2.5 border-b border-line last:border-b-0">
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px]">{s.name}</span>
                {s.change !== null && Math.round(s.change) !== 0 ? <Change value={s.change} suffix={`vs ${shortMonth(prevMonth(focus))}`} /> : <span className="text-[13px] text-sub">{s.spark.length} tests</span>}
              </span>
              <Sparkline values={s.spark} color={color} />
              <span className="text-right text-[17px] font-medium tabular-nums" style={{ color: s.score !== null && s.score < 50 ? "#B4443C" : undefined }}>
                {s.score === null ? "–" : `${Math.round(s.score)}%`}
              </span>
              <ChevronRight aria-hidden className="size-4 text-sub" strokeWidth={1.75} />
            </Link>
          );
        })}
      </div>
    </>
  );
}

export function SubjectProgress(ctx: Ctx & { subjectId: string }) {
  const tests = useTests(ctx);
  if (!tests) return <p className="mt-6 text-sm text-sub">Loading</p>;
  const list = tests.filter((t) => t.subject_id === ctx.subjectId);
  const name = list[0]?.subject ?? "Subject";
  const score = scoreOf(list);
  const sat = list.filter((t) => t.percent !== null);
  const kinds: TestKind[] = ["monthly", "weekly", "daily"];

  return (
    <>
      <section className="mt-5 flex items-center justify-between gap-4 rounded-[28px] bg-navy p-5">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-mist">{name} this session</span>
          <p className="text-[48px] font-medium leading-none tracking-tight text-bg tabular-nums">
            {score === null ? "–" : Math.round(score)}
            <span className="text-[22px] text-mist">%</span>
          </p>
          <span className="text-sm text-mist tabular-nums">
            {sat.length} of {list.length} tests taken
          </span>
        </div>
        <Ring percent={score} size={84} stroke={9} color="#E3BE6A" track="rgba(241,244,247,0.18)" label={`${name} ${Math.round(score ?? 0)} percent`} />
      </section>

      {sat.length > 1 && (
        <div className="mt-3 rounded-3xl border border-line bg-white p-4">
          <LineChart
            label={`${name} marks test by test`}
            points={sat.slice(-12).map((t) => ({ label: new Date(t.held_on).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), value: t.percent! }))}
          />
        </div>
      )}

      {kinds.map((k) => {
        const group = list.filter((t) => t.kind === k).reverse();
        if (!group.length) return null;
        const gs = scoreOf(group);
        return (
          <section key={k} className="mt-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-medium">{KIND_LABEL[k]}</h2>
              <span className="text-[13px] font-medium tabular-nums" style={{ color: toneColor(gs) }}>
                {gs === null ? "" : `${Math.round(gs)}% average`}
              </span>
            </div>
            <ul className="mt-3 flex flex-col rounded-3xl border border-line bg-white px-4 py-1">
              {group.map((t) => (
                <li key={t.id} className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px]">{t.title || name}</span>
                    <span className="text-[13px] text-sub">{new Date(t.held_on).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
                  </span>
                  {t.marks === null ? (
                    <span className="text-sm text-sub">Absent</span>
                  ) : (
                    <span className="flex flex-col items-end">
                      <span className="text-[15px] font-medium tabular-nums">
                        {t.marks}/{t.total_marks}
                      </span>
                      <span className="text-xs font-medium tabular-nums" style={{ color: toneColor(t.percent) }}>
                        {Math.round(t.percent!)}%
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
