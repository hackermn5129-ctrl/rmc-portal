"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Portal } from "@/components/portal";
import { WithId } from "@/components/route";
import { isAlert, isPending, loadFeeOverview, type FeeOverview } from "@/lib/fee-data";
import { monthLabel, rs } from "@/lib/fees";
import { className } from "@/lib/school";

function ClassFees({ id }: { id: string }) {
  const [data, setData] = useState<FeeOverview | null>(null);

  useEffect(() => {
    let active = true;
    loadFeeOverview().then((d) => active && setData(d));
    return () => {
      active = false;
    };
  }, []);

  if (!data) return <p className="mt-6 text-sm text-sub">Loading</p>;
  const cls = data.classes.find((c) => c.id === id);
  const inClass = data.students.filter((s) => s.class_id === id);
  const pending = inClass
    .filter((s) => isPending(data.balances.get(s.id)))
    .sort((a, b) => (data.balances.get(b.id)?.unpaid_months ?? 0) - (data.balances.get(a.id)?.unpaid_months ?? 0));
  const paid = inClass.filter((s) => !isPending(data.balances.get(s.id)));

  return (
    <>
      <h2 className="mt-5 text-xl font-medium tracking-tight">{className(cls)}</h2>
      <p className="mt-1 text-sm text-sub">
        {pending.length} pending · {paid.length} paid
      </p>

      <h3 className="mt-5 text-base font-medium">Pending</h3>
      <ul className="mt-3 rounded-3xl border border-line bg-white px-4 py-1">
        {pending.length === 0 && <li className="py-4 text-sm text-ok">Everyone in this class has paid.</li>}
        {pending.map((s) => {
          const b = data.balances.get(s.id)!;
          const alert = isAlert(b);
          return (
            <li key={s.id} className="border-b border-line last:border-b-0">
              <div className="flex items-center justify-between gap-3 py-3">
                <Link href={`/admin/students/${s.id}`} className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 truncate text-[15px]">
                    {alert && <span className="size-2 shrink-0 rounded-full bg-bad" aria-label="High alert" />}
                    {s.full_name}
                  </span>
                  <span className={`text-sm ${alert ? "text-bad" : "text-sub"}`}>
                    {b.unpaid_months} {b.unpaid_months === 1 ? "month" : "months"}
                    {b.oldest_unpaid ? ` · since ${monthLabel(b.oldest_unpaid)}` : ""}
                  </span>
                </Link>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[15px] font-medium tabular-nums">{rs(b.outstanding)}</span>
                  <Link href={`/admin/fees/pay?student=${s.id}`} className="rounded-full bg-gold px-3 py-1 text-sm text-ink">
                    Add payment
                  </Link>
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-6 text-base font-medium">Paid</h3>
      <ul className="mt-3 rounded-3xl border border-line bg-white px-4 py-1">
        {paid.length === 0 && <li className="py-4 text-sm text-sub">No one is fully paid yet.</li>}
        {paid.map((s) => (
          <li key={s.id} className="border-b border-line last:border-b-0">
            <Link href={`/admin/students/${s.id}`} className="flex h-14 items-center justify-between">
              <span className="text-[15px]">{s.full_name}</span>
              <span className="text-sm text-ok">{data.balances.get(s.id) ? "Paid" : "No fee yet"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function Page() {
  return (
    <Portal role="admin" title="Fees" back="/admin/fees">
      {() => <WithId render={(id) => <ClassFees id={id} />} />}
    </Portal>
  );
}
