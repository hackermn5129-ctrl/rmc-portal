"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { ErrorNote, Field, PrimaryButton, SelectField } from "@/components/ui";
import { className, currentSession, type Session, type TestKind } from "@/lib/school";
import { loadMyClasses, todayIso, type MyClass } from "@/lib/teacher";

const KINDS: { value: TestKind; label: string; urdu: string; note: string }[] = [
  { value: "daily", label: "Daily", urdu: "روزانہ", note: "Least weight" },
  { value: "weekly", label: "Weekly", urdu: "ہفتہ وار", note: "More weight" },
  { value: "monthly", label: "Monthly", urdu: "ماہانہ", note: "Most weight" },
];

function NewTest({ teacherId }: { teacherId: string }) {
  const router = useRouter();
  const [classes, setClasses] = useState<MyClass[]>([]);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [f, setF] = useState({ class_id: "", subject_id: "", kind: "weekly" as TestKind, title: "", held_on: todayIso(), total_marks: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([loadMyClasses(teacherId), currentSession()]).then(([all, sess]) => {
      if (!active) return;
      const c = all.filter((x) => x.subjects.length > 0);
      setClasses(c);
      setSession(sess);
      if (c.length === 1) setF((x) => ({ ...x, class_id: c[0].id, subject_id: c[0].subjects.length === 1 ? c[0].subjects[0].id : "" }));
    });
    return () => {
      active = false;
    };
  }, [teacherId]);

  if (session === undefined) return <p className="mt-6 text-sm text-sub">Loading</p>;
  if (!session) return <p className="mt-6 text-sm text-sub">The principal has not set the academic session yet.</p>;
  if (classes.length === 0) return <p className="mt-6 text-sm text-sub">No subjects are given to you yet. The principal adds them in Teachers.</p>;
  const subjects = classes.find((c) => c.id === f.class_id)?.subjects ?? [];

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    const total = Number(f.total_marks);
    if (!f.class_id || !f.subject_id) return setError("Choose the class and the subject.");
    if (!(total > 0)) return setError("Enter the total marks, like 25.");
    setBusy(true);
    const { data, error } = await supabase
      .from("tests")
      .insert({
        class_id: f.class_id,
        subject_id: f.subject_id,
        kind: f.kind,
        title: f.title.trim(),
        held_on: f.held_on,
        total_marks: total,
        academic_year_id: session!.id,
        created_by: teacherId,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) return setError("The test wasn't saved. Try again.");
    router.replace(`/teacher/tests/${data.id}`);
  }

  return (
    <form onSubmit={save} noValidate className="mt-5 flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5">
      <fieldset>
        <legend className="mb-2 text-sm text-sub">Kind of test</legend>
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => {
            const on = f.kind === k.value;
            return (
              <button
                key={k.value}
                type="button"
                aria-pressed={on}
                onClick={() => setF({ ...f, kind: k.value })}
                className={`flex flex-col items-center rounded-2xl border px-2 py-3 ${on ? "border-navy bg-navy text-white" : "border-line-strong bg-bg"}`}
              >
                <span className="text-[15px] font-medium">{k.label}</span>
                <span lang="ur" dir="rtl" className={`font-urdu text-xs leading-[2] ${on ? "text-mist" : "text-sub"}`}>
                  {k.urdu}
                </span>
                <span className={`text-xs ${on ? "text-mist" : "text-sub"}`}>{k.note}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Class" id="cls" value={f.class_id} onChange={(e) => {
            const subs = classes.find((c) => c.id === e.target.value)?.subjects ?? [];
            setF({ ...f, class_id: e.target.value, subject_id: subs.length === 1 ? subs[0].id : "" });
          }}>
          <option value="">Choose</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {className(c)}
            </option>
          ))}
        </SelectField>
        <SelectField label="Subject" id="sub" value={f.subject_id} onChange={(e) => setF({ ...f, subject_id: e.target.value })}>
          <option value="">Choose</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total marks" id="total" inputMode="numeric" placeholder="25" value={f.total_marks} onChange={(e) => setF({ ...f, total_marks: e.target.value })} />
        <Field label="Date" id="date" type="date" max={todayIso()} value={f.held_on} onChange={(e) => setF({ ...f, held_on: e.target.value })} />
      </div>
      <Field label="Topic (optional)" id="title" placeholder="Chapter 3" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <ErrorNote>{error}</ErrorNote>
      <PrimaryButton type="submit" busy={busy}>
        Next: enter marks
      </PrimaryButton>
    </form>
  );
}

export default function NewTestPage() {
  return (
    <Portal role={["teacher", "admin"]} title="Test taken" back="/teacher/tests">
      {(p) => <NewTest teacherId={p.id} />}
    </Portal>
  );
}
