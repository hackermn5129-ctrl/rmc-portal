"use client";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { Portal } from "@/components/portal";
import { ErrorNote, Field, PrimaryButton } from "@/components/ui";
import { FeeForm } from "@/components/fee-form";
import { emptyDraft, emptyRates, monthStart, readDraft, tuitionFor, type FeeDraft, type FeeRates, type HostelRate } from "@/lib/fees";
import { loadFeeRates } from "@/lib/fee-data";

type ClassRow = { id: string; name: string; section: string; grades: number[] | null };

function NewStudent() {
  const router = useRouter();
  const params = useSearchParams();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [rates, setRates] = useState<HostelRate[]>([]);
  const [feeRates, setFeeRates] = useState<FeeRates>(emptyRates);
  const [classId, setClassId] = useState(params.get("class") ?? "");
  const [name, setName] = useState("");
  const [father, setFather] = useState("");
  const [roll, setRoll] = useState("");
  const [phone, setPhone] = useState("");
  const [fee, setFee] = useState<FeeDraft>(emptyDraft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([supabase.from("classes").select("id, name, section, grades"), supabase.from("hostel_rates").select("residence, monthly_rent, mess_fee"), loadFeeRates()]).then(
      ([c, r, fr]) => {
        const rows = (c.data ?? []) as ClassRow[];
        rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || a.section.localeCompare(b.section));
        setClasses(rows);
        setRates((r.data ?? []) as HostelRate[]);
        setFeeRates(fr);
        const picked = rows.find((x) => x.id === (params.get("class") ?? ""));
        if (picked) setFee((f) => (f.tuition_fee ? f : { ...f, tuition_fee: String(tuitionFor(fr, picked.grades)) }));
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Choosing a class fills its academic fee, unless he has typed a different one.
  function pickClass(id: string) {
    const before = classes.find((c) => c.id === classId);
    const after = classes.find((c) => c.id === id);
    setClassId(id);
    if (!after) return;
    setFee((f) => (!f.tuition_fee || (before && f.tuition_fee === String(tuitionFor(feeRates, before.grades))) ? { ...f, tuition_fee: String(tuitionFor(feeRates, after.grades)) } : f));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Enter the student's name.");
    if (!classId) return setError("Choose a class.");
    if (phone.trim() && !isValidPhone(phone)) return setError("The phone number should be 11 digits, like 0300 1234567.");
    const checked = readDraft(fee);
    if ("error" in checked) return setError(checked.error);

    setBusy(true);
    const { data: student, error: e1 } = await supabase
      .from("students")
      .insert({ full_name: name.trim(), father_name: father.trim() || null, roll_no: roll.trim() || null, class_id: classId, phone: phone.trim() ? normalizePhone(phone) : null })
      .select("id")
      .single();
    if (e1 || !student) {
      setBusy(false);
      return setError("The student wasn't saved. Try again.");
    }
    const { error: e2 } = await supabase.from("student_fee_plans").insert({ ...checked.values, student_id: student.id, effective_from: monthStart() });
    setBusy(false);
    if (e2) return setError("The student was saved, but the fee wasn't. Open the student and set the fee.");
    router.replace(`/admin/students/${student.id}`);
  }

  return (
    <form onSubmit={save} noValidate className="mt-5 flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5">
        <h2 className="text-base font-medium">Student</h2>
        <Field label="Full name" id="name" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Father's name" id="father" value={father} onChange={(e) => setFather(e.target.value)} />
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="class" className="text-sm text-sub">
              Class
            </label>
            <select
              id="class"
              value={classId}
              onChange={(e) => pickClass(e.target.value)}
              className="h-[52px] rounded-2xl border border-line-strong bg-bg px-4 text-base text-ink"
            >
              <option value="">Choose</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.section ? `-${c.section}` : ""}
                </option>
              ))}
            </select>
          </div>
          <Field label="Roll no" id="roll" value={roll} onChange={(e) => setRoll(e.target.value)} />
        </div>
        <Field label="Parent's phone (WhatsApp)" id="phone" type="tel" inputMode="numeric" placeholder="0300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </section>

      <section className="flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5">
        <h2 className="text-base font-medium">Monthly fee</h2>
        <FeeForm draft={fee} onChange={setFee} rates={rates} extras={feeRates} />
      </section>

      <ErrorNote>{error}</ErrorNote>
      <PrimaryButton type="submit" busy={busy}>
        Save student
      </PrimaryButton>
    </form>
  );
}

export default function NewStudentPage() {
  return (
    <Portal role="admin" title="Add student" back="/admin/students">
      {() => (
        <Suspense>
          <NewStudent />
        </Suspense>
      )}
    </Portal>
  );
}
