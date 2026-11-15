"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, Clock, PlayCircle, Shuffle, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Child } from "@/lib/family";
import { chapterLabel, groupByChapter, loadChaptersByIds, type Chapter } from "@/lib/chapters";
import { LETTERS, embedUrl, thumbUrl } from "@/lib/mcq";
import { ChapterHeader, ChapterList, SubjectGrid, SubjectHeader, Ur, qs, useChapters, useClassSubjects } from "@/components/learn/kit";
import type { Ctx } from "./shell";

const pctTone = (p: number) => (p >= 80 ? "text-ok" : p >= 50 ? "text-warn" : "text-bad");

export function BackRow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mt-4 inline-flex h-10 items-center gap-1.5 self-start rounded-full border border-line-strong bg-white pl-3 pr-4 text-sm">
      <ArrowLeft aria-hidden className="size-4" strokeWidth={1.75} />
      {label}
    </Link>
  );
}

/* ---------------- Teacher-made MCQ tests ---------------- */

type McqTest = { id: string; subject_id: string; chapter_id: string | null; title: string; minutes: number; created_at: string; subjects: { name: string } | null; mcq_questions: { count: number }[] };
type Attempt = { id: string; test_id: string; score: number; total: number; submitted_at: string };
type Practice = { id: string; subject_id: string; chapter_ids: string[]; score: number | null; total: number; started_at: string; submitted_at: string | null };

export async function loadMcq(child: Child) {
  if (!child.class_id) return { tests: [] as McqTest[], attempts: [] as Attempt[], practice: [] as Practice[], chapters: new Map<string, Chapter>() };
  const [t, a, p] = await Promise.all([
    supabase
      .from("mcq_tests")
      .select("id, subject_id, chapter_id, title, minutes, created_at, subjects(name), mcq_questions(count)")
      .eq("class_id", child.class_id)
      .eq("published", true)
      .order("created_at", { ascending: false }),
    supabase.from("mcq_attempts").select("id, test_id, score, total, submitted_at").eq("student_id", child.id).order("submitted_at", { ascending: false }),
    supabase.from("practice_attempts").select("id, subject_id, chapter_ids, score, total, started_at, submitted_at").eq("student_id", child.id).order("started_at", { ascending: false }).limit(100),
  ]);
  const tests = (t.data ?? []) as unknown as McqTest[];
  const practice = (p.data ?? []) as Practice[];
  const chapters = await loadChaptersByIds([...tests.map((x) => x.chapter_id ?? ""), ...practice.flatMap((x) => x.chapter_ids)]);
  return { tests, attempts: (a.data ?? []) as Attempt[], practice, chapters };
}

function TeacherTests({ tests, attempts, chapters, base }: { tests: McqTest[]; attempts: Attempt[]; chapters: Map<string, Chapter>; base: string }) {
  const isStudent = base === "/student";
  const twoBooks = new Set([...chapters.values()].map((c) => c.grade)).size > 1;
  return (
    <>
      {groupByChapter(tests, chapters).map((g) => (
        <div key={g.chapter?.id ?? "none"} className="mt-3">
          <h4 className="text-sm text-sub">
            <Ur text={chapterLabel(g.chapter, twoBooks)} />
          </h4>
          <ul className="mt-2 flex flex-col gap-2">
            {g.items.map((t) => {
              const mine = attempts.filter((a) => a.test_id === t.id);
              const best = mine.reduce<Attempt | null>((b, a) => (!b || a.score / Math.max(a.total, 1) > b.score / Math.max(b.total, 1) ? a : b), null);
              const p = best ? Math.round((best.score / Math.max(best.total, 1)) * 100) : null;
              const body = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{t.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[13px] text-sub">
                      <Clock aria-hidden className="size-3.5" /> {t.minutes} min · {t.mcq_questions[0]?.count ?? 0} questions
                    </p>
                  </div>
                  {best ? (
                    <span className={`shrink-0 text-[15px] font-medium tabular-nums ${pctTone(p!)}`}>
                      {best.score}/{best.total}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-gold px-3 py-1 text-sm font-medium text-ink">{isStudent ? "Start" : "Not taken"}</span>
                  )}
                  {(isStudent || best) && <ChevronRight aria-hidden className="size-[18px] shrink-0 text-sub" strokeWidth={1.75} />}
                </>
              );
              const href = isStudent ? `${base}/tests/${t.id}` : best ? `${base}/tests/review?a=${best.id}` : null;
              return (
                <li key={t.id}>
                  {href ? (
                    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 hover:bg-bg">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

/* ---------------- Tests: subject boxes → make a test + teacher tests ---------------- */

export function TestsHub({ ctx, subjectId }: { ctx: Ctx; subjectId: string | null }) {
  const { child, base } = ctx;
  const subjects = useClassSubjects(child.class_id);
  const [data, setData] = useState<Awaited<ReturnType<typeof loadMcq>> | null>(null);

  useEffect(() => {
    let active = true;
    loadMcq(child).then((d) => active && setData(d));
    return () => {
      active = false;
    };
  }, [child]);

  if (!subjects || !data) return <p className="mt-6 text-sm text-sub">Loading</p>;
  const subject = subjects.find((s) => s.id === subjectId);

  if (!subject) {
    const done = new Set(data.attempts.map((a) => a.test_id));
    return (
      <>
        <section className="mt-5 rounded-[28px] bg-navy p-5 text-white">
          <p className="text-sm text-mist">Online MCQ tests</p>
          <p className="mt-1 text-lg font-medium leading-snug">Choose a subject. Take a teacher&apos;s test, or make your own from one chapter, many chapters or the whole book.</p>
        </section>
        <SubjectGrid
          subjects={subjects}
          hrefFor={(s) => `${base}/tests${qs({ s: s.id })}`}
          noteFor={(s) => {
            const n = data.tests.filter((t) => t.subject_id === s.id && !done.has(t.id)).length;
            return n ? `${n} new ${n === 1 ? "test" : "tests"}` : null;
          }}
        />
      </>
    );
  }

  const tests = data.tests.filter((t) => t.subject_id === subject.id);
  const practice = data.practice.filter((p) => p.subject_id === subject.id && p.submitted_at);

  return (
    <>
      <BackRow href={`${base}/tests`} label="All subjects" />
      <SubjectHeader name={subject.name} line={`${tests.length} teacher ${tests.length === 1 ? "test" : "tests"} · ${practice.length} practice tests taken`} />
      {base === "/student" && <MakeTest child={child} subjectId={subject.id} base={base} />}

      <section className="mt-6">
        <h3 className="text-lg font-medium">Tests from your teachers</h3>
        {tests.length === 0 ? <p className="mt-2 text-sm text-sub">No teacher test in this subject yet.</p> : <TeacherTests tests={tests} attempts={data.attempts} chapters={data.chapters} base={base} />}
      </section>

      <section className="mt-6">
        <h3 className="text-lg font-medium">{base === "/student" ? "My practice tests" : "Practice tests taken"}</h3>
        {practice.length === 0 ? (
          <p className="mt-2 text-sm text-sub">None yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {practice.slice(0, 20).map((p) => {
              const pc = Math.round(((p.score ?? 0) / Math.max(p.total, 1)) * 100);
              const names = p.chapter_ids.map((id) => data.chapters.get(id)).filter(Boolean) as Chapter[];
              return (
                <li key={p.id}>
                  <Link href={`${base}/tests/review?p=${p.id}`} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{names.length === 1 ? chapterLabel(names[0]) : `${names.length} chapters`}</span>
                      <span className="block text-[13px] text-sub">{new Date(p.submitted_at!).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                    </span>
                    <span className={`shrink-0 text-[15px] font-medium tabular-nums ${pctTone(pc)}`}>
                      {p.score}/{p.total}
                    </span>
                    <ChevronRight aria-hidden className="size-[18px] shrink-0 text-sub" strokeWidth={1.75} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

type Mode = "one" | "many" | "book";

function MakeTest({ child, subjectId, base }: { child: Child; subjectId: string; base: string }) {
  const router = useRouter();
  const chapters = useChapters(child.class_id, subjectId);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [mode, setMode] = useState<Mode>("one");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!child.class_id) return;
    supabase.rpc("chapter_mcq_counts", { p_class: child.class_id, p_subject: subjectId }).then(({ data }) => {
      if (active) setCounts(new Map(((data ?? []) as { chapter_id: string; n: number }[]).map((r) => [r.chapter_id, r.n])));
    });
    return () => {
      active = false;
    };
  }, [child.class_id, subjectId]);

  if (!chapters) return null;
  const chosen = mode === "book" ? new Set(chapters.map((c) => c.id)) : picked;
  const available = [...chosen].reduce((s, id) => s + (counts.get(id) ?? 0), 0);

  function toggle(c: Chapter) {
    setError("");
    if (mode === "one") return setPicked(new Set([c.id]));
    const n = new Set(picked);
    if (n.has(c.id)) n.delete(c.id);
    else n.add(c.id);
    setPicked(n);
  }

  async function start() {
    setError("");
    if (!chosen.size) return setError("Choose at least one chapter.");
    if (!available) return setError("No MCQs are added for these chapters yet. Ask your teacher, or choose other chapters.");
    setBusy(true);
    const { data, error } = await supabase.rpc("start_practice", { p_subject: subjectId, p_chapters: [...chosen], p_count: count });
    setBusy(false);
    if (error || !data) return setError("The test could not start. Try again.");
    router.push(`${base}/tests/practice?a=${data}`);
  }

  const MODES: { v: Mode; label: string }[] = [
    { v: "one", label: "One chapter" },
    { v: "many", label: "Many chapters" },
    { v: "book", label: "Whole book" },
  ];

  return (
    <section className="mt-5 rounded-[28px] border border-line bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-gold">
          <Shuffle aria-hidden className="size-5 text-ink" strokeWidth={1.75} />
        </span>
        <div>
          <h3 className="text-lg font-medium leading-tight">Make my own test</h3>
          <p lang="ur" dir="rtl" className="font-urdu text-[13px] leading-[2] text-sub">
            اپنا ٹیسٹ خود بنائیں
          </p>
        </div>
      </div>
      <div role="tablist" className="mt-4 grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m.v}
            type="button"
            role="tab"
            aria-selected={mode === m.v}
            onClick={() => {
              setMode(m.v);
              setError("");
              if (m.v === "one" && picked.size > 1) setPicked(new Set([...picked].slice(0, 1)));
            }}
            className={`h-11 rounded-full border text-sm ${mode === m.v ? "border-navy bg-navy text-white" : "border-line-strong bg-bg"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode !== "book" ? (
        <ChapterList chapters={chapters} countFor={(c) => counts.get(c.id) ?? 0} unit="MCQs" picked={picked} onToggle={toggle} />
      ) : (
        <p className="mt-4 rounded-2xl bg-bg p-4 text-sm text-sub">All {chapters.length} chapters of the book are included.</p>
      )}
      <div className="mt-4 flex items-center justify-between gap-3">
        <label htmlFor="qcount" className="text-sm text-sub">
          Number of questions
        </label>
        <select id="qcount" value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-11 rounded-xl border border-line-strong bg-bg px-3 text-base">
          {[10, 20, 30, 50].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-2 text-[13px] text-sub">
        {chosen.size ? `${available} MCQs in ${chosen.size === 1 ? "this chapter" : `these ${chosen.size} chapters`}. ` : ""}One minute for each question.
      </p>
      {error && (
        <p role="alert" className="mt-3 rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad-ink">
          {error}
        </p>
      )}
      <button type="button" disabled={busy} onClick={start} className="mt-4 h-12 w-full rounded-full bg-navy text-[15px] font-medium text-white disabled:opacity-60">
        {busy ? "Making your test" : "Start my test"}
      </button>
    </section>
  );
}

/* ---------------- Answering a paper (teacher test or practice) ---------------- */

type PaperQ = { id: string; question: string; options: string[] };

function Paper({ questions, deadline, onSubmit }: { questions: PaperQ[]; deadline: number; onSubmit: (answers: Record<string, number>) => Promise<string | null> }) {
  const [now, setNow] = useState(() => Date.now());
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sent = useRef(false);
  const latest = useRef(answers);
  useEffect(() => {
    latest.current = answers;
  });

  async function submit() {
    if (sent.current) return;
    sent.current = true;
    setBusy(true);
    setError("");
    const err = await onSubmit(latest.current);
    if (err) {
      sent.current = false;
      setBusy(false);
      setError(err);
    }
  }
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });

  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= deadline) {
        clearInterval(t);
        submitRef.current();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  const left = Math.max(0, Math.round((deadline - now) / 1000));
  const answered = Object.keys(answers).length;

  return (
    <>
      <div className="sticky top-0 z-10 -mx-5 mt-4 flex items-center justify-between bg-bg/95 px-5 py-3 backdrop-blur">
        <span className="text-sm text-sub">
          {answered} of {questions.length} answered
        </span>
        <span role="timer" aria-live="off" className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] font-medium tabular-nums text-white ${left < 60 ? "bg-bad" : "bg-navy"}`}>
          <Clock aria-hidden className="size-4" />
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </span>
      </div>
      <ol className="mt-2 flex flex-col gap-3">
        {questions.map((q, i) => (
          <li key={q.id} className="rounded-[24px] border border-line bg-white p-4">
            <p className="text-[15px] font-medium">
              <span className="text-sub">{i + 1}. </span>
              <Ur text={q.question} />
            </p>
            <div role="radiogroup" aria-label={`Question ${i + 1}`} className="mt-3 flex flex-col gap-2">
              {q.options.map((o, j) => {
                const on = answers[q.id] === j;
                return (
                  <button
                    key={j}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setAnswers({ ...answers, [q.id]: j })}
                    className={`flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-2 text-left text-[15px] ${on ? "border-navy bg-navy text-white" : "border-line-strong bg-bg"}`}
                  >
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${on ? "bg-gold text-ink" : "bg-white"}`}>{LETTERS[j]}</span>
                    <Ur text={o} />
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="mt-3 rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad-ink">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => (answered < questions.length && !window.confirm(`${questions.length - answered} questions are not answered. Submit anyway?`) ? null : submit())}
        className="mt-5 h-14 rounded-full bg-navy text-base font-medium text-white disabled:opacity-60"
      >
        {busy ? "Checking" : "Submit answers"}
      </button>
    </>
  );
}

const NOT_SENT = "Your answers were not sent. Check the internet and tap Submit again.";

// A teacher's test: start screen, then the paper.
export function TakeTest({ testId, child, base }: { testId: string } & Ctx) {
  const router = useRouter();
  const [paper, setPaper] = useState<(PaperQ & { test_title: string; minutes: number; subject: string })[] | null | undefined>(undefined);
  const [past, setPast] = useState<Attempt[]>([]);
  const [started, setStarted] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.rpc("mcq_paper", { p_test: testId }),
      supabase.from("mcq_attempts").select("id, test_id, score, total, submitted_at").eq("test_id", testId).eq("student_id", child.id).order("submitted_at", { ascending: false }),
    ]).then(([p, a]) => {
      if (!active) return;
      setPaper(p.error ? null : (p.data ?? []));
      setPast((a.data ?? []) as Attempt[]);
    });
    return () => {
      active = false;
    };
  }, [testId, child.id]);

  if (paper === undefined) return <p className="mt-6 text-sm text-sub">Loading the test</p>;
  if (!paper || !paper.length) return <p className="mt-6 text-sm text-sub">This test is closed or has no questions yet.</p>;
  const head = paper[0];

  if (started)
    return (
      <Paper
        questions={paper}
        deadline={started + head.minutes * 60_000}
        onSubmit={async (answers) => {
          const { data, error } = await supabase.rpc("submit_mcq", { p_test: testId, p_answers: answers, p_started: new Date(started).toISOString() });
          if (error || !data) return NOT_SENT;
          router.replace(`${base}/tests/review?a=${(data as { attempt_id: string }).attempt_id}`);
          return null;
        }}
      />
    );

  return (
    <>
      <section className="mt-5 rounded-[28px] bg-navy p-5 text-white">
        <p className="text-sm text-mist">{head.subject}</p>
        <h2 className="mt-1 text-2xl font-medium leading-tight">{head.test_title}</h2>
        <p className="mt-3 text-sm text-mist">
          {paper.length} questions · {head.minutes} minutes
        </p>
        <ul className="mt-4 flex flex-col gap-1.5 text-sm text-mist">
          <li>• Tap one answer for each question.</li>
          <li>• The test sends itself when time is up.</li>
          <li>• You see your score and the right answers at the end.</li>
        </ul>
        <button type="button" onClick={() => setStarted(Date.now())} className="mt-5 h-12 w-full rounded-full bg-gold text-[15px] font-medium text-ink">
          {past.length ? "Practise again" : "Start the test"}
        </button>
      </section>
      {past.length > 0 && (
        <section className="mt-5">
          <h3 className="text-base font-medium">Your tries</h3>
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-white">
            {past.map((a) => (
              <li key={a.id}>
                <Link href={`${base}/tests/review?a=${a.id}`} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-sub">{new Date(a.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                  <span className="flex items-center gap-2 text-[15px] font-medium tabular-nums">
                    {a.score}/{a.total}
                    <ChevronRight aria-hidden className="size-[18px] text-sub" strokeWidth={1.75} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// A test the student made. It starts as soon as it is made.
export function TakePractice({ attemptId, base }: { attemptId: string; base: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<(PaperQ & { minutes: number; started_at: string; submitted: boolean; subject: string })[] | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    supabase.rpc("practice_paper", { p_attempt: attemptId }).then(({ data, error }) => {
      if (!active) return;
      const list = error ? null : (data ?? []);
      if (list?.[0]?.submitted) router.replace(`${base}/tests/review?p=${attemptId}`);
      else setRows(list);
    });
    return () => {
      active = false;
    };
  }, [attemptId, base, router]);

  if (rows === undefined) return <p className="mt-6 text-sm text-sub">Loading your test</p>;
  if (!rows || !rows.length) return <p className="mt-6 text-sm text-sub">This test was not found.</p>;
  const head = rows[0];
  return (
    <>
      <p className="mt-4 text-sm text-sub">
        {head.subject} · {rows.length} questions · {head.minutes} minutes
      </p>
      <Paper
        questions={rows}
        deadline={new Date(head.started_at).getTime() + head.minutes * 60_000}
        onSubmit={async (answers) => {
          const { error } = await supabase.rpc("submit_practice", { p_attempt: attemptId, p_answers: answers });
          if (error) return NOT_SENT;
          router.replace(`${base}/tests/review?p=${attemptId}`);
          return null;
        }}
      />
    </>
  );
}

/* ---------------- Result with right answers ---------------- */

type ReviewQ = { id: string; question: string; options: string[]; correct: number; chosen: number | null; explanation: string | null };

export function Review({ attemptId, practiceId, base }: { attemptId?: string | null; practiceId?: string | null; base: string }) {
  const [rows, setRows] = useState<ReviewQ[] | null | undefined>(undefined);
  const [again, setAgain] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (practiceId) {
        const [r, a] = await Promise.all([supabase.rpc("practice_review", { p_attempt: practiceId }), supabase.from("practice_attempts").select("subject_id").eq("id", practiceId).maybeSingle()]);
        if (!active) return;
        setRows(r.error ? null : ((r.data ?? []) as ReviewQ[]));
        setAgain(a.data ? `${base}/tests?s=${a.data.subject_id}` : null);
      } else if (attemptId) {
        const [r, a] = await Promise.all([supabase.rpc("mcq_review", { p_attempt: attemptId }), supabase.from("mcq_attempts").select("test_id").eq("id", attemptId).maybeSingle()]);
        if (!active) return;
        setRows(r.error ? null : ((r.data ?? []) as ReviewQ[]));
        setAgain(a.data ? `${base}/tests/${a.data.test_id}` : null);
      } else setRows(null);
    })();
    return () => {
      active = false;
    };
  }, [attemptId, practiceId, base]);

  if (rows === undefined) return <p className="mt-6 text-sm text-sub">Loading</p>;
  if (!rows || !rows.length) return <p className="mt-6 text-sm text-sub">This result was not found.</p>;
  const score = rows.filter((r) => r.chosen === r.correct).length;
  const p = Math.round((score / rows.length) * 100);

  return (
    <>
      <section className="mt-5 rounded-[28px] bg-navy p-5 text-white">
        <p className="text-sm text-mist">Score</p>
        <p className="mt-1 text-[48px] font-medium leading-none tabular-nums">
          {score}
          <span className="text-[22px] text-mist">/{rows.length}</span>
        </p>
        <p className="mt-1 text-sm text-mist">{p >= 80 ? `${p}% — excellent!` : p >= 50 ? `${p}% — good, keep practising` : `${p}% — read the chapter again and retry`}</p>
        {base === "/student" && again && (
          <Link href={again} className="mt-4 flex h-12 items-center justify-center rounded-full bg-gold text-[15px] font-medium text-ink">
            {practiceId ? "Make another test" : "Practise again"}
          </Link>
        )}
      </section>
      <ol className="mt-5 flex flex-col gap-3">
        {rows.map((q, i) => {
          const right = q.chosen === q.correct;
          return (
            <li key={q.id} className="rounded-[24px] border border-line bg-white p-4">
              <p className="flex gap-2 text-[15px] font-medium">
                {right ? <Check aria-label="Correct" className="size-5 shrink-0 text-ok" /> : <X aria-label="Wrong" className="size-5 shrink-0 text-bad" />}
                <span>
                  {i + 1}. <Ur text={q.question} />
                </span>
              </p>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {q.options.map((o, j) => (
                  <li key={j} className={`rounded-xl px-3 py-2 ${j === q.correct ? "bg-ok text-white" : j === q.chosen ? "bg-bad-soft text-bad-ink" : "text-sub"}`}>
                    {LETTERS[j]}) <Ur text={o} />
                    {j === q.correct ? " — right answer" : j === q.chosen ? " — your answer" : ""}
                  </li>
                ))}
              </ul>
              {q.chosen === null && <p className="mt-2 text-sm text-bad-ink">Not answered</p>}
              {q.explanation && (
                <p className="mt-2 text-sm text-sub">
                  <Ur text={q.explanation} />
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

/* ---------------- Video lectures: subject → chapter → videos ---------------- */

type Lecture = { id: string; subject_id: string; chapter_id: string | null; title: string; youtube_id: string; description: string | null };

export function LecturesHub({ ctx, subjectId, chapterId }: { ctx: Ctx; subjectId: string | null; chapterId: string | null }) {
  const { child, base } = ctx;
  const subjects = useClassSubjects(child.class_id);
  const chapters = useChapters(child.class_id, subjectId);
  const [rows, setRows] = useState<Lecture[] | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!child.class_id) {
        if (active) setRows([]);
        return;
      }
      const { data } = await supabase.from("video_lectures").select("id, subject_id, chapter_id, title, youtube_id, description").eq("class_id", child.class_id).order("created_at");
      if (active) setRows((data ?? []) as Lecture[]);
    })();
    return () => {
      active = false;
    };
  }, [child.class_id]);

  if (!subjects || !rows) return <p className="mt-6 text-sm text-sub">Loading</p>;
  const subject = subjects.find((s) => s.id === subjectId);
  const href = (p: Record<string, string | null>) => `${base}/lectures${qs(p)}`;

  if (!subject)
    return (
      <SubjectGrid
        subjects={subjects}
        hrefFor={(s) => href({ s: s.id })}
        noteFor={(s) => {
          const n = rows.filter((r) => r.subject_id === s.id).length;
          return n ? `${n} ${n === 1 ? "video" : "videos"}` : "No videos yet";
        }}
      />
    );

  const mine = rows.filter((r) => r.subject_id === subject.id);
  if (!chapters) return <p className="mt-6 text-sm text-sub">Loading chapters</p>;
  const twoBooks = new Set(chapters.map((c) => c.grade)).size > 1;
  const loose = mine.filter((r) => !r.chapter_id || !chapters.some((c) => c.id === r.chapter_id));

  if (!chapterId)
    return (
      <>
        <BackRow href={href({})} label="All subjects" />
        <SubjectHeader name={subject.name} line={`${mine.length} ${mine.length === 1 ? "video" : "videos"} · tap a chapter`} />
        <ChapterList chapters={chapters} countFor={(c) => mine.filter((r) => r.chapter_id === c.id).length} hrefFor={(c) => href({ s: subject.id, c: c.id })} />
        {loose.length > 0 && (
          <Link href={href({ s: subject.id, c: "other" })} className="mt-3 flex min-h-14 items-center justify-between rounded-3xl border border-line bg-white px-4 text-[15px]">
            Other videos ({loose.length})
            <ChevronRight aria-hidden className="size-4 text-sub" strokeWidth={1.75} />
          </Link>
        )}
      </>
    );

  const chapter = chapters.find((c) => c.id === chapterId);
  const list = chapterId === "other" ? loose : mine.filter((r) => r.chapter_id === chapterId);
  return (
    <>
      <BackRow href={href({ s: subject.id })} label="Chapters" />
      <SubjectHeader name={subject.name} />
      {chapter ? <ChapterHeader chapter={chapter} showGrade={twoBooks} /> : <p className="mt-4 text-[15px] font-medium">Other videos</p>}
      {list.length === 0 ? (
        <p className="mt-3 rounded-3xl border border-line bg-white p-4 text-sm text-sub">No videos for this chapter yet. Your teacher will add them.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {list.map((l) => (
            <li key={l.id} className="overflow-hidden rounded-[24px] border border-line bg-white">
              {playing === l.id ? (
                <iframe src={embedUrl(l.youtube_id)} title={l.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" />
              ) : (
                <button type="button" onClick={() => setPlaying(l.id)} className="relative block w-full" aria-label={`Play ${l.title}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbUrl(l.youtube_id)} alt="" className="aspect-video w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/20">
                    <PlayCircle aria-hidden className="size-14 text-white" strokeWidth={1.5} />
                  </span>
                </button>
              )}
              <div className="p-4">
                <p className="text-[15px] font-medium">
                  <Ur text={l.title} />
                </p>
                {l.description && (
                  <p className="mt-1 text-sm text-sub">
                    <Ur text={l.description} />
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ---------------- Student home card ---------------- */

export function NextTestCard({ child, base }: Ctx) {
  const [next, setNext] = useState<McqTest | null | undefined>(undefined);
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    loadMcq(child).then(({ tests, attempts }) => {
      if (!active) return;
      const done = new Set(attempts.map((a) => a.test_id));
      const todo = tests.filter((t) => !done.has(t.id));
      setNext(todo[0] ?? null);
      setCount(todo.length);
    });
    return () => {
      active = false;
    };
  }, [child]);
  return (
    <Link href={next ? `${base}/tests/${next.id}` : `${base}/tests`} className="mt-3 flex items-center gap-3.5 rounded-3xl border border-line bg-white p-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold">
        <Clock aria-hidden className="size-5 text-ink" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-sub">{next ? (count > 1 ? `${count} online tests waiting` : "Online test waiting") : "Online MCQ tests"}</span>
        <span className="block truncate text-[15px] font-medium">{next ? `${next.subjects?.name} · ${next.title}` : "Make a test from any chapter"}</span>
      </span>
      <span className="shrink-0 text-sm font-medium text-navy">Practice now</span>
    </Link>
  );
}
