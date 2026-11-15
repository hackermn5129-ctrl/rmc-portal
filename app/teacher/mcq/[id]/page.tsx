"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { WithId } from "@/components/route";
import { ErrorNote, OkNote, PrimaryButton } from "@/components/ui";
import { chapterLabel, isUrdu, loadChaptersByIds, type Chapter } from "@/lib/chapters";
import { LETTERS, parsePasted, type DraftQuestion } from "@/lib/mcq";
import { className } from "@/lib/school";

type Test = { id: string; class_id: string; chapter_id: string | null; title: string; minutes: number; published: boolean; subjects: { name: string } | null; classes: { name: string; section: string } | null };
type Question = DraftQuestion & { id: string; position: number };
type Attempt = { id: string; score: number; total: number; submitted_at: string | null; students: { full_name: string; roll_no: string | null } | null };

const EXAMPLE = `Q: What is the basic unit of life?
A) Tissue
B) Cell
C) Organ
D) Atom
Answer: B
Why: All living things are made of cells.

Q: Which part of the cell makes energy?
A) Nucleus
B) Ribosome
C) Mitochondria
D) Cell wall
Answer: C`;

const dirOf = (s: string) => (isUrdu(s) ? "rtl" : undefined);

function Editor({ testId }: { testId: string }) {
  const router = useRouter();
  const [test, setTest] = useState<Test | null | undefined>(undefined);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [tab, setTab] = useState<"one" | "paste">("one");
  const [draft, setDraft] = useState<DraftQuestion>({ question: "", options: ["", "", "", ""], correct: -1, explanation: "" });
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const [t, q, a] = await Promise.all([
        supabase.from("mcq_tests").select("id, class_id, chapter_id, title, minutes, published, subjects(name), classes(name, section)").eq("id", testId).maybeSingle(),
        supabase.from("mcq_questions").select("id, position, question, options, correct, explanation").eq("test_id", testId).order("position"),
        supabase.from("mcq_attempts").select("id, score, total, submitted_at, students(full_name, roll_no)").eq("test_id", testId).order("score", { ascending: false }),
      ]);
      const ch = t.data?.chapter_id ? await loadChaptersByIds([t.data.chapter_id]) : new Map<string, Chapter>();
      if (!active) return;
      setTest((t.data as unknown as Test) ?? null);
      setChapter(t.data?.chapter_id ? ch.get(t.data.chapter_id) ?? null : null);
      setQuestions(((q.data ?? []) as Question[]).map((x) => ({ ...x, explanation: x.explanation ?? "" })));
      setAttempts((a.data ?? []) as unknown as Attempt[]);
    })();
    return () => {
      active = false;
    };
  }, [testId, reload]);

  if (test === undefined) return <p className="mt-6 text-sm text-sub">Loading</p>;
  if (!test) return <p className="mt-6 text-sm text-sub">This test was not found, or it is not your subject.</p>;
  const t = test;

  async function insert(list: DraftQuestion[]) {
    const start = questions.reduce((m, q) => Math.max(m, q.position), 0);
    const rows = list.map((q, i) => ({
      test_id: testId,
      position: start + i + 1,
      question: q.question.trim(),
      options: q.options.map((o) => o.trim()),
      correct: q.correct,
      explanation: q.explanation.trim() || null,
    }));
    return supabase.from("mcq_questions").insert(rows);
  }

  async function addOne() {
    setError("");
    setOk("");
    const options = draft.options.map((o) => o.trim());
    const filled = options.filter(Boolean);
    if (!draft.question.trim()) return setError("Write the question.");
    if (filled.length < 2 || options.slice(0, filled.length).some((o) => !o)) return setError("Fill at least options A and B, in order.");
    if (draft.correct < 0 || !options[draft.correct]) return setError("Tap the correct answer.");
    setBusy(true);
    const { error } = await insert([{ ...draft, options: options.slice(0, filled.length) }]);
    setBusy(false);
    if (error) return setError("The question wasn't saved. Try again.");
    setDraft({ question: "", options: ["", "", "", ""], correct: -1, explanation: "" });
    setOk("Question added.");
    setReload((r) => r + 1);
  }

  async function addPasted() {
    setError("");
    setOk("");
    const { questions: list, errors } = parsePasted(paste);
    if (errors.length) return setError(errors.slice(0, 3).join(" "));
    if (!list.length) return setError("Paste at least one question.");
    setBusy(true);
    const { error } = await insert(list);
    setBusy(false);
    if (error) return setError("The questions weren't saved. Try again.");
    setPaste("");
    setOk(`${list.length} ${list.length === 1 ? "question" : "questions"} added.`);
    setReload((r) => r + 1);
  }

  async function removeQ(id: string) {
    if (!window.confirm("Delete this question?")) return;
    await supabase.from("mcq_questions").delete().eq("id", id);
    setReload((r) => r + 1);
  }

  async function togglePublish() {
    setError("");
    if (!t.published && questions.length === 0) return setError("Add questions first.");
    await supabase.from("mcq_tests").update({ published: !t.published }).eq("id", testId);
    setOk(t.published ? "The test is closed. Students can't start it now." : "The test is open. Students of this class can take it now.");
    setReload((r) => r + 1);
  }

  async function removeTest() {
    if (!window.confirm(attempts.length ? `${attempts.length} students took this test. Delete it and their scores?` : "Delete this test?")) return;
    const { error } = await supabase.from("mcq_tests").delete().eq("id", testId);
    if (error) return setError("Only the principal can delete a test that students already took.");
    router.replace("/teacher/mcq");
  }

  const parsed = tab === "paste" && paste.trim() ? parsePasted(paste) : null;

  return (
    <>
      <section className="mt-5 rounded-[28px] bg-navy p-5 text-white">
        <p className="text-sm text-mist">
          {t.classes ? className(t.classes) : ""} · {t.subjects?.name}
        </p>
        <h2 className="mt-1 text-xl font-medium leading-tight">{t.title}</h2>
        <p lang={chapter && isUrdu(chapter.title) ? "ur" : undefined} className="mt-1 text-sm text-mist">
          {chapterLabel(chapter, true)}
        </p>
        <p className="mt-3 text-sm">
          {questions.length} questions · {t.minutes} minutes · {t.published ? "Open for students" : "Draft (students can't see it)"}
        </p>
        <button type="button" onClick={togglePublish} className="mt-4 h-12 w-full rounded-full bg-gold text-[15px] font-medium text-ink">
          {t.published ? "Close the test" : "Open for students"}
        </button>
      </section>

      <ErrorNote>{error}</ErrorNote>
      <div className="mt-3">
        <OkNote>{ok}</OkNote>
      </div>

      <section className="mt-5 rounded-[28px] border border-line bg-white p-5">
        <div role="tablist" className="grid grid-cols-2 gap-2">
          {(["one", "paste"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-11 rounded-full border text-sm ${tab === k ? "border-navy bg-navy text-white" : "border-line-strong bg-bg"}`}>
              {k === "one" ? "Add one question" : "Paste many"}
            </button>
          ))}
        </div>

        {tab === "one" ? (
          <div className="mt-4 flex flex-col gap-3">
            <label htmlFor="q" className="text-sm text-sub">
              Question
            </label>
            <textarea id="q" rows={3} dir={dirOf(draft.question)} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} className="rounded-2xl border border-line-strong bg-bg p-3 text-base" />
            <p className="text-sm text-sub">Options — tap the circle of the correct answer</p>
            {draft.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Option ${LETTERS[i]} is correct`}
                  aria-pressed={draft.correct === i}
                  onClick={() => setDraft({ ...draft, correct: i })}
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-medium ${draft.correct === i ? "border-ok bg-ok text-white" : "border-line-strong bg-white"}`}
                >
                  {draft.correct === i ? <Check aria-hidden className="size-[18px]" /> : LETTERS[i]}
                </button>
                <input
                  aria-label={`Option ${LETTERS[i]}`}
                  dir={dirOf(o)}
                  value={o}
                  onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, j) => (j === i ? e.target.value : x)) })}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-bg px-3 text-base"
                />
              </div>
            ))}
            <label htmlFor="why" className="text-sm text-sub">
              Why is it correct? (optional, shown after the test)
            </label>
            <input id="why" dir={dirOf(draft.explanation)} value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} className="h-11 rounded-xl border border-line-strong bg-bg px-3 text-base" />
            <PrimaryButton type="button" busy={busy} onClick={addOne}>
              Add question
            </PrimaryButton>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-sub">Type or paste questions in this shape. Leave one empty line between questions.</p>
            <pre className="overflow-x-auto rounded-2xl bg-bg p-3 text-xs leading-relaxed text-sub">{EXAMPLE}</pre>
            <textarea aria-label="Pasted questions" rows={10} value={paste} onChange={(e) => setPaste(e.target.value)} className="rounded-2xl border border-line-strong bg-bg p-3 text-sm" />
            {parsed && (
              <p className="text-sm text-sub">
                Found {parsed.questions.length} {parsed.questions.length === 1 ? "question" : "questions"}
                {parsed.errors.length ? ` · ${parsed.errors.length} need fixing` : ""}
              </p>
            )}
            <PrimaryButton type="button" busy={busy} onClick={addPasted}>
              Add these questions
            </PrimaryButton>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Questions</h2>
        {questions.length === 0 ? (
          <p className="mt-2 text-sm text-sub">No questions yet.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2">
            {questions.map((q, i) => (
              <li key={q.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex gap-2">
                  <p dir={dirOf(q.question)} className="min-w-0 flex-1 text-[15px] font-medium">
                    {i + 1}. {q.question}
                  </p>
                  <button type="button" onClick={() => removeQ(q.id)} aria-label={`Delete question ${i + 1}`} className="-m-2 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-bg">
                    <Trash2 aria-hidden className="size-[18px] text-bad" strokeWidth={1.75} />
                  </button>
                </div>
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {q.options.map((o, j) => (
                    <li key={j} dir={dirOf(o)} className={j === q.correct ? "font-medium text-ok" : "text-sub"}>
                      {LETTERS[j]}) {o} {j === q.correct && "✓"}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Scores</h2>
        {attempts.length === 0 ? (
          <p className="mt-2 text-sm text-sub">No student has taken it yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate text-[15px]">
                  {a.students?.roll_no ? `${a.students.roll_no}. ` : ""}
                  {a.students?.full_name}
                </span>
                <span className="shrink-0 text-[15px] font-medium tabular-nums">
                  {a.score}/{a.total}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button type="button" onClick={removeTest} className="mt-8 h-12 rounded-full border border-line-strong bg-white text-[15px] font-medium text-bad">
        Delete this test
      </button>
    </>
  );
}

export default function Page() {
  return (
    <Portal role={["teacher", "admin"]} title="MCQ test" back="/teacher/mcq">
      {() => <WithId render={(id) => <Editor testId={id} />} />}
    </Portal>
  );
}
