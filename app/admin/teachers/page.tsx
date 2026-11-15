"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isValidPhone } from "@/lib/phone";
import { Portal } from "@/components/portal";
import { ResetPassword } from "@/components/student-extras";
import { ErrorNote, Field, OkNote, PrimaryButton } from "@/components/ui";
import { className, loadClasses, type ClassRow } from "@/lib/school";

type Teacher = { id: string; full_name: string; phone: string | null; role: "teacher" | "admin" };
type Klass = ClassRow & { fee_incharge_id: string | null };
type Assignment = { teacher_id: string; class_id: string; subject_id: string };
type Subject = { id: string; name: string };

async function functionError(error: unknown, data: { error?: string } | null): Promise<string> {
  if (data?.error) return data.error;
  if (error && typeof error === "object" && "context" in error) {
    try {
      return (await (error as { context: Response }).context.json()).error;
    } catch {}
  }
  return "The account wasn't created. Check your connection and try again.";
}

const selectCls = "h-11 w-full rounded-2xl border border-line-strong bg-bg px-3 text-[15px] text-ink";

// Subjects one teacher teaches, class by class: remove with ✕, add with the two pickers.
function SubjectEditor({ teacher, classes, subjects, rows, onChange }: { teacher: Teacher; classes: Klass[]; subjects: Subject[]; rows: Assignment[]; onChange: () => void }) {
  const [cls, setCls] = useState("");
  const [sub, setSub] = useState("");
  const [err, setErr] = useState("");
  const subName = new Map(subjects.map((s) => [s.id, s.name]));
  const mine = rows.filter((r) => r.teacher_id === teacher.id);
  const byClass = classes.map((c) => ({ c, list: mine.filter((r) => r.class_id === c.id) })).filter((x) => x.list.length);

  async function add() {
    setErr("");
    if (!cls || !sub) return setErr("Pick a class and a subject.");
    const { error } = await supabase.from("teacher_subjects").insert({ teacher_id: teacher.id, class_id: cls, subject_id: sub });
    if (error && error.code !== "23505") return setErr("That wasn't saved. Try again.");
    setSub("");
    onChange();
  }

  async function remove(r: Assignment) {
    await supabase.from("teacher_subjects").delete().eq("teacher_id", r.teacher_id).eq("class_id", r.class_id).eq("subject_id", r.subject_id);
    onChange();
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="text-sm text-sub">Subjects (enters daily, weekly and monthly test marks for these)</p>
      {byClass.length === 0 && <p className="text-sm text-sub">No subjects yet.</p>}
      {byClass.map(({ c, list }) => (
        <div key={c.id} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{className(c)}</span>
          <div className="flex flex-wrap gap-1.5">
            {list.map((r) => (
              <span key={r.subject_id} className="flex items-center gap-1 rounded-full bg-navy py-1 pl-3 pr-1 text-sm text-white">
                {subName.get(r.subject_id)}
                <button type="button" onClick={() => remove(r)} aria-label={`Remove ${subName.get(r.subject_id)} in ${className(c)}`} className="flex size-6 items-center justify-center rounded-full hover:bg-white/15">
                  <X aria-hidden className="size-3.5" strokeWidth={2} />
                </button>
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <select aria-label="Class" value={cls} onChange={(e) => setCls(e.target.value)} className={selectCls}>
          <option value="">Class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {className(c)}
            </option>
          ))}
        </select>
        <select aria-label="Subject" value={sub} onChange={(e) => setSub(e.target.value)} className={selectCls}>
          <option value="">Subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={add} className="h-11 rounded-full bg-gold px-4 text-[15px] font-medium text-ink">
          Add
        </button>
      </div>
      <ErrorNote>{err}</ErrorNote>
    </div>
  );
}

function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rows, setRows] = useState<Assignment[]>([]);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("profiles").select("id, full_name, phone, role").in("role", ["teacher", "admin"]).order("full_name"),
      loadClasses(),
      supabase.from("classes").select("id, fee_incharge_id"),
      supabase.from("subjects").select("id, name").order("name"),
      supabase.from("teacher_subjects").select("teacher_id, class_id, subject_id"),
    ]).then(([t, c, fi, s, ts]) => {
      if (!active) return;
      const fee = new Map((fi.data ?? []).map((x) => [x.id, x.fee_incharge_id]));
      // Teachers first, the principal last.
      setTeachers(((t.data ?? []) as Teacher[]).sort((a, b) => (a.role === b.role ? 0 : a.role === "admin" ? 1 : -1)));
      setClasses(c.map((x) => ({ ...x, fee_incharge_id: fee.get(x.id) ?? null })));
      setSubjects((s.data ?? []) as Subject[]);
      setRows((ts.data ?? []) as Assignment[]);
    });
    return () => {
      active = false;
    };
  }, [version]);

  const refresh = () => setVersion((v) => v + 1);

  async function setJob(classId: string, field: "class_teacher_id" | "fee_incharge_id", teacherId: string) {
    await supabase.from("classes").update({ [field]: teacherId || null }).eq("id", classId);
    refresh();
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (form.full_name.trim().length < 3) return setError("Enter the teacher's full name.");
    if (!isValidPhone(form.phone)) return setError("Enter an 11-digit mobile number, like 0300 1234567.");
    if (form.password.length < 8) return setError("Use a password with at least 8 characters.");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("manage-users", { body: { action: "create", role: "teacher", ...form } });
    setBusy(false);
    if (error || !data?.ok) return setError(await functionError(error, data));
    setOk(`${form.full_name.trim()} can now sign in with ${form.phone} and the password you chose. Tap their name to give them subjects.`);
    setForm({ full_name: "", phone: "", password: "" });
    refresh();
  }

  const jobs = (id: string) => {
    const ci = classes.filter((c) => c.class_teacher_id === id).map(className);
    const fi = classes.filter((c) => c.fee_incharge_id === id).map(className);
    const n = rows.filter((r) => r.teacher_id === id).length;
    return [ci.length && `Class incharge: ${ci.join(", ")}`, fi.length && `Fee incharge: ${fi.join(", ")}`, `${n} ${n === 1 ? "subject" : "subjects"}`].filter(Boolean).join(" · ");
  };

  const staff = teachers.filter((t) => t.role === "teacher");

  return (
    <>
      <ul className="mt-5 flex flex-col gap-2">
        {teachers.map((t) => (
          <li key={t.id} className="rounded-3xl border border-line bg-white p-4">
            <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id} className="flex w-full items-start justify-between gap-3 text-left">
              <span className="flex min-w-0 flex-col">
                <span className="text-[15px] font-medium">
                  {t.full_name}
                  {t.role === "admin" ? " (principal)" : ""}
                </span>
                <span className="text-sm text-sub tabular-nums">{t.phone}</span>
                <span className="mt-1 text-sm text-sub">{jobs(t.id)}</span>
              </span>
              <ChevronDown aria-hidden className={`mt-1 size-[18px] shrink-0 text-sub transition-transform ${open === t.id ? "rotate-180" : ""}`} strokeWidth={1.75} />
            </button>
            {open === t.id && (
              <div className="mt-3 border-t border-line pt-3">
                {t.role === "teacher" && <ResetPassword userId={t.id} name={t.full_name} />}
                <SubjectEditor teacher={t} classes={classes} subjects={subjects} rows={rows} onChange={refresh} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <h2 className="mt-6 text-base font-medium">Class jobs</h2>
      <p className="mt-1 text-sm text-sub">
        <span className="font-medium text-ink">Class incharge</span> marks attendance. <span className="font-medium text-ink">Fee incharge</span> sees who has not paid (no amounts).
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {classes.map((c) => (
          <li key={c.id} className="rounded-3xl border border-line bg-white p-4">
            <p className="text-[15px] font-medium">{className(c)}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-sub">
                Class incharge
                <select value={c.class_teacher_id ?? ""} onChange={(e) => setJob(c.id, "class_teacher_id", e.target.value)} className={selectCls}>
                  <option value="">Not set</option>
                  {staff.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-sub">
                Fee incharge
                <select value={c.fee_incharge_id ?? ""} onChange={(e) => setJob(c.id, "fee_incharge_id", e.target.value)} className={selectCls}>
                  <option value="">Not set</option>
                  {staff.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 text-base font-medium">Add a teacher</h2>
      <form onSubmit={add} noValidate className="mt-3 flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5">
        <Field label="Full name" id="t_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <Field label="Phone number" id="t_phone" type="tel" inputMode="numeric" placeholder="0300 1234567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Field label="Password for them" id="t_pass" type="text" autoComplete="off" placeholder="At least 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <ErrorNote>{error}</ErrorNote>
        <OkNote>{ok}</OkNote>
        <PrimaryButton type="submit" busy={busy}>
          Add teacher
        </PrimaryButton>
      </form>
    </>
  );
}

export default function TeachersPage() {
  return (
    <Portal role="admin" title="Teachers" back="/admin">
      {() => <Teachers />}
    </Portal>
  );
}
