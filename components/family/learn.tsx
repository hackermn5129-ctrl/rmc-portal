"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Clock, PlayCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Child } from "@/lib/family";
import { chapterLabel, groupByChapter, isUrdu, loadChaptersByIds, type Chapter } from "@/lib/chapters";
import { LETTERS, embedUrl, thumbUrl } from "@/lib/mcq";
import type { Ctx } from "./shell";

const dirOf = (s: string) => (isUrdu(s) ? "rtl" : undefined);
const Ur = ({ text, className = "" }: { text: string; className?: string }) => (
  <span lang={isUrdu(text) ? "ur" : undefined} dir={dirOf(text)} className={`${isUrdu(text) ? "font-urdu leading-[2]" : ""} ${className}`}>
    {text}
  </span>
);

type McqTest = { id: string; subject_id: string; chapter_id: string | null; title: string; minutes: number; created_at: string; subjects: { name: string } | null; mcq_questions: { count: number }[] };
type Attempt = { id: string; test_id: string; score: number; total: number; submitted_at: string };

export async function loadMcq(child: Child) {
  if (!child.class_id) return { tests: [] as McqTest[], attempts: [] as Attempt[], chapters: new Map<string, Chapter>() };
  const [t, a] = await Promise.all([
    supabase
      .from("mcq_tests")
      .select("id, subject_id, chapter_id, title, minutes, created_at, subjects(name), mcq_questions(count)")
      .eq("class_id", child.class_id)
      .eq("published", true)
      .order("created_at", { ascending: false }),
    supabase.from("mcq_attempts").select("id, test_id, score, total, submitted_at").eq("student_id", child.id).order("submitted_at", { ascending: false }),
  ]);
  const tests = (t.data ?? []) as unknown as McqTest[];
  const chapters = await loadChaptersByIds(tests.map((x) => x.chapter_id ?? ""));
  return { tests, attempts: (a.data ?? []) as Attempt[], chapters };
}

const pctTone = (p: number) => (p >= 80 ? "text-ok" : p >= 50 ? "text-warn" : "text-bad");

// All open MCQ tests of the class, by subject and book chapter, with this child's best score.
export function McqList({ child, base }: Ctx) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadMcq>> | null>(null);
  const [subject, setSubject] = useState("all");
  const isStudent = base === "/student";

  useEffect(() => {
    let active = true;
    loadMcq(child).then((d) => active && setData(d));
    return () => {
      active = false;
    };
  }, [child]);

  if (!data) return <p className="mt-6 text-sm text-sub">Loading tests</p>;
  const { tests, attempts, chapters } = data;
  if (!tests.length)
    return (
      <div className="mt-5 rounded-[28px] bg-navy p-5 text-white">
        <h2 className="text-xl font-medium">No online tests yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-mist">When a teacher opens an MCQ test for this class, it shows here.</p>
      </div>
    );

  const subjects = [...new Map(tests.map((t) => [t.subject_id, t.subjects?.name ?? ""])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const shown = subject === "all" ? tests : tests.filter((t) => t.subject_id === subject);
  const bySubject = subjects.filter(([id]) => shown.some((t) => t.subject_id === id));
  const twoBooks = new Set([...chapters.values()].map((c) => c.grade)).size > 1;
  const done = new Set(attempts.map((a) => a.test_id));
  const todo = tests.filter((t) => !done.has(t.id)).length;

  return (
    <>
      <section className="mt-5 rounded-[28px] bg-navy p-5 text-white">
        <p className="text-sm text-mist">Online MCQ tests</p>
        <p className="mt-1 text-[34px] font-medium leading-none tabular-nums">
          {tests.length - todo}
          <span className="text-lg text-mist">/{tests.length}</span>
        </p>
        <p className="mt-1 text-sm text-mist">{todo ? `${todo} not taken yet` : "All tests taken. Well done!"}</p>
      </section>

      {subjects.length > 1 && (
        <div role="tablist" aria-label="Subject" className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {[["all", "All"] as [string, string], ...subjects].map(([id, name]) => (
            <button key={id} type="button" role="tab" aria-selected={subject === id} onClick={() => setSubject(id)} className={`shrink-0 rounded-full border px-4 py-2 text-sm ${subject === id ? "border-navy bg-navy text-white" : "border-line-strong bg-white"}`}>
              {name}
            </button>
          ))}
        </div>
      )}

      {bySubject.map(([sid, sname]) => (
        <section key={sid} className="mt-5">
          <h2 className="text-lg font-medium">{sname}</h2>
          {groupByChapter(
            shown.filter((t) => t.subject_id === sid),
            chapters,
          ).map((g) => (
            <div key={g.chapter?.id ?? "none"} className="mt-3">
              <h3 className="text-sm text-sub">
                <Ur text={chapterLabel(g.chapter, twoBooks)} />
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {g.items.map((t) => {
                  const mine = attempts.filter((a) => a.test_id === t.id);
                  const best = mine.reduce<Attempt | null>((b, a) => (!b || a.score / Math.max(a.total, 1) > b.score / Math.max(b.total, 1) ? a : b), null);
                  const p = best ? Math.round((best.score / Math.max(best.total, 1)) * 100) : null;
                  const q = t.mcq_questions[0]?.count ?? 0;
                  const body = (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium">{t.title}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-[13px] text-sub">
                          <Clock aria-hidden className="size-3.5" /> {t.minutes} min · {q} questions
                          {mine.length > 1 ? ` · tried ${mine.length} times` : ""}
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
        </section>
      ))}
    </>
  );
}

type PaperQ = { id: string; question: string; options: string[]; test_title: string; minutes: number; subject: string };

// Start screen → questions with a timer → score. Answers are checked on the server.
export function TakeTest({ testId, child, base }: { testId: string } & Ctx) {
  const router = useRouter();
  const [paper, setPaper] = useState<PaperQ[] | null | undefined>(undefined);
  const [past, setPast] = useState<Attempt[]>([]);
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sent = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.rpc("mcq_paper", { p_test: testId }),
      supabase.from("mcq_attempts").select("id, test_id, score, total, submitted_at").eq("test_id", testId).eq("student_id", child.id).order("submitted_at", { ascending: false }),
    ]).then(([p, a]) => {
      if (!active) return;
      setPaper(p.error ? null : ((p.data ?? []) as PaperQ[]));
      setPast((a.data ?? []) as Attempt[]);
    });
    return () => {
      active = false;
    };
  }, [testId, child.id]);

  const minutes = paper?.[0]?.minutes ?? 0;
  const left = started ? Math.max(0, Math.round(minutes * 60 - (now - started) / 1000)) : minutes * 60;

  async function submit() {
    if (sent.current || !started) return;
    sent.current = true;
    setBusy(true);
    setError("");
    const { data, error } = await supabase.rpc("submit_mcq", { p_test: testId, p_answers: answers, p_started: new Date(started).toISOString() });
    setBusy(false);
    if (error || !data) {
      sent.current = false;
      return setError("Your answers were not sent. Check the internet and tap Submit again.");
    }
    router.replace(`${base}/tests/review?a=${(data as { attempt_id: string }).attempt_id}`);
  }

  // The clock. When time is up, the answers are sent.
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    if (!started) return;
    const end = started + minutes * 60 * 1000;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= end) {
        clearInterval(t);
        submitRef.current();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [started, minutes]);

  if (paper === undefined) return <p className="mt-6 text-sm text-sub">Loading the test</p>;
  if (!paper || !paper.length) return <p className="mt-6 text-sm text-sub">This test is closed or has no questions yet.</p>;
  const head = paper[0];
  const answered = Object.keys(answers).length;

  if (!started)
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
          <button
            type="button"
            onClick={() => {
              const t = Date.now();
              setStarted(t);
              setNow(t);
            }}
            className="mt-5 h-12 w-full rounded-full bg-gold text-[15px] font-medium text-ink"
          >
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

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");

  return (
    <>
      <div className="sticky top-0 z-10 -mx-5 mt-4 flex items-center justify-between bg-bg/95 px-5 py-3 backdrop-blur">
        <span className="text-sm text-sub">
          {answered} of {paper.length} answered
        </span>
        <span role="timer" aria-live="off" className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] font-medium tabular-nums ${left < 60 ? "bg-bad text-white" : "bg-navy text-white"}`}>
          <Clock aria-hidden className="size-4" />
          {mm}:{ss}
        </span>
      </div>
      <ol className="mt-2 flex flex-col gap-3">
        {paper.map((q, i) => (
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
      <button type="button" disabled={busy} onClick={() => (answered < paper.length && !window.confirm(`${paper.length - answered} questions are not answered. Submit anyway?`) ? null : submit())} className="mt-5 h-14 rounded-full bg-navy text-base font-medium text-white disabled:opacity-60">
        {busy ? "Checking" : "Submit answers"}
      </button>
    </>
  );
}

type ReviewQ = { id: string; question: string; options: string[]; correct: number; chosen: number | null; explanation: string | null };

export function Review({ attemptId, base }: { attemptId: string; base: string }) {
  const [rows, setRows] = useState<ReviewQ[] | null | undefined>(undefined);
  const [testId, setTestId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([supabase.rpc("mcq_review", { p_attempt: attemptId }), supabase.from("mcq_attempts").select("test_id").eq("id", attemptId).maybeSingle()]).then(([r, a]) => {
      if (!active) return;
      setRows(r.error ? null : ((r.data ?? []) as ReviewQ[]));
      setTestId(a.data?.test_id ?? null);
    });
    return () => {
      active = false;
    };
  }, [attemptId]);

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
        {base === "/student" && testId && (
          <Link href={`${base}/tests/${testId}`} className="mt-4 flex h-12 items-center justify-center rounded-full bg-gold text-[15px] font-medium text-ink">
            Practise again
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

type Lecture = { id: string; subject_id: string; chapter_id: string | null; title: string; youtube_id: string; description: string | null; created_at: string; subjects: { name: string } | null };

// Video lectures of the class, by subject and book chapter. Tap one to play it here.
export function Lectures({ child }: Ctx) {
  const [rows, setRows] = useState<Lecture[] | null>(null);
  const [chapters, setChapters] = useState<Map<string, Chapter>>(new Map());
  const [subject, setSubject] = useState("all");
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!child.class_id) {
        if (active) setRows([]);
        return;
      }
      const { data } = await supabase
        .from("video_lectures")
        .select("id, subject_id, chapter_id, title, youtube_id, description, created_at, subjects(name)")
        .eq("class_id", child.class_id)
        .order("created_at", { ascending: false });
      const list = (data ?? []) as unknown as Lecture[];
      const ch = await loadChaptersByIds(list.map((l) => l.chapter_id ?? ""));
      if (!active) return;
      setRows(list);
      setChapters(ch);
    })();
    return () => {
      active = false;
    };
  }, [child.class_id]);

  if (!rows) return <p className="mt-6 text-sm text-sub">Loading videos</p>;
  if (!rows.length)
    return (
      <div className="mt-5 rounded-[28px] bg-navy p-5 text-white">
        <h2 className="text-xl font-medium">No videos yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-mist">Your teachers will add video lessons for each chapter. They show here.</p>
      </div>
    );

  const subjects = [...new Map(rows.map((t) => [t.subject_id, t.subjects?.name ?? ""])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const shown = subject === "all" ? rows : rows.filter((t) => t.subject_id === subject);
  const twoBooks = new Set([...chapters.values()].map((c) => c.grade)).size > 1;

  return (
    <>
      {subjects.length > 1 && (
        <div role="tablist" aria-label="Subject" className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {[["all", "All"] as [string, string], ...subjects].map(([id, name]) => (
            <button key={id} type="button" role="tab" aria-selected={subject === id} onClick={() => setSubject(id)} className={`shrink-0 rounded-full border px-4 py-2 text-sm ${subject === id ? "border-navy bg-navy text-white" : "border-line-strong bg-white"}`}>
              {name}
            </button>
          ))}
        </div>
      )}
      {subjects
        .filter(([id]) => shown.some((l) => l.subject_id === id))
        .map(([sid, sname]) => (
          <section key={sid} className="mt-5">
            <h2 className="text-lg font-medium">{sname}</h2>
            {groupByChapter(
              shown.filter((l) => l.subject_id === sid),
              chapters,
            ).map((g) => (
              <div key={g.chapter?.id ?? "none"} className="mt-3">
                <h3 className="text-sm text-sub">
                  <Ur text={chapterLabel(g.chapter, twoBooks)} />
                </h3>
                <ul className="mt-2 flex flex-col gap-3">
                  {g.items.map((l) => (
                    <li key={l.id} className="overflow-hidden rounded-[24px] border border-line bg-white">
                      {playing === l.id ? (
                        <iframe
                          src={embedUrl(l.youtube_id)}
                          title={l.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="aspect-video w-full"
                        />
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
              </div>
            ))}
          </section>
        ))}
    </>
  );
}

// For the student home page: the newest test not taken yet.
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
  if (!next) return null;
  return (
    <Link href={`${base}/tests/${next.id}`} className="mt-3 flex items-center gap-3.5 rounded-3xl border border-line bg-white p-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold">
        <Clock aria-hidden className="size-5 text-ink" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-sub">{count > 1 ? `${count} online tests waiting` : "Online test waiting"}</span>
        <span className="block truncate text-[15px] font-medium">
          {next.subjects?.name} · {next.title}
        </span>
      </span>
      <span className="shrink-0 text-sm font-medium text-navy">Practice now</span>
    </Link>
  );
}
