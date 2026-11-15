"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { ErrorNote, Field, PrimaryButton } from "@/components/ui";
import { ChapterPicker } from "@/components/chapter-picker";
import { ClassSubjectFields, firstChoice, useTeaching } from "@/components/class-subject";

function NewMcq({ teacherId }: { teacherId: string }) {
  const router = useRouter();
  const { classes, session } = useTeaching(teacherId);
  const [pick, setPick] = useState<{ classId: string; subjectId: string } | null>(null);
  const [f, setF] = useState({ chapter_id: "", title: "", minutes: "15" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!classes) return <p className="mt-6 text-sm text-sub">Loading</p>;
  if (!session) return <p className="mt-6 text-sm text-sub">The principal has not set the academic session yet.</p>;
  if (classes.length === 0) return <p className="mt-6 text-sm text-sub">No subjects are given to you yet. The principal adds them in Teachers.</p>;
  const sel = pick ?? firstChoice(classes);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    const minutes = Number(f.minutes);
    if (!sel.classId || !sel.subjectId) return setError("Choose the class and the subject.");
    if (!f.chapter_id) return setError("Choose the chapter from the book.");
    if (!f.title.trim()) return setError("Write a name for the test.");
    if (!(minutes >= 1 && minutes <= 300)) return setError("Time should be between 1 and 300 minutes.");
    setBusy(true);
    const { data, error } = await supabase
      .from("mcq_tests")
      .insert({
        class_id: sel.classId,
        subject_id: sel.subjectId,
        chapter_id: f.chapter_id,
        academic_year_id: session!.id,
        title: f.title.trim(),
        minutes,
        published: false,
        created_by: teacherId,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) return setError("The test wasn't saved. Try again.");
    router.replace(`/teacher/mcq/${data.id}`);
  }

  return (
    <form onSubmit={save} noValidate className="mt-5 flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5">
      <ClassSubjectFields classes={classes} classId={sel.classId} subjectId={sel.subjectId} onChange={(c, s) => { setPick({ classId: c, subjectId: s }); setF({ ...f, chapter_id: "" }); }} />
      <ChapterPicker classId={sel.classId} subjectId={sel.subjectId} value={f.chapter_id} onChange={(id) => setF({ ...f, chapter_id: id })} teacherId={teacherId} />
      <Field label="Test name" id="title" placeholder="Chapter 3 quick test" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <Field label="Time (minutes)" id="min" inputMode="numeric" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} />
      <ErrorNote>{error}</ErrorNote>
      <PrimaryButton type="submit" busy={busy}>
        Next: add questions
      </PrimaryButton>
    </form>
  );
}

export default function Page() {
  return (
    <Portal role={["teacher", "admin"]} title="New MCQ test" back="/teacher/mcq">
      {(p) => <NewMcq teacherId={p.id} />}
    </Portal>
  );
}
