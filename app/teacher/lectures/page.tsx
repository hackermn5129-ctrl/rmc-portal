"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { ErrorNote, Field, OkNote, PrimaryButton } from "@/components/ui";
import { ChapterPicker } from "@/components/chapter-picker";
import { ClassSubjectFields, firstChoice, useTeaching } from "@/components/class-subject";
import { chapterLabel, groupByChapter, isUrdu, loadChaptersByIds, type Chapter } from "@/lib/chapters";
import { thumbUrl, youtubeId } from "@/lib/mcq";
import { className } from "@/lib/school";

type Lecture = { id: string; class_id: string; subject_id: string; chapter_id: string | null; title: string; youtube_id: string; created_at: string };

function Lectures({ teacherId }: { teacherId: string }) {
  const { classes, session } = useTeaching(teacherId);
  const [pick, setPick] = useState<{ classId: string; subjectId: string } | null>(null);
  const [f, setF] = useState({ chapter_id: "", link: "", title: "", description: "" });
  const [list, setList] = useState<Lecture[]>([]);
  const [chapters, setChapters] = useState<Map<string, Chapter>>(new Map());
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  const sel = pick ?? (classes ? firstChoice(classes) : { classId: "", subjectId: "" });

  useEffect(() => {
    let active = true;
    if (!sel.classId || !sel.subjectId) return;
    (async () => {
      const { data } = await supabase
        .from("video_lectures")
        .select("id, class_id, subject_id, chapter_id, title, youtube_id, created_at")
        .eq("class_id", sel.classId)
        .eq("subject_id", sel.subjectId)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as Lecture[];
      const ch = await loadChaptersByIds(rows.map((r) => r.chapter_id ?? ""));
      if (!active) return;
      setList(rows);
      setChapters(ch);
    })();
    return () => {
      active = false;
    };
  }, [sel.classId, sel.subjectId, reload]);

  if (!classes) return <p className="mt-6 text-sm text-sub">Loading</p>;
  if (!session) return <p className="mt-6 text-sm text-sub">The principal has not set the academic session yet.</p>;
  if (classes.length === 0) return <p className="mt-6 text-sm text-sub">No subjects are given to you yet. The principal adds them in Teachers.</p>;

  const vid = youtubeId(f.link);
  const cls = classes.find((c) => c.id === sel.classId);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (!sel.classId || !sel.subjectId) return setError("Choose the class and the subject.");
    if (!f.chapter_id) return setError("Choose the chapter from the book.");
    if (!vid) return setError("Paste a YouTube link, like https://youtu.be/…");
    if (!f.title.trim()) return setError("Write a short title for the video.");
    setBusy(true);
    const { error } = await supabase.from("video_lectures").insert({
      class_id: sel.classId,
      subject_id: sel.subjectId,
      chapter_id: f.chapter_id,
      academic_year_id: session!.id,
      title: f.title.trim(),
      youtube_id: vid,
      description: f.description.trim() || null,
      created_by: teacherId,
    });
    setBusy(false);
    if (error) return setError("The video wasn't saved. Try again.");
    setOk("Video added. Students of this class can watch it now.");
    setF({ chapter_id: f.chapter_id, link: "", title: "", description: "" });
    setReload((r) => r + 1);
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this video from the students' list?")) return;
    await supabase.from("video_lectures").delete().eq("id", id);
    setReload((r) => r + 1);
  }

  const shown = sel.classId && sel.subjectId ? list : [];

  return (
    <>
      <form onSubmit={save} noValidate className="mt-5 flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5">
        <h2 className="text-lg font-medium">Add a video lecture</h2>
        <ClassSubjectFields classes={classes} classId={sel.classId} subjectId={sel.subjectId} onChange={(c, s) => { setPick({ classId: c, subjectId: s }); setF({ ...f, chapter_id: "" }); }} />
        <ChapterPicker classId={sel.classId} subjectId={sel.subjectId} value={f.chapter_id} onChange={(id) => setF({ ...f, chapter_id: id })} teacherId={teacherId} />
        <Field label="YouTube link" id="link" inputMode="url" placeholder="https://youtu.be/…" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
        {vid && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl(vid)} alt="Video preview" className="aspect-video w-full rounded-2xl object-cover" />
        )}
        <Field label="Title" id="title" placeholder="Cell structure, part 1" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Field label="Note for students (optional)" id="desc" placeholder="Watch before Monday's test" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <ErrorNote>{error}</ErrorNote>
        <OkNote>{ok}</OkNote>
        <PrimaryButton type="submit" busy={busy}>
          Add video
        </PrimaryButton>
      </form>

      {cls && sel.subjectId && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">
            {className(cls)} · {cls.subjects.find((s) => s.id === sel.subjectId)?.name}
          </h2>
          {shown.length === 0 ? (
            <p className="mt-2 text-sm text-sub">No videos yet for this class and subject.</p>
          ) : (
            groupByChapter(shown, chapters).map((g) => (
              <div key={g.chapter?.id ?? "none"} className="mt-4">
                <h3 lang={g.chapter && isUrdu(g.chapter.title) ? "ur" : undefined} className="text-sm font-medium text-sub">
                  {chapterLabel(g.chapter, new Set([...chapters.values()].map((c) => c.grade)).size > 1)}
                </h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {g.items.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumbUrl(l.youtube_id)} alt="" className="h-14 w-24 shrink-0 rounded-xl object-cover" />
                      <span className="min-w-0 flex-1 truncate text-[15px]">{l.title}</span>
                      <button type="button" onClick={() => remove(l.id)} aria-label={`Remove ${l.title}`} className="flex size-10 items-center justify-center rounded-full hover:bg-bg">
                        <Trash2 aria-hidden className="size-[18px] text-bad" strokeWidth={1.75} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      )}
    </>
  );
}

export default function LecturesPage() {
  return (
    <Portal role={["teacher", "admin"]} title="Video lectures" back={(p) => (p.role === "admin" ? "/admin/settings" : "/teacher")}>
      {(p) => <Lectures teacherId={p.id} />}
    </Portal>
  );
}
