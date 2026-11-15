"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { Portal } from "@/components/portal";
import { WithQuery } from "@/components/route";
import { ErrorNote, Field, PrimaryButton, SelectField } from "@/components/ui";
import { loadFeeOverview, type FeeOverview, type StudentLite } from "@/lib/fee-data";
import { monthLabel, rs } from "@/lib/fees";
import { className } from "@/lib/school";
import { VoucherButton, VoucherCard, type VoucherPhoto } from "@/components/voucher-reader";
import { findVoucher, matchStudents, voucherAmount, voucherMonths } from "@/lib/voucher";

type MonthDue = { fee_record_id: string; month: string; amount_due: number; amount_paid: number };
const today = () => new Date().toLocaleDateString("en-CA");

function Pay({ preselect }: { preselect: string | null }) {
  const router = useRouter();
  const [data, setData] = useState<FeeOverview | null>(null);
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [picked, setPicked] = useState<StudentLite | null>(null);
  const [months, setMonths] = useState<MonthDue[]>([]);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [paidOn, setPaidOn] = useState(today());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<VoucherPhoto | null>(null);
  const [voucherNo, setVoucherNo] = useState("");
  const [saved, setSaved] = useState<{ receipt_no: number; paid_on: string } | null>(null);
  const [repeatOk, setRepeatOk] = useState("");

  useEffect(() => {
    let active = true;
    loadFeeOverview().then((d) => {
      if (!active) return;
      setData(d);
      const s = preselect ? d.students.find((x) => x.id === preselect) : null;
      if (s) choose(s);
    });
    return () => {
      active = false;
    };
  }, [preselect]);

  // With a voucher photo, the amount, date and voucher number come from the photo and can still be changed.
  async function choose(s: StudentLite, from: VoucherPhoto | null = photo) {
    const v = from?.voucher;
    setPicked(s);
    setPhone(s.phone ?? "");
    setAmount(v && voucherAmount(v) > 0 ? String(voucherAmount(v)) : "");
    if (v) {
      setPaidOn(v.date && v.date <= today() ? v.date : today());
      setVoucherNo(v.voucher_no);
      setMethod("cash");
    }
    setError("");
    const { data: rows } = await supabase
      .from("fee_status")
      .select("fee_record_id, month, amount_due, amount_paid")
      .eq("student_id", s.id)
      .order("month");
    setMonths(((rows ?? []) as MonthDue[]).filter((r) => Number(r.amount_paid) < Number(r.amount_due)));
  }

  async function onRead(p: VoucherPhoto) {
    setPhoto(p);
    setQuery("");
    setClassFilter("");
    setRepeatOk("");
    setSaved(await findVoucher(p.voucher.voucher_no));
  }

  function clearPhoto() {
    setPhoto(null);
    setSaved(null);
    setVoucherNo("");
    setRepeatOk("");
  }

  const classById = useMemo(() => new Map((data?.classes ?? []).map((c) => [c.id, c])), [data]);
  const guess = useMemo(() => (photo && data ? matchStudents(photo.voucher, data.students, data.classes) : null), [photo, data]);

  const matches = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (q.length < 2 && !classFilter) return [];
    return data.students
      .filter((s) => (!classFilter || s.class_id === classFilter) && (q.length < 2 || s.full_name.toLowerCase().includes(q) || (s.father_name ?? "").toLowerCase().includes(q) || (s.reg_no ?? "").includes(q)))
      .slice(0, 30);
  }, [data, query, classFilter]);

  if (!data) return <p className="mt-6 text-sm text-sub">Loading students</p>;
  if (data.noSession) return <p className="mt-6 text-sm text-sub">Set the academic session in School setup first.</p>;

  const owed = months.reduce((a, m) => a + Number(m.amount_due) - Number(m.amount_paid), 0);
  const paying = Number(amount.replace(/,/g, "") || 0);
  const left = owed - (Number.isFinite(paying) ? paying : 0);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!picked) return;
    setError("");
    if (!(paying > 0)) return setError("Enter the amount paid now.");
    if (paying > owed) return setError(`That is more than what is due (${rs(owed)}).`);
    if (phone.trim() && !isValidPhone(phone)) return setError("The phone number should be 11 digits, like 0300 1234567.");
    const vno = voucherNo.trim();
    setBusy(true);
    if (vno && repeatOk !== vno) {
      const before = await findVoucher(vno);
      if (before) {
        setBusy(false);
        setRepeatOk(vno);
        return setError(`Voucher ${vno} was already saved as invoice ${before.receipt_no}. If this is a different booklet, press save again.`);
      }
    }
    if (phone.trim() && normalizePhone(phone) !== (picked.phone ?? "")) await supabase.from("students").update({ phone: normalizePhone(phone) }).eq("id", picked.id);
    const { data: receipt, error } = await supabase.rpc("record_payment", { p_student: picked.id, p_amount: paying, p_paid_on: paidOn, p_method: method, p_voucher_no: vno || null });
    setBusy(false);
    if (error || !receipt) return setError("The payment wasn't saved. Try again.");
    router.replace(`/admin/fees/receipt/${receipt}`);
  }

  const studentRow = (s: StudentLite) => {
    const b = data.balances.get(s.id);
    return (
      <li key={s.id} className="border-b border-line last:border-b-0">
        <button type="button" onClick={() => choose(s)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px]">{s.full_name}</span>
            <span className="truncate text-sm text-sub">
              {className(classById.get(s.class_id ?? ""))}
              {s.reg_no ? ` · ${s.reg_no}` : ""}
              {s.father_name ? ` · s/o ${s.father_name}` : ""}
              {s.phone ? ` · ${s.phone}` : ""}
            </span>
          </span>
          <span className={`shrink-0 text-sm tabular-nums ${b && b.outstanding > 0 ? "text-warn" : "text-ok"}`}>{b && b.outstanding > 0 ? rs(b.outstanding) : "Paid"}</span>
        </button>
      </li>
    );
  };

  if (!picked)
    return (
      <div className="mt-5 flex flex-col gap-4">
        {!photo && <VoucherButton onRead={onRead} />}
        {photo && (
          <>
            <VoucherCard photo={photo} onRetake={clearPhoto} />
            {saved && (
              <ErrorNote>
                Voucher {photo.voucher.voucher_no} was already saved as invoice {saved.receipt_no}. Check before adding it again.
              </ErrorNote>
            )}
            <section>
              <h2 className="text-base font-medium">Who is this student?</h2>
              {guess && guess.candidates.length > 0 ? (
                <>
                  <p className="mt-1 text-sm text-sub">{guess.sure ? "This looks like the right student. Tap to continue." : "Tap the right student."}</p>
                  <ul className="mt-3 rounded-3xl border border-line bg-white px-4 py-1">{guess.candidates.map((c) => studentRow(c.student))}</ul>
                </>
              ) : (
                <p className="mt-1 text-sm text-sub">No student matched the name on the voucher. Find the student below.</p>
              )}
            </section>
          </>
        )}
        <div className="flex flex-col gap-2">
          <label htmlFor="q" className="text-sm text-sub">
            {photo ? "Not in the list? Type the name or registration no" : "Or type the student name or registration no"}
          </label>
          <div className="relative">
            <Search aria-hidden className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-sub" strokeWidth={1.75} />
            <input
              id="q"
              autoComplete="off"
              placeholder="Name or registration no, like Muhammad"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-[52px] w-full rounded-2xl border border-line-strong bg-white pl-11 pr-4 text-base text-ink placeholder:text-sub/70"
            />
          </div>
        </div>
        <SelectField label="Class" id="cf" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="">All classes</option>
          {data.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {className(c)}
            </option>
          ))}
        </SelectField>

        {matches.length > 0 && (
          <ul className="rounded-3xl border border-line bg-white px-4 py-1">
            {matches.map(studentRow)}
          </ul>
        )}
        {(query.trim().length >= 2 || classFilter) && matches.length === 0 && <p className="text-sm text-sub">No student matches that.</p>}
      </div>
    );

  return (
    <form onSubmit={save} noValidate className="mt-5 flex flex-col gap-4">
      {photo && <VoucherCard photo={photo} />}
      <section className="rounded-[28px] border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">{picked.full_name}</h2>
            <p className="text-sm text-sub">
              {className(classById.get(picked.class_id ?? ""))}
              {picked.father_name ? ` · s/o ${picked.father_name}` : ""}
            </p>
          </div>
          <button type="button" onClick={() => setPicked(null)} aria-label="Choose another student" className="flex size-10 items-center justify-center rounded-full border border-line-strong hover:bg-bg">
            <X aria-hidden className="size-[18px]" strokeWidth={1.75} />
          </button>
        </div>
        <div className="mt-4">
          <Field label="Parent's phone (for WhatsApp)" id="phone" type="tel" inputMode="numeric" placeholder="0300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </section>

      <section className="rounded-[28px] bg-navy p-5 text-white">
        <p className="text-sm text-mist">Total due</p>
        <p className="mt-1 text-[34px] font-medium leading-none tracking-tight tabular-nums">{rs(owed)}</p>
        {months.length === 0 ? (
          <p className="mt-3 text-sm text-mist">Nothing is due. Set this student&apos;s fee from their profile if this is wrong.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {months.map((m) => (
              <li key={m.fee_record_id} className="flex justify-between text-sm">
                <span className="text-mist">
                  {monthLabel(m.month)}
                  {Number(m.amount_paid) > 0 ? " (part paid)" : ""}
                </span>
                <span className="tabular-nums">{rs(Number(m.amount_due) - Number(m.amount_paid))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {months.length > 0 && (
        <section className="flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5">
          <Field label="Amount paid now" id="amount" inputMode="numeric" placeholder="10000" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="flex items-baseline justify-between rounded-2xl bg-bg px-4 py-3">
            <span className="text-sm text-sub">Remaining after this</span>
            <span className={`text-xl font-medium tabular-nums ${left > 0 ? "text-warn" : "text-ok"}`}>{rs(Math.max(left, 0))}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Paid by" id="method" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="easypaisa">Easypaisa</option>
              <option value="jazzcash">JazzCash</option>
            </SelectField>
            <Field label="Date" id="paid_on" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </div>
          <Field label="Voucher no (from the booklet)" id="voucher_no" inputMode="numeric" placeholder="1953" value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} />
          {photo && voucherMonths(photo.voucher) && <p className="text-sm text-sub">The voucher says this fee is for {voucherMonths(photo.voucher)}.</p>}
          {paying > owed && <p className="text-sm text-warn">That is more than what is due ({rs(owed)}). Check the amount and the student.</p>}
          <p className="text-sm text-sub">Older months are paid off first.</p>
          <ErrorNote>{error}</ErrorNote>
          <PrimaryButton type="submit" busy={busy}>
            {photo ? "Confirm, save and make invoice" : "Save and make invoice"}
          </PrimaryButton>
        </section>
      )}
    </form>
  );
}

export default function PayPage() {
  return (
    <Portal role="admin" title="Add payment" back="/admin/fees">
      {() => <WithQuery name="student" render={(s) => <Pay preselect={s} />} />}
    </Portal>
  );
}
