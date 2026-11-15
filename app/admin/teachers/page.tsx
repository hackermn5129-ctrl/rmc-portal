"use client";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { isValidPhone } from "@/lib/phone";
import { Portal } from "@/components/portal";
import { ResetPassword } from "@/components/student-extras";
import { ErrorNote, Field, OkNote, PrimaryButton } from "@/components/ui";
import { className, loadClasses, type ClassRow } from "@/lib/school";

type Teacher = { id: string; full_name: string; phone: string | null };

async function functionError(error: unknown, data: { error?: string } | null): Promise<string> {
  if (data?.error) return data.error;
  if (error && typeof error === "object" && "context" in error) {
    try {
      return (await ((error as { context: Response }).context.json())).error;
    } catch {}
  }
  return "The account wasn't created. Check your connection and try again.";
}

function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [version, setVersion] = useState(0);
  const [form, setForm] = useState({ full_name: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [teaches, setTeaches] = useState<{ teacher_id: string; class_id: string }[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("profiles").select("id, full_name, phone").eq("role", "teacher").order("full_name"),
      loadClasses(),
      supabase.from("teacher_classes").select("teacher_id, class_id"),
    ]).then(([t, c, tc]) => {
      if (!active) return;
      setTeachers((t.data ?? []) as Teacher[]);
      setClasses(c);
      setTeaches(tc.data ?? []);
    });
    return () => {
      active = false;
    };
  }, [version]);

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
    setOk(`${form.full_name.trim()} can now sign in with ${form.phone} and the password you chose.`);
    setForm({ full_name: "", phone: "", password: "" });
    setVersion((v) => v + 1);
  }

  async function setClassTeacher(classId: string, teacherId: string) {
    const { error } = await supabase.from("classes").update({ class_teacher_id: teacherId || null }).eq("id", classId);
    if (!error && teacherId) await supabase.from("teacher_classes").upsert({ teacher_id: teacherId, class_id: classId }, { onConflict: "teacher_id,class_id", ignoreDuplicates: true });
    setVersion((v) => v + 1);
  }

  async function toggleTeaches(teacherId: string, classId: string, on: boolean) {
    if (on) await supabase.from("teacher_classes").delete().eq("teacher_id", teacherId).eq("class_id", classId);
    else await supabase.from("teacher_classes").insert({ teacher_id: teacherId, class_id: classId });
    setVersion((v) => v + 1);
  }

  const classOf = (id: string) => classes.filter((c) => c.class_teacher_id === id).map(className).join(", ");

  return (
    <>
      <div className="mt-5 rounded-3xl border border-line bg-white px-4 py-1">
        {teachers.length === 0 ? (
          <p className="py-4 text-sm text-sub">No teachers yet. Add the first one below.</p>
        ) : (
          <ul>
            {teachers.map((t) => (
              <li key={t.id} className="border-b border-line py-3 last:border-b-0">
                <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id} className="flex w-full items-center justify-between gap-3 text-left">
                  <span className="flex flex-col">
                    <span className="text-[15px]">{t.full_name}</span>
                    <span className="text-sm text-sub tabular-nums">{t.phone}</span>
                  </span>
                  <span className="text-right text-sm text-sub">
                    {classOf(t.id) ? `Class teacher: ${classOf(t.id)}` : "No class"}
                    <br />
                    Teaches {teaches.filter((x) => x.teacher_id === t.id).length} classes
                  </span>
                </button>
                {open === t.id && (
                  <div className="mt-3">
                    <div className="mb-3">
                      <ResetPassword userId={t.id} name={t.full_name} />
                    </div>
                    <p className="text-sm text-sub">Teaches in (tap to change)</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {classes.map((c) => {
                        const on = teaches.some((x) => x.teacher_id === t.id && x.class_id === c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleTeaches(t.id, c.id, on)}
                            className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-navy bg-navy text-white" : "border-line-strong bg-bg"}`}
                          >
                            {className(c)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {teachers.length > 0 && (
        <>
          <h2 className="mt-6 text-base font-medium">Class teachers</h2>
          <p className="mt-1 text-sm text-sub">The class teacher reminds students about fees and marks attendance.</p>
          <ul className="mt-3 rounded-3xl border border-line bg-white px-4 py-1">
            {classes.map((c) => (
              <li key={c.id} className="flex h-16 items-center justify-between gap-3 border-b border-line last:border-b-0">
                <label htmlFor={`ct_${c.id}`} className="text-[15px]">
                  {className(c)}
                </label>
                <select
                  id={`ct_${c.id}`}
                  value={c.class_teacher_id ?? ""}
                  onChange={(e) => setClassTeacher(c.id, e.target.value)}
                  className="h-11 max-w-[190px] rounded-2xl border border-line-strong bg-bg px-3 text-[15px]"
                >
                  <option value="">Not set</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </>
      )}

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
