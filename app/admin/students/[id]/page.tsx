"use client";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { ErrorNote, PrimaryButton } from "@/components/ui";
import { FeeForm } from "@/components/fee-form";
import {
  draftFromPlan,
  emptyDraft,
  monthLabel,
  monthStart,
  readDraft,
  residenceLabel,
  rs,
  type FeeDraft,
  type FeePlan,
  type HostelRate,
} from "@/lib/fees";

type Student = {
  id: string;
  full_name: string;
  father_name: string | null;
  roll_no: string | null;
  admission_date: string;
  class_id: string | null;
};

function Breakdown({ plan }: { plan: FeePlan }) {
  const parts = [
    { label: "Tuition", value: plan.tuition_fee },
    { label: "Hostel rent", value: plan.hostel_rent },
    { label: "Mess", value: plan.mess_fee },
    { label: plan.other_note || "Other", value: plan.other_fee },
  ].filter((p) => Number(p.value) > 0);
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {parts.map((p) => (
        <li key={p.label} className="flex justify-between text-sm">
          <span className="text-mist">{p.label}</span>
          <span className="tabular-nums">{rs(Number(p.value))}</span>
        </li>
      ))}
    </ul>
  );
}

function Profile({ id }: { id: string }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [className, setClassName] = useState("");
  const [plans, setPlans] = useState<FeePlan[]>([]);
  const [rates, setRates] = useState<HostelRate[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FeeDraft>(emptyDraft);
  const [from, setFrom] = useState(monthStart().slice(0, 7));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const [s, p, r] = await Promise.all([
        supabase
          .from("students")
          .select(
            "id, full_name, father_name, roll_no, admission_date, class_id",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("student_fee_plans")
          .select("*")
          .eq("student_id", id)
          .order("effective_from", { ascending: false }),
        supabase
          .from("hostel_rates")
          .select("residence, monthly_rent, mess_fee"),
      ]);
      const c = s.data?.class_id
        ? await supabase
            .from("classes")
            .select("name, section")
            .eq("id", s.data.class_id)
            .maybeSingle()
        : null;
      if (!active) return;
      setStudent(s.data as Student | null);
      setPlans((p.data ?? []) as FeePlan[]);
      setRates((r.data ?? []) as HostelRate[]);
      if (c?.data)
        setClassName(
          `${c.data.name}${c.data.section ? `-${c.data.section}` : ""}`,
        );
    })();
    return () => {
      active = false;
    };
  }, [id, version]);

  const thisMonth = monthStart();
  const current = plans.find((p) => p.effective_from <= thisMonth);
  const upcoming = plans.filter((p) => p.effective_from > thisMonth);

  function startEdit() {
    setDraft(current ? draftFromPlan(current) : emptyDraft);
    setFrom(monthStart(current ? 1 : 0).slice(0, 7));
    setError("");
    setEditing(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    const checked = readDraft(draft);
    if ("error" in checked) return setError(checked.error);
    if (!/^\d{4}-\d{2}$/.test(from))
      return setError("Choose the month the change starts from.");
    setBusy(true);
    const { error } = await supabase
      .from("student_fee_plans")
      .upsert(
        { ...checked.values, student_id: id, effective_from: `${from}-01` },
        { onConflict: "student_id,effective_from" },
      );
    setBusy(false);
    if (error) return setError("The change wasn't saved. Try again.");
    setEditing(false);
    setVersion((v) => v + 1);
  }

  if (!student) return <p className="mt-6 text-sm text-sub">Loading student</p>;

  return (
    <>
      <section className="mt-5 rounded-[28px] border border-line bg-white p-5">
        <h2 className="text-xl font-medium tracking-tight">
          {student.full_name}
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-sub">Father</dt>
          <dd>{student.father_name || "Not added"}</dd>
          <dt className="text-sub">Class</dt>
          <dd>{className || "Not set"}</dd>
          <dt className="text-sub">Roll no</dt>
          <dd>{student.roll_no || "Not added"}</dd>
          <dt className="text-sub">Admitted</dt>
          <dd>
            {new Date(student.admission_date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </dd>
        </dl>
      </section>

      <section className="mt-4 rounded-[28px] bg-navy p-5 text-white">
        <p className="text-sm text-mist">
          Monthly fee{current ? ` · ${residenceLabel(current.residence)}` : ""}
        </p>
        <p className="mt-1 text-[34px] font-medium leading-none tracking-tight tabular-nums">
          {current ? rs(Number(current.monthly_total)) : "Not set"}
        </p>
        {current && <Breakdown plan={current} />}
        {upcoming.map((u) => (
          <p
            key={u.id}
            className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm"
          >
            From {monthLabel(u.effective_from)}: {residenceLabel(u.residence)},{" "}
            {rs(Number(u.monthly_total))}
          </p>
        ))}
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-gold text-[15px] font-medium text-ink hover:brightness-95"
          >
            {current ? "Change fee or hostel" : "Set fee"}
          </button>
        )}
      </section>

      {editing && (
        <form
          onSubmit={save}
          noValidate
          className="mt-4 flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5"
        >
          <h2 className="text-base font-medium">
            {current ? "Change fee or hostel" : "Set fee"}
          </h2>
          <FeeForm draft={draft} onChange={setDraft} rates={rates} />
          <div className="flex flex-col gap-2">
            <label htmlFor="from" className="text-sm text-sub">
              Starts from
            </label>
            <input
              id="from"
              type="month"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-[52px] rounded-2xl border border-line-strong bg-bg px-4 text-base text-ink"
            />
            <p className="text-sm text-sub">
              Months before this keep their old fee.
            </p>
          </div>
          <ErrorNote>{error}</ErrorNote>
          <PrimaryButton type="submit" busy={busy}>
            Save change
          </PrimaryButton>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-11 text-[15px] text-sub hover:text-ink"
          >
            Cancel
          </button>
        </form>
      )}

      {plans.length > 1 && (
        <>
          <h2 className="mt-6 text-base font-medium">Fee history</h2>
          <ul className="mt-3 rounded-3xl border border-line bg-white px-4 py-1">
            {plans.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between border-b border-line py-3 last:border-b-0"
              >
                <span className="flex flex-col">
                  <span className="text-[15px]">
                    From {monthLabel(p.effective_from)}
                  </span>
                  <span className="text-sm text-sub">
                    {residenceLabel(p.residence)}
                  </span>
                </span>
                <span className="text-sm tabular-nums">
                  {rs(Number(p.monthly_total))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function FromAddress() {
  const { id } = useParams<{ id: string }>();
  return <Profile id={id} />;
}

export default function Page() {
  return (
    <Portal role="admin" title="Student" back="/admin/students">
      {() => (
        <Suspense>
          <FromAddress />
        </Suspense>
      )}
    </Portal>
  );
}
