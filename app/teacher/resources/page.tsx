"use client";
import { useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { ErrorNote, Field, OkNote, PrimaryButton, SelectField } from "@/components/ui";
import { ChapterPicker } from "@/components/chapter-picker";
import { ClassSubjectFields, firstChoice, useTeaching } from "@/components/class-subject";
import { classGrades, isUrdu } from "@/lib/chapters";
import { LETTERS, parsePasted, type DraftQuestion } from "@/lib/mcq";

type Tab = "short" | "long" | "mcq" | "ebook";
const TABS: { v: Tab; label: string }[] = [
  { v: "short", label: "Short Qs" },
  { v: "long", label: "Long Qs" },
  { v: "mcq", label: "MCQs" },
  { v: "ebook", label: "E-book" },
];
const dirOf = (s: string) => (isUrdu(s) ? "rtl" : undefined);
// "★★★ Asked 12× · " before the answer line.
const asked = (n: number | null) => (n ? `${n > 10 ? "★★★ " : n >= 5 ? "★ " : ""}Asked ${n}× · ` : "");

// "Q: … / A: …" blocks with an empty line between them.
function parseQA(text: string) {
  const out: { question: string; answer: string }[] = [];
  const errors: string[] = [];
  text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .forEach((block, i) => {
      const m = block.match(/^(?:q(?:uestion)?\s*\d*\s*[:.)-]|\d+\s*[.)-])?\s*([\s\S]*?)\n\s*(?:a(?:ns(?:wer)?)?\s*[:.)-])\s*([\s\S]*)$/i);
      if (!m || !m[1].trim()) errors.push(`Question ${i + 1}: write "Q:" then the question, and "A:" on a new line for the answer.`);
      else out.push({ question: m[1].trim(), answer: m[2].trim() });
    });
  return { out, errors };
}

// A Google Drive share link becomes a link that opens inside the page.
function bookUrl(raw: string) {
  const s = raw.trim();
  const id = s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([A-Za-z0-9_-]{10,})/)?.[1];
  if (id) return `https://drive.google.com/file/d/${id}/preview`;
  return /^https:\/\//.test(s) ? s : null;
}

function Resources({ teacherId }: { teacherId: string }) {
  const { classes } = useTeaching(teacherId);
  const [pick, setPick] = useState<{ classId: string; subjectId: string } | null>(null);
  const [tab, setTab] = useState<Tab>("short");
  const [chapterId, setChapterId] = useState("");
  const [items, setItems] = useState<{ id: string; title: string; sub: string }[]>([]);
  const [reload, setReload] = useState(0);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState("");
  const [qa, setQa] = useState({ question: "", answer: "" });
  const [mcq, setMcq] = useState<DraftQuestion>({ question: "", options: ["", "", "", ""], correct: -1, explanation: "" });
  const [book, setBook] = useState({ grade: "", title: "", link: "" });
  const [grades, setGrades] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const sel = pick ?? (classes ? firstChoice(classes) : { classId: "", subjectId: "" });

  useEffect(() => {
    let active = true;
    if (!sel.classId) return;
    classGrades(sel.classId).then((g) => {
      if (!active) return;
      setGrades(g);
      setBook((b) => ({ ...b, grade: String(g[0] ?? "") }));
    });
    return () => {
      active = false;
    };
  }, [sel.classId]);

  useEffect(() => {
    let active = true;
    (async () => {
      let rows: { id: string; title: string; sub: string }[] = [];
      if (tab === "ebook" && sel.subjectId && grades.length) {
        const { data } = await supabase.from("ebooks").select("id, title, grade, source").eq("subject_id", sel.subjectId).in("grade", grades).order("grade");
        rows = (data ?? []).map((b) => ({ id: b.id, title: b.title, sub: `Class ${b.grade} book · ${b.source}` }));
      } else if (tab === "mcq" && chapterId) {
        const { data } = await supabase.from("bank_mcqs").select("id, question, options, correct, times_asked").eq("chapter_id", chapterId).order("times_asked", { ascending: false }).order("created_at");
        rows = (data ?? []).map((q) => ({ id: q.id, title: q.question, sub: `${asked(q.times_asked)}Answer: ${LETTERS[q.correct]}) ${q.options[q.correct]}` }));
      } else if ((tab === "short" || tab === "long") && chapterId) {
        const { data } = await supabase.from("study_questions").select("id, question, answer, times_asked").eq("chapter_id", chapterId).eq("kind", tab).order("times_asked", { ascending: false }).order("position").order("created_at");
        rows = (data ?? []).map((q) => ({ id: q.id, title: q.question, sub: `${asked(q.times_asked)}${q.answer ? q.answer.slice(0, 120) : "No answer yet"}` }));
      }
      if (active) setItems(rows);
    })();
    return () => {
      active = false;
    };
  }, [tab, chapterId, sel.subjectId, grades, reload]);

  if (!classes) return <p className="mt-6 text-sm text-sub">Loading</p>;
  if (classes.length === 0) return <p className="mt-6 text-sm text-sub">No subjects are given to you yet. The principal adds them in Teachers.</p>;

  const table = tab === "ebook" ? "ebooks" : tab === "mcq" ? "bank_mcqs" : "study_questions";
  const done = (msg: string) => {
    setOk(msg);
    setReload((r) => r + 1);
  };

  async function save() {
    setError("");
    setOk("");
    if (!sel.classId || !sel.subjectId) return setError("Choose the class and the subject.");
    if (tab === "ebook") {
      const url = bookUrl(book.link);
      if (!book.title.trim()) return setError("Write the book name.");
      if (!url) return setError("Paste a Google Drive or https:// link to the PDF.");
      setBusy(true);
      const { error } = await supabase.from("ebooks").insert({ grade: Number(book.grade), subject_id: sel.subjectId, title: book.title.trim(), url, source: "Added by teacher", created_by: teacherId });
      setBusy(false);
      if (error) return setError("The book wasn't saved. Try again.");
      setBook({ ...book, title: "", link: "" });
      return done("Book added. Students can read it in Resources.");
    }
    if (!chapterId) return setError("Choose the chapter first.");
    let rows: Record<string, unknown>[] = [];
    if (tab === "mcq") {
      if (paste) {
        const { questions, errors } = parsePasted(text);
        if (errors.length) return setError(errors.slice(0, 3).join(" "));
        rows = questions.map((q) => ({ chapter_id: chapterId, question: q.question, options: q.options, correct: q.correct, explanation: q.explanation || null, created_by: teacherId }));
      } else {
        const opts = mcq.options.map((o) => o.trim());
        const n = opts.filter(Boolean).length;
        if (!mcq.question.trim()) return setError("Write the question.");
        if (n < 2 || opts.slice(0, n).some((o) => !o)) return setError("Fill at least options A and B, in order.");
        if (mcq.correct < 0 || !opts[mcq.correct]) return setError("Tap the correct answer.");
        rows = [{ chapter_id: chapterId, question: mcq.question.trim(), options: opts.slice(0, n), correct: mcq.correct, explanation: mcq.explanation.trim() || null, created_by: teacherId }];
      }
    } else {
      const start = items.length;
      if (paste) {
        const { out, errors } = parseQA(text);
        if (errors.length) return setError(errors.slice(0, 3).join(" "));
        rows = out.map((q, i) => ({ chapter_id: chapterId, kind: tab, question: q.question, answer: q.answer, position: start + i + 1, created_by: teacherId }));
      } else {
        if (!qa.question.trim()) return setError("Write the question.");
        rows = [{ chapter_id: chapterId, kind: tab, question: qa.question.trim(), answer: qa.answer.trim(), position: start + 1, created_by: teacherId }];
      }
    }
    if (!rows.length) return setError("Nothing to add.");
    setBusy(true);
    const { error } = await supabase.from(table).insert(rows);
    setBusy(false);
    if (error) return setError("Not saved. Try again.");
    setText("");
    setQa({ question: "", answer: "" });
    setMcq({ question: "", options: ["", "", "", ""], correct: -1, explanation: "" });
    done(`${rows.length} added.`);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this?")) return;
    await supabase.from(table).delete().eq("id", id);
    setReload((r) => r + 1);
  }

  return (
    <>
      <div className="mt-5 flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5">
        <ClassSubjectFields
          classes={classes}
          classId={sel.classId}
          subjectId={sel.subjectId}
          onChange={(c, s) => {
            setPick({ classId: c, subjectId: s });
            setChapterId("");
          }}
        />
        <div role="tablist" className="grid grid-cols-4 gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.v}
              type="button"
              role="tab"
              aria-selected={tab === t.v}
              onClick={() => {
                setTab(t.v);
                setError("");
                setOk("");
              }}
              className={`h-11 rounded-full border text-sm ${tab === t.v ? "border-navy bg-navy text-white" : "border-line-strong bg-bg"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "ebook" ? (
          <>
            {grades.length > 1 && (
              <SelectField label="Book" id="grade" value={book.grade} onChange={(e) => setBook({ ...book, grade: e.target.value })}>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    Class {g} book
                  </option>
                ))}
              </SelectField>
            )}
            <Field label="Book name" id="bt" placeholder="Biology 9" value={book.title} onChange={(e) => setBook({ ...book, title: e.target.value })} />
            <Field label="Google Drive or PDF link" id="bl" inputMode="url" placeholder="https://drive.google.com/file/d/…" value={book.link} onChange={(e) => setBook({ ...book, link: e.target.value })} />
            <p className="text-[13px] text-sub">In Google Drive, set the file to &quot;Anyone with the link can view&quot;, then copy the link.</p>
          </>
        ) : (
          <>
            <ChapterPicker classId={sel.classId} subjectId={sel.subjectId} value={chapterId} onChange={setChapterId} teacherId={teacherId} />
            {chapterId && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[false, true].map((p) => (
                    <button key={String(p)} type="button" aria-pressed={paste === p} onClick={() => setPaste(p)} className={`h-10 rounded-full border text-sm ${paste === p ? "border-navy bg-navy text-white" : "border-line-strong bg-bg"}`}>
                      {p ? "Paste many" : "Add one"}
                    </button>
                  ))}
                </div>
                {paste ? (
                  <>
                    <pre className="overflow-x-auto rounded-2xl bg-bg p-3 text-xs leading-relaxed text-sub">
                      {tab === "mcq"
                        ? "Q: What is the basic unit of life?\nA) Tissue\nB) Cell\nC) Organ\nD) Atom\nAnswer: B\nWhy: All living things are made of cells."
                        : "Q: Define biology.\nA: Biology is the study of living things.\n\nQ: What is a cell?\nA: The basic unit of life."}
                    </pre>
                    <textarea aria-label="Pasted questions" rows={10} value={text} onChange={(e) => setText(e.target.value)} className="rounded-2xl border border-line-strong bg-bg p-3 text-sm" />
                  </>
                ) : tab === "mcq" ? (
                  <>
                    <textarea aria-label="Question" rows={3} placeholder="Question" dir={dirOf(mcq.question)} value={mcq.question} onChange={(e) => setMcq({ ...mcq, question: e.target.value })} className="rounded-2xl border border-line-strong bg-bg p-3 text-base" />
                    {mcq.options.map((o, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Option ${LETTERS[i]} is correct`}
                          aria-pressed={mcq.correct === i}
                          onClick={() => setMcq({ ...mcq, correct: i })}
                          className={`flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-medium ${mcq.correct === i ? "border-ok bg-ok text-white" : "border-line-strong bg-white"}`}
                        >
                          {mcq.correct === i ? <Check aria-hidden className="size-[18px]" /> : LETTERS[i]}
                        </button>
                        <input aria-label={`Option ${LETTERS[i]}`} dir={dirOf(o)} value={o} onChange={(e) => setMcq({ ...mcq, options: mcq.options.map((x, j) => (j === i ? e.target.value : x)) })} className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-bg px-3 text-base" />
                      </div>
                    ))}
                    <input aria-label="Why it is correct (optional)" placeholder="Why it is correct (optional)" value={mcq.explanation} onChange={(e) => setMcq({ ...mcq, explanation: e.target.value })} className="h-11 rounded-xl border border-line-strong bg-bg px-3 text-base" />
                  </>
                ) : (
                  <>
                    <textarea aria-label="Question" rows={2} placeholder="Question" dir={dirOf(qa.question)} value={qa.question} onChange={(e) => setQa({ ...qa, question: e.target.value })} className="rounded-2xl border border-line-strong bg-bg p-3 text-base" />
                    <textarea aria-label="Answer" rows={tab === "long" ? 8 : 4} placeholder="Answer" dir={dirOf(qa.answer)} value={qa.answer} onChange={(e) => setQa({ ...qa, answer: e.target.value })} className="rounded-2xl border border-line-strong bg-bg p-3 text-base" />
                  </>
                )}
              </>
            )}
          </>
        )}
        <ErrorNote>{error}</ErrorNote>
        <OkNote>{ok}</OkNote>
        {(tab === "ebook" || chapterId) && (
          <PrimaryButton type="button" busy={busy} onClick={save}>
            {tab === "ebook" ? "Add book" : "Save"}
          </PrimaryButton>
        )}
      </div>

      {(tab === "ebook" || chapterId) && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Already added ({items.length})</h2>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-sub">Nothing yet.</p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2">
              {items.map((it, i) => (
                <li key={it.id} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-3">
                  <span className="min-w-0 flex-1">
                    <span dir={dirOf(it.title)} className="block text-[15px] font-medium">
                      {i + 1}. {it.title}
                    </span>
                    <span dir={dirOf(it.sub)} className="block truncate text-[13px] text-sub">
                      {it.sub}
                    </span>
                  </span>
                  <button type="button" onClick={() => remove(it.id)} aria-label="Delete" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-bg">
                    <Trash2 aria-hidden className="size-[18px] text-bad" strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Portal role={["teacher", "admin"]} title="Study resources" back={(p) => (p.role === "admin" ? "/admin/settings" : "/teacher")}>
      {(p) => <Resources teacherId={p.id} />}
    </Portal>
  );
}
