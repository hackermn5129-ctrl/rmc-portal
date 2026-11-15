"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Megaphone, TriangleAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { monthLabel, residenceLabel, rs, type FeePlan } from "@/lib/fees";
import { loadFees, loadNotices, useChild, type Notice } from "@/lib/family";
import { SignOutButton } from "@/components/portal";
import type { Profile } from "@/lib/supabase";
import { Urdu } from "./visuals";
import type { Ctx } from "./shell";
import { classOf } from "./shell";

const STATUS = {
  paid: { label: "Paid", cls: "bg-[#E7F2EC] text-[#17402E]" },
  part_paid: { label: "Part paid", cls: "bg-[#FBF1E1] text-[#5C3D0F]" },
  pending: { label: "Not paid", cls: "bg-bad-soft text-bad-ink" },
} as const;

export function Fees(ctx: Ctx) {
  const [data, setData] = useState<(Awaited<ReturnType<typeof loadFees>> & { plan: FeePlan | null }) | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([loadFees(ctx.child.id), supabase.from("student_current_fee").select("*").eq("student_id", ctx.child.id).maybeSingle()]).then(([f, p]) => {
      if (active) setData({ ...f, plan: (p.data as FeePlan | null) ?? null });
    });
    return () => {
      active = false;
    };
  }, [ctx.child.id]);

  if (!data) return <p className="mt-6 text-sm text-sub">Loading</p>;
  const owing = data.owed > 0;

  return (
    <>
      <section className={`mt-5 flex items-center gap-4 rounded-[28px] px-5 py-6 ${owing ? "bg-bad-soft" : "bg-[#E7F2EC]"}`}>
        <span className={`flex size-[60px] shrink-0 items-center justify-center rounded-full ${owing ? "bg-bad" : "bg-ok"}`}>
          {owing ? <TriangleAlert aria-hidden className="size-[28px] text-white" strokeWidth={2.25} /> : <Check aria-hidden className="size-[30px] text-white" strokeWidth={2.75} />}
        </span>
        <div className="flex flex-col">
          <span className={`text-sm ${owing ? "text-bad-ink" : "text-[#17402E]"}`}>{owing ? `Due for ${data.unpaidMonths} ${data.unpaidMonths === 1 ? "month" : "months"}` : "Fee"}</span>
          <h2 className={`text-[28px] font-medium leading-tight tracking-tight tabular-nums ${owing ? "text-bad-ink" : "text-[#17402E]"}`}>{owing ? rs(data.owed) : data.billed ? "All paid" : "Nothing due"}</h2>
          <Urdu className={owing ? "text-bad-ink" : "text-[#17402E]"}>{owing ? "فیس باقی ہے، سکول دفتر میں جمع کروائیں" : "فیس ادا ہو چکی ہے"}</Urdu>
        </div>
      </section>

      {data.plan && (
        <section className="mt-3 rounded-3xl border border-line bg-white p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-medium">Monthly fee</span>
            <span className="text-lg font-medium tabular-nums">{rs(Number(data.plan.monthly_total))}</span>
          </div>
          <p className="mt-1 text-sm text-sub">
            {residenceLabel(data.plan.residence)}
            {Number(data.plan.hostel_rent) > 0 ? ` · rent ${rs(Number(data.plan.hostel_rent))}` : ""}
            {Number(data.plan.mess_fee) > 0 ? ` · mess ${rs(Number(data.plan.mess_fee))}` : ""}
          </p>
        </section>
      )}

      {data.months.length > 0 && (
        <>
          <h2 className="mt-6 text-base font-medium">Month by month</h2>
          <ul className="mt-3 flex flex-col rounded-3xl border border-line bg-white px-4 py-1">
            {data.months.map((m) => (
              <li key={m.fee_record_id} className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
                <span className="flex flex-col">
                  <span className="text-[15px]">{monthLabel(m.month)}</span>
                  <span className="text-[13px] text-sub tabular-nums">
                    {rs(m.amount_due)}
                    {m.status === "part_paid" ? ` · ${rs(m.amount_due - m.amount_paid)} left` : ""}
                  </span>
                </span>
                <span className={`rounded-full px-3 py-1 text-sm ${STATUS[m.status].cls}`}>{STATUS[m.status].label}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {data.payments.length > 0 && (
        <>
          <h2 className="mt-6 text-base font-medium">Payments</h2>
          <ul className="mt-3 flex flex-col rounded-3xl border border-line bg-white px-4 py-1">
            {data.payments.map((p) => (
              <li key={p.receipt_no} className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
                <span className="flex flex-col">
                  <span className="text-[15px]">{new Date(p.paid_on).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
                  <span className="text-[13px] text-sub tabular-nums">
                    Invoice {p.receipt_no}
                    {p.voucher_no ? ` · voucher ${p.voucher_no}` : ""}
                  </span>
                </span>
                <span className="text-[15px] font-medium text-ok tabular-nums">{rs(p.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {!data.billed && <p className="mt-4 text-sm text-sub">The school has not added fees for {classOf(ctx.child) || "this class"} yet.</p>}
    </>
  );
}

// Children, notices and sign out (the initials button).
export function More({ profile }: { profile: Profile }) {
  const { children, child, choose } = useChild(profile);
  const [notices, setNotices] = useState<Notice[] | null>(null);

  useEffect(() => {
    let active = true;
    loadNotices(30).then((n) => active && setNotices(n));
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      {children && children.length > 0 && (
        <>
          <h2 className="mt-5 text-base font-medium">{profile.role === "parent" ? "My children" : "Me"}</h2>
          <ul className="mt-3 flex flex-col rounded-3xl border border-line bg-white px-4 py-1">
            {children.map((c) => (
              <li key={c.id} className="border-b border-line last:border-b-0">
                <button type="button" onClick={() => choose(c.id)} className="flex min-h-16 w-full items-center justify-between gap-3 text-left">
                  <span className="flex flex-col">
                    <span className="text-[15px]">{c.full_name}</span>
                    <span className="text-[13px] text-sub">
                      {classOf(c)}
                      {c.reg_no ? ` · Reg ${c.reg_no}` : ""}
                    </span>
                  </span>
                  {child?.id === c.id && <span className="rounded-full bg-navy px-3 py-1 text-sm text-white">Showing</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <ul className="mt-6 flex flex-col rounded-3xl border border-line bg-white px-4 py-1">
        {(profile.role === "student"
          ? [
              { href: "/student/attendance", label: "Attendance" },
              { href: "/student/fees", label: "Fees" },
            ]
          : [{ href: "/parent/tests", label: "Online MCQ tests" }]
        ).map((l) => (
          <li key={l.href} className="border-b border-line last:border-b-0">
            <Link href={l.href} className="flex min-h-14 items-center justify-between text-[15px]">
              {l.label}
              <ChevronRight aria-hidden className="size-[18px] text-sub" strokeWidth={1.75} />
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 text-base font-medium">Notices</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {notices?.length === 0 && <li className="rounded-3xl border border-line bg-white p-4 text-sm text-sub">No notices from the school.</li>}
        {notices?.map((n) => (
          <li key={n.id} className="flex items-start gap-3 rounded-3xl border border-line bg-white p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bg">
              <Megaphone aria-hidden className="size-[18px] text-navy" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-medium">{n.title}</span>
              {n.body && <span className="mt-0.5 block whitespace-pre-line text-sm text-sub">{n.body}</span>}
              <span className="mt-1 block text-xs text-sub">{new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-sm text-sub">Forgot your password? Ask the school office to reset it.</p>
      <div className="mt-3">
        <SignOutButton />
      </div>
    </>
  );
}
