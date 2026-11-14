"use client";
import { useEffect, useState } from "react";
import { MessageCircle, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { WithId } from "@/components/route";
import { monthLabel, rs } from "@/lib/fees";
import { className, waNumber } from "@/lib/school";

type Line = { amount: number; paid_on: string; method: string | null; fee_records: { month: string; student_id: string; amount_due: number } };
type Info = {
  lines: Line[];
  student: { id: string; full_name: string; father_name: string | null; phone: string | null; roll_no: string | null; classes: { name: string; section: string } | null };
  remaining: number;
};

async function loadReceipt(no: string): Promise<Info | null> {
  const { data: lines } = await supabase
    .from("fee_payments")
    .select("amount, paid_on, method, fee_records(month, student_id, amount_due)")
    .eq("receipt_no", Number(no));
  const first = (lines as unknown as Line[] | null)?.[0];
  if (!first) return null;
  const sid = first.fee_records.student_id;
  const [st, bal] = await Promise.all([
    supabase.from("students").select("id, full_name, father_name, phone, roll_no, classes(name, section)").eq("id", sid).single(),
    supabase.from("student_fee_balance").select("outstanding").eq("student_id", sid).maybeSingle(),
  ]);
  const sorted = [...(lines as unknown as Line[])].sort((a, b) => a.fee_records.month.localeCompare(b.fee_records.month));
  return { lines: sorted, student: st.data as unknown as Info["student"], remaining: Number(bal.data?.outstanding ?? 0) };
}

function Receipt({ no }: { no: string }) {
  const [info, setInfo] = useState<Info | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    loadReceipt(no).then((r) => active && setInfo(r));
    return () => {
      active = false;
    };
  }, [no]);

  if (info === undefined) return <p className="mt-6 text-sm text-sub">Loading invoice</p>;
  if (info === null) return <p className="mt-6 text-sm text-sub">This invoice wasn&apos;t found.</p>;

  const total = info.lines.reduce((a, l) => a + Number(l.amount), 0);
  const date = new Date(info.lines[0].paid_on).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const s = info.student;
  const months = info.lines.map((l) => monthLabel(l.fee_records.month)).join(", ");

  const message = [
    `Rashid Minhas Higher Secondary School Chichawatni`,
    `Fee invoice no ${no}`,
    `Student: ${s.full_name}${s.classes ? ` (${className(s.classes)})` : ""}`,
    `Paid: ${rs(total)} on ${date}`,
    `For: ${months}`,
    info.remaining > 0 ? `Still due: ${rs(info.remaining)}` : `All fees are paid. Thank you.`,
    ``,
    `فیس وصول ہو گئی۔ شکریہ`,
  ].join("\n");

  return (
    <>
      <article className="mt-5 rounded-[28px] border border-line bg-white p-6 print:mt-0 print:rounded-none print:border-0">
        <header className="flex items-center gap-4 border-b border-line pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rmc-crest.png" alt="" width={48} height={64} className="h-16 w-12 object-contain" />
          <div>
            <p className="text-[15px] font-medium leading-snug">Rashid Minhas Higher Secondary School Chichawatni</p>
            <p className="text-sm text-sub">Fee invoice</p>
          </div>
        </header>

        <dl className="mt-4 grid grid-cols-2 gap-y-2.5 text-sm">
          <dt className="text-sub">Invoice no</dt>
          <dd className="tabular-nums">{no}</dd>
          <dt className="text-sub">Date</dt>
          <dd>{date}</dd>
          <dt className="text-sub">Student</dt>
          <dd>{s.full_name}</dd>
          {s.father_name && (
            <>
              <dt className="text-sub">Father</dt>
              <dd>{s.father_name}</dd>
            </>
          )}
          <dt className="text-sub">Class</dt>
          <dd>
            {className(s.classes)}
            {s.roll_no ? ` · Roll ${s.roll_no}` : ""}
          </dd>
          <dt className="text-sub">Paid by</dt>
          <dd className="capitalize">{info.lines[0].method ?? "Cash"}</dd>
        </dl>

        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-sub">
              <th className="py-2 font-normal">Month</th>
              <th className="py-2 text-right font-normal">Paid</th>
            </tr>
          </thead>
          <tbody>
            {info.lines.map((l) => (
              <tr key={l.fee_records.month} className="border-b border-line">
                <td className="py-2">{monthLabel(l.fee_records.month)}</td>
                <td className="py-2 text-right tabular-nums">{rs(Number(l.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-sm text-sub">Total paid</span>
          <span className="text-2xl font-medium tabular-nums">{rs(total)}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-sm text-sub">Still due</span>
          <span className={`text-[15px] font-medium tabular-nums ${info.remaining > 0 ? "text-warn" : "text-ok"}`}>{info.remaining > 0 ? rs(info.remaining) : "Nothing"}</span>
        </div>
      </article>

      <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className="flex h-14 items-center justify-center gap-2 rounded-full border border-line-strong bg-white text-[15px] font-medium hover:bg-bg">
          <Printer aria-hidden className="size-[18px]" strokeWidth={1.75} />
          Print
        </button>
        {s.phone ? (
          <a
            href={`https://wa.me/${waNumber(s.phone)}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-14 items-center justify-center gap-2 rounded-full bg-ok text-[15px] font-medium text-white hover:brightness-95"
          >
            <MessageCircle aria-hidden className="size-[18px]" strokeWidth={1.75} />
            WhatsApp
          </a>
        ) : (
          <span className="flex h-14 items-center justify-center rounded-full bg-bg px-3 text-center text-sm text-sub">Add a phone to send on WhatsApp</span>
        )}
      </div>
    </>
  );
}

export default function ReceiptPage() {
  return (
    <Portal role="admin" title="Invoice" back="/admin/fees">
      {() => <WithId render={(id) => <Receipt no={id} />} />}
    </Portal>
  );
}
