"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { ErrorNote, Field, OkNote, PrimaryButton, SelectField } from "@/components/ui";
import { className, currentSession, type Session } from "@/lib/school";
import {
  SHIFTS,
  STATUSES,
  defaultShift,
  loadClassStudents,
  loadMyClasses,
  loadSubjects,
  todayIso,
  type AttendanceStatus,
  type MyClass,
  type Shift,
} from "@/lib/teacher";

type Student = { id: string; full_name: string; roll_no: string | null };

function Attendance({ teacherId }: { teacherId: string }) {
  const [classes, setClasses] = useState<MyClass[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [shift, setShift] = useState<Shift>(defaultShift());
  const [date, setDate] = useState(todayIso());
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [existing, setExisting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([loadMyClasses(teacherId), loadSubjects(), currentSession()]).then(([c, s, sess]) => {
      if (!active) return;
      setClasses(c);
      setSubjects(s);
      setSession(sess);
      if (c.length === 1) setClassId(c[0].id);
    });
    return () => {
      active = false;
    };
  }, [teacherId]);

  // Load the class list and any attendance already saved for this lecture.
  useEffect(() => {
    if (!classId) return;
    let active = true;
    (async () => {
      const list = await loadClassStudents(classId);
      let lectureId: string | null = null;
      const saved: Record<string, AttendanceStatus> = {};
      if (subjectId) {
        const { data: lec } = await supabase
          .from("lectures")
          .select("id")
          .eq("class_id", classId)
          .eq("subject_id", subjectId)
          .eq("shift", shift)
          .eq("held_on", date)
          .maybeSingle();
        lectureId = lec?.id ?? null;
        if (lectureId) {
          const { data: att } = await supabase.from("lecture_attendance").select("student_id, status").eq("lecture_id", lectureId);
          for (const a of att ?? []) saved[a.student_id] = a.status;
        }
      }
      if (!active) return;
      setStudents(list);
      setExisting(lectureId);
      setMarks(Object.fromEntries(list.map((s) => [s.id, saved[s.id] ?? "present"])));
      setOk("");
      setError("");
    })();
    return () => {
      active = false;
    };
  }, [classId, subjectId, shift, date]);

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { present: 0, late: 0, absent: 0, leave: 0 };
    for (const s of students) c[marks[s.id] ?? "present"] += 1;
    return c;
  }, [students, marks]);

  if (session === undefined) return <p className="mt-6 text-sm text-sub">Loading</p>;
  if (!session) return <p className="mt-6 text-sm text-sub">The principal has not set the academic session yet.</p>;
  if (classes.length === 0) return <p className="mt-6 text-sm text-sub">No classes are assigned to you yet.</p>;

  async function save() {
    setError("");
    setOk("");
    if (!classId || !subjectId) return setError("Choose the class and the subject.");
    if (!students.length) return setError("There are no students in this class yet.");
    setBusy(true);
    let lectureId = existing;
    if (!lectureId) {
      const { data, error } = await supabase
        .from("lectures")
        .insert({ class_id: classId, subject_id: subjectId, shift, held_on: date, academic_year_id: session!.id, teacher_id: teacherId })
        .select("id")
        .single();
      if (error || !data) {
        setBusy(false);
        return setError("The lecture wasn't saved. Try again.");
      }
      lectureId = data.id;
    }
    const rows = students.map((s) => ({ lecture_id: lectureId, student_id: s.id, status: marks[s.id] ?? "present", marked_by: teacherId, marked_at: new Date().toISOString() }));
    const { error } = await supabase.from("lecture_attendance").upsert(rows, { onConflict: "lecture_id,student_id" });
    setBusy(false);
    if (error) return setError("Attendance wasn't saved. Try again.");
    setExisting(lectureId);
    setOk(`Saved. ${counts.present + counts.late} of ${students.length} present.`);
  }

  return (
    <>
      <section className="mt-5 flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Class" id="cls" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Choose</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {className(c)}
              </option>
            ))}
          </SelectField>
          <SelectField label="Subject" id="sub" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Choose</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Shift">
          {SHIFTS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={shift === s.value}
              onClick={() => setShift(s.value)}
              className={`flex flex-col items-center rounded-2xl border px-2 py-2.5 text-sm ${shift === s.value ? "border-navy bg-navy text-white" : "border-line-strong bg-bg"}`}
            >
              {s.label}
              <span lang="ur" dir="rtl" className={`font-urdu text-xs leading-[2] ${shift === s.value ? "text-mist" : "text-sub"}`}>
                {s.urdu}
              </span>
            </button>
          ))}
        </div>
        <Field label="Date" id="date" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
        {existing && <p className="text-sm text-warn">Already marked. Changes will update it.</p>}
      </section>

      {classId && students.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {STATUSES.map((s) => (
              <div key={s.value} className="flex flex-col items-center rounded-2xl border border-line bg-white py-2.5">
                <span className="text-xl font-medium tabular-nums">{counts[s.value]}</span>
                <span className="text-xs text-sub">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-sub">Everyone starts as present. Tap to change.</p>
            <button type="button" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, "present"])))} className="text-sm text-navy">
              All present
            </button>
          </div>

          <ul className="mt-3 rounded-3xl border border-line bg-white px-4 py-1">
            {students.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px]">{s.full_name}</span>
                  {s.roll_no && <span className="text-xs text-sub">Roll {s.roll_no}</span>}
                </span>
                <span className="flex shrink-0 gap-1" role="radiogroup" aria-label={`${s.full_name} attendance`}>
                  {STATUSES.map((st) => {
                    const on = (marks[s.id] ?? "present") === st.value;
                    return (
                      <button
                        key={st.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={st.label}
                        onClick={() => setMarks({ ...marks, [s.id]: st.value })}
                        className={`flex h-9 min-w-9 items-center justify-center rounded-full border px-2 text-sm font-medium ${on ? st.on : "border-line-strong bg-bg text-sub"}`}
                      >
                        {st.short}
                      </button>
                    );
                  })}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-col gap-3">
            <ErrorNote>{error}</ErrorNote>
            <OkNote>{ok}</OkNote>
            <PrimaryButton type="button" onClick={save} busy={busy}>
              Save attendance
            </PrimaryButton>
          </div>
        </>
      )}
      {classId && students.length === 0 && <p className="mt-4 text-sm text-sub">No students in this class yet.</p>}
    </>
  );
}

export default function AttendancePage() {
  return (
    <Portal role="teacher" title="Mark attendance" back="/teacher">
      {(p) => <Attendance teacherId={p.id} />}
    </Portal>
  );
}
