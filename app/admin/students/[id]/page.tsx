"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { Portal } from "@/components/portal";
import { WithId } from "@/components/route";
import { ErrorNote, Field, PrimaryButton, SelectField } from "@/components/ui";
import { FeeForm } from "@/components/fee-form";
import { draftFromPlan, emptyDraft, emptyRates, monthLabel, monthStart, readDraft, residenceLabel, rs, tuitionFor, type FeeDraft, type FeePlan, type FeeRates, type HostelRate } from "@/lib/fees";
import { loadFeeRates } from "@/lib/fee-data";
import { KIND_LABEL, className, loadClasses, pct, toneFor, type ClassRow, type TestKind } from "@/lib/school";
import { loadResults, studentPercent, subjectPercent, subjectsWithTests, type ResultsData } from "@/lib/results";
import type { Balance } from "@/lib/fee-data";
import { AttendanceSummary, Logins } from "@/components/student-extras";

type Student = {
  id: string;
  full_name: string;
  father_name: string | null;
  roll_no: string | null;
  reg_no: string | null;
  phone: string | null;
  admission_date: string;
  class_id: string | null;
  status: "active" | "left";
  profile_id: string | null;
};
type Receipt = { receipt_no: number; paid_on: string; amount: number };

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-[28px] border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Breakdown({ plan }: { plan: FeePlan }) {
  const parts = [
    { label: "Academic fee", value: plan.tuition_fee },
    { label: "Hostel", value: plan.hostel_rent },
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

function Details({ student, classes, onSaved }: { student: Student; classes: ClassRow[]; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(student);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cls = classes.find((c) => c.id === student.class_id);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!f.full_name.trim()) return setError("Enter the student's name.");
    if (f.phone?.trim() && !isValidPhone(f.phone)) return setError("The phone number should be 11 digits, like 0300 1234567.");
    setBusy(true);
    const { error } = await supabase
      .from("students")
      .update({
        full_name: f.full_name.trim(),
        father_name: f.father_name?.trim() || null,
        roll_no: f.roll_no?.trim() || null,
        reg_no: f.reg_no?.trim() || null,
        phone: f.phone?.trim() ? normalizePhone(f.phone) : null,
        class_id: f.class_id || null,
        status: f.status,
        left_date: f.status === "left" ? new Date().toLocaleDateString("en-CA") : null,
      })
      .eq("id", student.id);
    setBusy(false);
    if (error) return setError("The changes weren't saved. Try again.");
    setEditing(false);
    onSaved();
  }

  if (!editing)
    return (
      <section className="mt-5 rounded-[28px] border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-medium tracking-tight">{student.full_name}</h2>
          <button
            type="button"
            onClick={() => {
              setF(student);
              setEditing(true);
            }}
            className="rounded-full border border-line-strong px-3 py-1 text-sm hover:bg-bg"
          >
            Edit
          </button>
        </div>
        {student.status === "left" && <p className="mt-2 inline-block rounded-full bg-bad-soft px-3 py-1 text-sm text-bad-ink">Has left the school</p>}
        <dl className="mt-3 grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-sub">Father</dt>
          <dd>{student.father_name || "Not added"}</dd>
          <dt className="text-sub">Class</dt>
          <dd>{className(cls) || "Not set"}</dd>
          <dt className="text-sub">Registration no</dt>
          <dd className="tabular-nums">{student.reg_no || "Not added"}</dd>
          <dt className="text-sub">Roll no</dt>
          <dd>{student.roll_no || "Not added"}</dd>
          <dt className="text-sub">Parent&apos;s phone</dt>
          <dd className="tabular-nums">{student.phone || "Not added"}</dd>
          <dt className="text-sub">Admitted</dt>
          <dd>{new Date(student.admission_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd>
        </dl>
      </section>
    );

  return (
    <form onSubmit={save} noValidate className="mt-5 flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5">
      <h2 className="text-base font-medium">Edit details</h2>
      <Field label="Full name" id="e_name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
      <Field label="Father's name" id="e_father" value={f.father_name ?? ""} onChange={(e) => setF({ ...f, father_name: e.target.value })} />
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <SelectField label="Class" id="e_class" value={f.class_id ?? ""} onChange={(e) => setF({ ...f, class_id: e.target.value })}>
          <option value="">Not set</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {className(c)}
            </option>
          ))}
        </SelectField>
        <Field label="Roll no" id="e_roll" value={f.roll_no ?? ""} onChange={(e) => setF({ ...f, roll_no: e.target.value })} />
      </div>
      <Field label="Registration no" id="e_reg" inputMode="numeric" value={f.reg_no ?? ""} onChange={(e) => setF({ ...f, reg_no: e.target.value })} />
      <Field label="Parent's phone (WhatsApp)" id="e_phone" type="tel" inputMode="numeric" placeholder="0300 1234567" value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <SelectField label="Status" id="e_status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Student["status"] })}>
        <option value="active">Studying here</option>
        <option value="left">Has left the school</option>
      </SelectField>
      <ErrorNote>{error}</ErrorNote>
      <PrimaryButton type="submit" busy={busy}>
        Save details
      </PrimaryButton>
      <button type="button" onClick={() => setEditing(false)} className="h-11 text-[15px] text-sub hover:text-ink">
        Cancel
      </button>
    </form>
  );
}

function Results({ data, studentId }: { data: ResultsData; studentId: string }) {
  const subjects = subjectsWithTests(data);
  const overall = studentPercent(data, studentId);
  const subjectName = new Map(data.subjects.map((s) => [s.id, s.name]));
  const marks = new Map(data.results.filter((r) => r.student_id === studentId).map((r) => [r.test_id, Number(r.marks)]));
  const kinds: TestKind[] = ["monthly", "weekly", "daily"];

  return (
    <Card title="Results" action={<span className={`text-xl font-medium tabular-nums ${toneFor(overall)}`}>{pct(overall)}</span>}>
      {subjects.length === 0 ? (
        <p className="mt-2 text-sm text-sub">No tests yet this session.</p>
      ) : (
        <>
          <ul className="mt-3 flex flex-col gap-3">
            {subjects.map((s) => {
              const p = subjectPercent(data, s.id, studentId);
              return (
                <li key={s.id} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{s.name}</span>
                    <span className={`font-medium tabular-nums ${toneFor(p)}`}>{pct(p)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-bg">
                    <div className="h-full rounded-full bg-navy" style={{ width: `${Math.round(p ?? 0)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          {kinds.map((k) => {
            const tests = data.tests.filter((t) => t.kind === k && marks.has(t.id));
            if (!tests.length) return null;
            return (
              <div key={k} className="mt-5">
                <h3 className="text-sm font-medium">{KIND_LABEL[k]}</h3>
                <ul className="mt-2 rounded-2xl bg-bg px-4 py-1">
                  {tests.map((t) => {
                    const m = marks.get(t.id)!;
                    const p = (m / Number(t.total_marks)) * 100;
                    return (
                      <li key={t.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm">{t.title || subjectName.get(t.subject_id)}</span>
                          <span className="text-xs text-sub">
                            {subjectName.get(t.subject_id)} · {new Date(t.held_on).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        </span>
                        <span className={`shrink-0 text-sm tabular-nums ${toneFor(p)}`}>
                          {m}/{Number(t.total_marks)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </>
      )}
    </Card>
  );
}

function Profile({ id }: { id: string }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [plans, setPlans] = useState<FeePlan[]>([]);
  const [rates, setRates] = useState<HostelRate[]>([]);
  const [feeRates, setFeeRates] = useState<FeeRates>(emptyRates);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FeeDraft>(emptyDraft);
  const [from, setFrom] = useState(monthStart().slice(0, 7));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      await supabase.rpc("generate_fee_records", { p_month: monthStart() });
      const [s, c, p, r, b, pay, res, fr] = await Promise.all([
        supabase.from("students").select("id, full_name, father_name, roll_no, reg_no, phone, admission_date, class_id, status, profile_id").eq("id", id).maybeSingle(),
        loadClasses(),
        supabase.from("student_fee_plans").select("*").eq("student_id", id).order("effective_from", { ascending: false }),
        supabase.from("hostel_rates").select("residence, monthly_rent, mess_fee"),
        supabase.from("student_fee_balance").select("*").eq("student_id", id).maybeSingle(),
        supabase.from("fee_payments").select("receipt_no, paid_on, amount, fee_records!inner(student_id)").eq("fee_records.student_id", id).order("paid_on", { ascending: false }),
        loadResults({ studentId: id }),
        loadFeeRates(),
      ]);
      if (!active) return;
      const byReceipt = new Map<number, Receipt>();
      for (const x of pay.data ?? []) {
        const e = byReceipt.get(x.receipt_no) ?? { receipt_no: x.receipt_no, paid_on: x.paid_on, amount: 0 };
        e.amount += Number(x.amount);
        byReceipt.set(x.receipt_no, e);
      }
      setStudent(s.data as Student | null);
      setClasses(c);
      setPlans((p.data ?? []) as FeePlan[]);
      setRates((r.data ?? []) as HostelRate[]);
      setFeeRates(fr);
      setBalance(b.data ? ({ ...b.data, outstanding: Number(b.data.outstanding), unpaid_months: Number(b.data.unpaid_months) } as Balance) : null);
      setReceipts([...byReceipt.values()]);
      setResults(res);
    })();
    return () => {
      active = false;
    };
  }, [id, version]);

  const thisMonth = monthStart();
  const current = plans.find((p) => p.effective_from <= thisMonth);
  const upcoming = plans.filter((p) => p.effective_from > thisMonth);

  function startEdit() {
    const grades = classes.find((c) => c.id === student?.class_id)?.grades;
    setDraft(current ? draftFromPlan(current) : { ...emptyDraft, tuition_fee: String(tuitionFor(feeRates, grades)) });
    setFrom(monthStart(current ? 1 : 0).slice(0, 7));
    setError("");
    setEditing(true);
  }

  async function saveFee(e: FormEvent) {
    e.preventDefault();
    setError("");
    const checked = readDraft(draft);
    if ("error" in checked) return setError(checked.error);
    if (!/^\d{4}-\d{2}$/.test(from)) return setError("Choose the month the change starts from.");
    setBusy(true);
    const { error } = await supabase
      .from("student_fee_plans")
      .upsert({ ...checked.values, student_id: id, effective_from: `${from}-01` }, { onConflict: "student_id,effective_from" });
    setBusy(false);
    if (error) return setError("The change wasn't saved. Try again.");
    setEditing(false);
    setVersion((v) => v + 1);
  }

  if (!student) return <p className="mt-6 text-sm text-sub">Loading student</p>;

  const owed = balance?.outstanding ?? 0;
  const alert = owed > 0 && (balance?.unpaid_months ?? 0) >= 2;

  return (
    <>
      <Details key={version} student={student} classes={classes} onSaved={() => setVersion((v) => v + 1)} />

      <section className={`mt-4 flex items-center justify-between gap-3 rounded-[28px] p-5 ${alert ? "bg-bad-soft" : "border border-line bg-white"}`}>
        <div>
          <p className={`text-sm ${alert ? "text-bad-ink" : "text-sub"}`}>{owed > 0 ? `Fee pending · ${balance?.unpaid_months} ${balance?.unpaid_months === 1 ? "month" : "months"}` : "Fee status"}</p>
          <p className={`mt-1 text-2xl font-medium tabular-nums ${owed > 0 ? (alert ? "text-bad" : "text-warn") : "text-ok"}`}>{owed > 0 ? rs(owed) : balance ? "All paid" : "No fee yet"}</p>
        </div>
        {owed > 0 && (
          <Link href={`/admin/fees/pay?student=${id}`} className="rounded-full bg-gold px-4 py-2.5 text-[15px] font-medium text-ink">
            Add payment
          </Link>
        )}
      </section>

      <AttendanceSummary studentId={id} />

      {results && <Results data={results} studentId={id} />}

      <section className="mt-4 rounded-[28px] bg-navy p-5 text-white">
        <p className="text-sm text-mist">Monthly fee{current ? ` · ${residenceLabel(current.residence)}` : ""}</p>
        <p className="mt-1 text-[34px] font-medium leading-none tracking-tight tabular-nums">{current ? rs(Number(current.monthly_total)) : "Not set"}</p>
        {current && <Breakdown plan={current} />}
        {upcoming.map((u) => (
          <p key={u.id} className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm">
            From {monthLabel(u.effective_from)}: {residenceLabel(u.residence)}, {rs(Number(u.monthly_total))}
          </p>
        ))}
        {!editing && (
          <button type="button" onClick={startEdit} className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-gold text-[15px] font-medium text-ink hover:brightness-95">
            {current ? "Change fee or hostel" : "Set fee"}
          </button>
        )}
      </section>

      {editing && (
        <form onSubmit={saveFee} noValidate className="mt-4 flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5">
          <h2 className="text-base font-medium">{current ? "Change fee or hostel" : "Set fee"}</h2>
          <FeeForm draft={draft} onChange={setDraft} rates={rates} extras={feeRates} />
          <Field label="Starts from" id="from" type="month" value={from} onChange={(e) => setFrom(e.target.value)} />
          <p className="-mt-2 text-sm text-sub">Months before this keep their old fee.</p>
          <ErrorNote>{error}</ErrorNote>
          <PrimaryButton type="submit" busy={busy}>
            Save change
          </PrimaryButton>
          <button type="button" onClick={() => setEditing(false)} className="h-11 text-[15px] text-sub hover:text-ink">
            Cancel
          </button>
        </form>
      )}

      {receipts.length > 0 && (
        <Card title="Payments">
          <ul className="mt-3 rounded-2xl bg-bg px-4 py-1">
            {receipts.map((r) => (
              <li key={r.receipt_no} className="border-b border-line last:border-b-0">
                <Link href={`/admin/fees/receipt/${r.receipt_no}`} className="flex items-center justify-between py-3">
                  <span className="flex flex-col">
                    <span className="text-[15px] tabular-nums">{rs(r.amount)}</span>
                    <span className="text-sm text-sub">
                      {new Date(r.paid_on).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · Invoice {r.receipt_no}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-[18px] text-sub" strokeWidth={1.75} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Logins key={`l${version}`} student={student} profileId={student.profile_id} />

      {plans.length > 1 && (
        <Card title="Fee history">
          <ul className="mt-3 rounded-2xl bg-bg px-4 py-1">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center justify-between border-b border-line py-3 last:border-b-0">
                <span className="flex flex-col">
                  <span className="text-[15px]">From {monthLabel(p.effective_from)}</span>
                  <span className="text-sm text-sub">{residenceLabel(p.residence)}</span>
                </span>
                <span className="text-sm tabular-nums">{rs(Number(p.monthly_total))}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

export default function StudentPage() {
  return (
    <Portal role="admin" title="Student" back="/admin/students">
      {() => <WithId render={(id) => <Profile id={id} />} />}
    </Portal>
  );
}
