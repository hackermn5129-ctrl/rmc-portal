"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { WithId } from "@/components/route";
import { ErrorNote, OkNote, PrimaryButton } from "@/components/ui";
import { KIND_LABEL, className, pct, toneFor, type TestKind } from "@/lib/school";
import { loadClassStudents } from "@/lib/teacher";

type Test = { id: string; class_id: string; title: string; kind: TestKind; held_on: string; total_marks: number; subjects: { name: string } | null; classes: { name: string; section: string } | null };
type Student = { id: string; full_name: string; roll_no: string | null };

function Marks({ testId, teacherId }: { testId: string; teacherId: string }) {
  const [test, setTest] = useState<Test | null | undefined>(undefined);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: t } = await supabase
        .from("tests")
        .select("id, class_id, title, kind, held_on, total_marks, subjects(name), classes(name, section)")
        .eq("id", testId)
        .maybeSingle();
      if (!t) {
        if (active) setTest(null);
        return;
      }
      const [list, res] = await Promise.all([loadClassStudents(t.class_id), supabase.from("results").select("student_id, marks").eq("test_id", testId)]);
      if (!active) return;
      setTest(t as unknown as Test);
      setStudents(list);
      setMarks(Object.fromEntries((res.data ?? []).map((r) => [r.student_id, String(Number(r.marks))])));
    })();
    return () => {
      active = false;
    };
  }, [testId]);

  if (test === undefined) return <p className="mt-6 text-sm text-sub">Loading</p>;
  if (test === null) return <p className="mt-6 text-sm text-sub">This test wasn&apos;t found.</p>;

  const total = Number(test.total_marks);
  const filled = students.filter((s) => (marks[s.id] ?? "").trim() !== "");
  const avg = filled.length ? (filled.reduce((a, s) => a + Number(marks[s.id]), 0) / filled.length / total) * 100 : null;

  async function save() {
    setError("");
    setOk("");
    const rows = [];
    for (const s of students) {
      const raw = (marks[s.id] ?? "").trim();
      if (!raw) continue;
      const m = Number(raw);
      if (!Number.isFinite(m) || m < 0 || m > total) return setError(`${s.full_name}: marks must be between 0 and ${total}.`);
      rows.push({ test_id: testId, student_id: s.id, marks: m, entered_by: teacherId, entered_at: new Date().toISOString() });
    }
    if (!rows.length) return setError("Enter at least one student's marks.");
    setBusy(true);
    const { error } = await supabase.from("results").upsert(rows, { onConflict: "test_id,student_id" });
    const cleared = students.filter((s) => !(marks[s.id] ?? "").trim()).map((s) => s.id);
    if (!error && cleared.length) await supabase.from("results").delete().eq("test_id", testId).in("student_id", cleared);
    setBusy(false);
    if (error) return setError("Marks weren't saved. Try again.");
    setOk(`Saved marks for ${rows.length} of ${students.length} students. Parents and students can see them now.`);
  }

  return (
    <>
      <section className="mt-5 rounded-[28px] bg-navy p-5 text-white">
        <p className="text-sm text-mist">
          {KIND_LABEL[test.kind].replace(" tests", " test")} · {className(test.classes)} · {new Date(test.held_on).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </p>
        <h2 className="mt-1 text-xl font-medium">
          {test.subjects?.name}
          {test.title ? ` · ${test.title}` : ""}
        </h2>
        <div className="mt-4 flex gap-6">
          <div>
            <p className="text-xs text-mist">Total marks</p>
            <p className="text-2xl font-medium tabular-nums">{total}</p>
          </div>
          <div>
            <p className="text-xs text-mist">Class average</p>
            <p className="text-2xl font-medium tabular-nums">{pct(avg)}</p>
          </div>
          <div>
            <p className="text-xs text-mist">Entered</p>
            <p className="text-2xl font-medium tabular-nums">
              {filled.length}/{students.length}
            </p>
          </div>
        </div>
      </section>

      <p className="mt-4 text-sm text-sub">Leave a box empty if the student was absent.</p>
      <ul className="mt-3 rounded-3xl border border-line bg-white px-4 py-1">
        {students.length === 0 && <li className="py-4 text-sm text-sub">No students in this class yet.</li>}
        {students.map((s, i) => {
          const raw = marks[s.id] ?? "";
          const p = raw.trim() ? (Number(raw) / total) * 100 : null;
          return (
            <li key={s.id} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
              <label htmlFor={`m_${s.id}`} className="flex min-w-0 flex-col">
                <span className="truncate text-[15px]">{s.full_name}</span>
                {s.roll_no && <span className="text-xs text-sub">Roll {s.roll_no}</span>}
              </label>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`w-10 text-right text-sm tabular-nums ${toneFor(p)}`}>{p === null || Number.isNaN(p) ? "" : pct(p)}</span>
                <input
                  id={`m_${s.id}`}
                  inputMode="decimal"
                  enterKeyHint={i === students.length - 1 ? "done" : "next"}
                  value={raw}
                  onChange={(e) => setMarks({ ...marks, [s.id]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (document.getElementById(`m_${students[i + 1]?.id}`) as HTMLInputElement | null)?.focus();
                    }
                  }}
                  className="h-11 w-16 rounded-xl border border-line-strong bg-bg text-center text-base tabular-nums"
                  aria-label={`Marks for ${s.full_name} out of ${total}`}
                />
                <span className="w-8 text-sm text-sub tabular-nums">/{total}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-col gap-3">
        <ErrorNote>{error}</ErrorNote>
        <OkNote>{ok}</OkNote>
        <PrimaryButton type="button" onClick={save} busy={busy}>
          Save marks
        </PrimaryButton>
      </div>
    </>
  );
}

export default function MarksPage() {
  return (
    <Portal role="teacher" title="Enter marks" back="/teacher/tests">
      {(p) => <WithId render={(id) => <Marks testId={id} teacherId={p.id} />} />}
    </Portal>
  );
}
