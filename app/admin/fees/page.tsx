"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { Portal } from "@/components/portal";
import { LinkButton } from "@/components/ui";
import { isAlert, isPending, loadFeeOverview, type FeeOverview } from "@/lib/fee-data";
import { monthLabel, monthStart, rs } from "@/lib/fees";
import { className } from "@/lib/school";

function Fees() {
  const [data, setData] = useState<FeeOverview | null>(null);

  useEffect(() => {
    let active = true;
    loadFeeOverview().then((d) => active && setData(d));
    return () => {
      active = false;
    };
  }, []);

  if (!data) return <p className="mt-6 text-sm text-sub">Loading fees</p>;

  if (data.noSession)
    return (
      <div className="mt-5 rounded-[28px] border border-line bg-white p-5">
        <h2 className="text-base font-medium">Set the academic session first</h2>
        <p className="mt-1 text-sm leading-relaxed text-sub">Monthly fees are saved under a session, like 2026-27.</p>
        <div className="mt-4">
          <LinkButton href="/admin/settings">Open school setup</LinkButton>
        </div>
      </div>
    );

  const { students, balances, classes, month } = data;
  const pending = students.filter((s) => isPending(balances.get(s.id)));
  const alerts = students.filter((s) => isAlert(balances.get(s.id)));
  const remaining = pending.reduce((a, s) => a + (balances.get(s.id)?.outstanding ?? 0), 0);
  const percent = month.due > 0 ? Math.round((month.paid / month.due) * 100) : 0;
  const classById = new Map(classes.map((c) => [c.id, c]));

  return (
    <>
      <div className="mt-5">
        <LinkButton href="/admin/fees/pay" icon="plus">
          Add payment
        </LinkButton>
      </div>

      <section className="mt-4 rounded-[28px] bg-navy p-5 text-white">
        <p className="text-sm text-mist">Collected in {monthLabel(monthStart())}</p>
        <p className="mt-1 text-[44px] font-medium leading-none tracking-tight tabular-nums">{percent}%</p>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/15" role="img" aria-label={`${percent}% collected`}>
          <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(percent, 100)}%` }} />
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs text-mist">Collected</dt>
            <dd className="mt-1 text-[15px] font-medium tabular-nums">{rs(month.paid)}</dd>
          </div>
          <div>
            <dt className="text-xs text-mist">Remaining</dt>
            <dd className="mt-1 text-[15px] font-medium tabular-nums">{rs(remaining)}</dd>
          </div>
          <div>
            <dt className="text-xs text-mist">Not paid</dt>
            <dd className="mt-1 text-[15px] font-medium tabular-nums">
              {pending.length} {pending.length === 1 ? "student" : "students"}
            </dd>
          </div>
        </dl>
      </section>

      {alerts.length > 0 && (
        <section className="mt-4 rounded-[28px] bg-bad-soft p-5">
          <h2 className="flex items-center gap-2 text-base font-medium text-bad-ink">
            <TriangleAlert aria-hidden className="size-[18px]" strokeWidth={1.75} />
            High alert: {alerts.length} unpaid for 2 months or more
          </h2>
          <ul className="mt-3 flex flex-col">
            {alerts.map((s) => {
              const b = balances.get(s.id)!;
              return (
                <li key={s.id} className="border-b border-bad/15 last:border-b-0">
                  <Link href={`/admin/students/${s.id}`} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[15px] text-ink">{s.full_name}</span>
                      <span className="text-sm text-bad-ink">
                        {className(classById.get(s.class_id ?? ""))} · {b.unpaid_months} months
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-bad-ink">{rs(b.outstanding)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <h2 className="mt-6 text-base font-medium">By class</h2>
      <ul className="mt-3 rounded-3xl border border-line bg-white px-4 py-1">
        {classes.map((c) => {
          const inClass = students.filter((s) => s.class_id === c.id);
          const p = inClass.filter((s) => isPending(balances.get(s.id))).length;
          const a = inClass.filter((s) => isAlert(balances.get(s.id))).length;
          return (
            <li key={c.id} className="border-b border-line last:border-b-0">
              <Link href={`/admin/fees/class/${c.id}`} className="flex h-14 items-center justify-between">
                <span className="text-[15px]">{className(c)}</span>
                <span className="flex items-center gap-2 text-sm tabular-nums">
                  {a > 0 && <span className="size-2 rounded-full bg-bad" aria-label={`${a} on high alert`} />}
                  <span className={p > 0 ? "text-warn" : "text-ok"}>{p > 0 ? `${p} pending` : inClass.length ? "All paid" : "No students"}</span>
                  <ChevronRight aria-hidden className="size-[18px] text-sub" strokeWidth={1.75} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function FeesPage() {
  return (
    <Portal role="admin" title="Fees" back="/admin">
      {() => <Fees />}
    </Portal>
  );
}
