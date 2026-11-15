"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, Library, ListChecks, MessageSquareText, ScrollText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { classGrades, type Chapter } from "@/lib/chapters";
import { LETTERS } from "@/lib/mcq";
import { ChapterHeader, ChapterList, OptionGrid, SubjectGrid, SubjectHeader, Ur, qs, useChapters, useClassSubjects } from "@/components/learn/kit";
import { BackRow } from "./learn";
import type { Ctx } from "./shell";

export type Kind = "short" | "long" | "mcq" | "ebook";
const KINDS: Record<Kind, { label: string; urdu: string; Icon: typeof Library; bg: string; fg: string }> = {
  short: { label: "Short questions", urdu: "مختصر سوالات", Icon: MessageSquareText, bg: "#E4ECFA", fg: "#2856A8" },
  long: { label: "Long questions", urdu: "تفصیلی سوالات", Icon: ScrollText, bg: "#F3E6F7", fg: "#7B3A96" },
  mcq: { label: "Practice MCQs", urdu: "معروضی سوالات", Icon: ListChecks, bg: "#E3F2EA", fg: "#1F7A4D" },
  ebook: { label: "E-books", urdu: "درسی کتابیں", Icon: Library, bg: "#FCEBDD", fg: "#B4561A" },
};

type Ebook = { id: string; grade: number; title: string; url: string; source: string };
type StudyQ = { id: string; chapter_id: string; kind: "short" | "long"; question: string; answer: string };
const isPreview = (u: string) => /drive\.google\.com\/file\/d\/[^/]+\/preview/.test(u);

export function ResourcesHub({ ctx, subjectId, kind, chapterId, bookId }: { ctx: Ctx; subjectId: string | null; kind: Kind | null; chapterId: string | null; bookId: string | null }) {
  const { child, base } = ctx;
  const subjects = useClassSubjects(child.class_id);
  const chapters = useChapters(child.class_id, subjectId);
  const [books, setBooks] = useState<Ebook[] | null>(null);
  const [qs_, setQs] = useState<StudyQ[] | null>(null);
  const [mcqCounts, setMcqCounts] = useState<Map<string, number>>(new Map());

  const href = (p: Record<string, string | null>) => `${base}/resources${qs(p)}`;

  useEffect(() => {
    let active = true;
    if (!child.class_id || !subjectId) return;
    (async () => {
      const grades = await classGrades(child.class_id!);
      const [b, m] = await Promise.all([
        supabase.from("ebooks").select("id, grade, title, url, source").eq("subject_id", subjectId).in("grade", grades.length ? grades : [0]).order("grade").order("title"),
        supabase.rpc("bank_mcq_counts", { p_class: child.class_id, p_subject: subjectId }),
      ]);
      if (!active) return;
      setBooks((b.data ?? []) as Ebook[]);
      setMcqCounts(new Map(((m.data ?? []) as { chapter_id: string; n: number }[]).map((r) => [r.chapter_id, r.n])));
    })();
    return () => {
      active = false;
    };
  }, [child.class_id, subjectId]);

  useEffect(() => {
    let active = true;
    if (!chapters) return;
    const ids = chapters.map((c) => c.id);
    if (!ids.length) {
      Promise.resolve().then(() => active && setQs([]));
      return;
    }
    supabase
      .from("study_questions")
      .select("id, chapter_id, kind, question, answer")
      .in("chapter_id", ids)
      .order("position")
      .order("created_at")
      .then(({ data }) => active && setQs((data ?? []) as StudyQ[]));
    return () => {
      active = false;
    };
  }, [chapters]);

  if (!subjects) return <p className="mt-6 text-sm text-sub">Loading</p>;
  const subject = subjects.find((s) => s.id === subjectId);

  if (!subject)
    return (
      <>
        <section className="mt-5 rounded-[28px] bg-navy p-5 text-white">
          <p className="text-sm text-mist">Study resources</p>
          <p className="mt-1 text-lg font-medium leading-snug">Short and long questions, practice MCQs and your textbooks, chapter by chapter.</p>
        </section>
        <SubjectGrid subjects={subjects} hrefFor={(s) => href({ s: s.id })} />
      </>
    );

  if (!chapters || !books || !qs_) return <p className="mt-6 text-sm text-sub">Loading</p>;
  const twoBooks = new Set(chapters.map((c) => c.grade)).size > 1;
  const count = (k: "short" | "long", c?: Chapter) => qs_.filter((q) => q.kind === k && (!c || q.chapter_id === c.id)).length;
  const mcqTotal = [...mcqCounts.values()].reduce((a, b) => a + b, 0);

  if (!kind)
    return (
      <>
        <BackRow href={href({})} label="All subjects" />
        <SubjectHeader name={subject.name} line="What do you want to study?" />
        <OptionGrid
          items={(Object.keys(KINDS) as Kind[]).map((k) => ({
            href: href({ s: subject.id, k }),
            ...KINDS[k],
            note: k === "ebook" ? `${books.length} ${books.length === 1 ? "book" : "books"}` : k === "mcq" ? `${mcqTotal} MCQs` : `${count(k)} questions`,
          }))}
        />
      </>
    );

  const info = KINDS[kind];

  if (kind === "ebook") {
    const book = books.find((b) => b.id === bookId);
    if (book)
      return (
        <>
          <BackRow href={href({ s: subject.id, k: "ebook" })} label="E-books" />
          <p className="mt-4 text-[15px] font-medium">
            <Ur text={book.title} />
          </p>
          {isPreview(book.url) ? (
            <iframe src={book.url} title={book.title} allow="autoplay" className="mt-3 h-[75vh] w-full rounded-2xl border border-line bg-white" />
          ) : null}
          <a href={book.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex h-12 items-center justify-center gap-2 rounded-full border border-line-strong bg-white text-[15px] font-medium">
            Open in a new tab
            <ExternalLink aria-hidden className="size-4" strokeWidth={1.75} />
          </a>
          <p className="mt-2 text-[13px] text-sub">{book.source}</p>
        </>
      );
    return (
      <>
        <BackRow href={href({ s: subject.id })} label={subject.name} />
        <SubjectHeader name={subject.name} line={info.label} />
        {books.length === 0 ? (
          <p className="mt-4 rounded-3xl border border-line bg-white p-4 text-sm text-sub">This book is not added yet. Every Punjab textbook is free on the official PCTB website below.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {books.map((b) => (
              <li key={b.id}>
                <Link href={href({ s: subject.id, k: "ebook", b: b.id })} className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: info.bg, color: info.fg }}>
                    <Library aria-hidden className="size-6" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">
                      <Ur text={b.title} />
                    </span>
                    <span className="block text-[13px] text-sub">{twoBooks ? `Class ${b.grade} book · ` : ""}Tap to read</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <a href="https://pctb.punjab.gov.pk/E-Books" target="_blank" rel="noopener noreferrer" className="mt-4 flex h-12 items-center justify-center gap-2 rounded-full border border-line-strong bg-white text-[15px]">
          All books on the official PCTB website
          <ExternalLink aria-hidden className="size-4" strokeWidth={1.75} />
        </a>
      </>
    );
  }

  if (!chapterId)
    return (
      <>
        <BackRow href={href({ s: subject.id })} label={subject.name} />
        <SubjectHeader name={subject.name} line={`${info.label} · choose a chapter`} />
        <ChapterList chapters={chapters} countFor={(c) => (kind === "mcq" ? mcqCounts.get(c.id) ?? 0 : count(kind, c))} hrefFor={(c) => href({ s: subject.id, k: kind, c: c.id })} />
      </>
    );

  const chapter = chapters.find((c) => c.id === chapterId);
  return (
    <>
      <BackRow href={href({ s: subject.id, k: kind })} label="Chapters" />
      <SubjectHeader name={subject.name} line={info.label} />
      <ChapterHeader chapter={chapter} showGrade={twoBooks} />
      {kind === "mcq" ? (
        <PracticeMcqs chapterId={chapterId} />
      ) : (
        <QuestionList list={qs_.filter((q) => q.kind === kind && q.chapter_id === chapterId)} />
      )}
    </>
  );
}

function QuestionList({ list }: { list: StudyQ[] }) {
  if (!list.length) return <p className="mt-3 rounded-3xl border border-line bg-white p-4 text-sm text-sub">No questions for this chapter yet. Your teacher will add them.</p>;
  return (
    <ol className="mt-3 flex flex-col gap-2">
      {list.map((q, i) => (
        <li key={q.id}>
          <details className="group rounded-[24px] border border-line bg-white p-4 open:border-line-strong">
            <summary className="flex cursor-pointer list-none items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bg text-[13px] font-medium tabular-nums text-navy">{i + 1}</span>
              <span className="min-w-0 flex-1 text-[15px] font-medium">
                <Ur text={q.question} />
              </span>
              <ChevronDown aria-hidden className="mt-1 size-4 shrink-0 text-sub transition-transform group-open:rotate-180" strokeWidth={1.75} />
            </summary>
            {q.answer ? (
              <p className="mt-3 whitespace-pre-line border-t border-line pt-3 text-[15px] leading-relaxed text-ink/90">
                <Ur text={q.answer} />
              </p>
            ) : (
              <p className="mt-3 border-t border-line pt-3 text-sm text-sub">No answer written yet.</p>
            )}
          </details>
        </li>
      ))}
    </ol>
  );
}

type PQ = { id: string; question: string; options: string[]; correct: number; explanation: string | null };

// One question at a time. Tap an answer to see if it is right.
function PracticeMcqs({ chapterId }: { chapterId: string }) {
  const [list, setList] = useState<PQ[] | null>(null);
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<Record<number, number>>({});

  useEffect(() => {
    let active = true;
    supabase.rpc("practice_mcqs", { p_chapter: chapterId }).then(({ data }) => active && setList((data ?? []) as PQ[]));
    return () => {
      active = false;
    };
  }, [chapterId]);

  if (!list) return <p className="mt-4 text-sm text-sub">Loading</p>;
  if (!list.length) return <p className="mt-3 rounded-3xl border border-line bg-white p-4 text-sm text-sub">No practice MCQs for this chapter yet. Your teacher will add them.</p>;
  const q = list[i];
  const pick = chosen[i];
  const right = Object.entries(chosen).filter(([k, v]) => list[Number(k)].correct === v).length;
  const done = Object.keys(chosen).length;

  return (
    <>
      <div className="mt-3 flex items-center justify-between text-sm text-sub">
        <span>
          Question {i + 1} of {list.length}
        </span>
        <span className="tabular-nums">
          {right}/{done} right
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-navy transition-all" style={{ width: `${((i + 1) / list.length) * 100}%` }} />
      </div>
      <section className="mt-3 rounded-[24px] border border-line bg-white p-4">
        <p className="text-[16px] font-medium">
          <Ur text={q.question} />
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {q.options.map((o, j) => {
            const shown = pick !== undefined;
            const isRight = j === q.correct;
            const cls = !shown ? "border-line-strong bg-bg" : isRight ? "border-ok bg-ok text-white" : j === pick ? "border-bad bg-bad-soft text-bad-ink" : "border-line bg-white text-sub";
            return (
              <button key={j} type="button" disabled={shown} onClick={() => setChosen({ ...chosen, [i]: j })} className={`flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-2 text-left text-[15px] ${cls}`}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-medium text-ink">{LETTERS[j]}</span>
                <Ur text={o} />
              </button>
            );
          })}
        </div>
        {pick !== undefined && (
          <p className={`mt-3 text-sm ${pick === q.correct ? "text-ok" : "text-bad-ink"}`}>
            {pick === q.correct ? "Correct!" : `Not right. The answer is ${LETTERS[q.correct]}.`}
            {q.explanation && (
              <span className="mt-1 block text-sub">
                <Ur text={q.explanation} />
              </span>
            )}
          </p>
        )}
      </section>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="h-12 rounded-full border border-line-strong bg-white text-[15px] disabled:opacity-40">
          Back
        </button>
        {i < list.length - 1 ? (
          <button type="button" onClick={() => setI(i + 1)} className="h-12 rounded-full bg-navy text-[15px] font-medium text-white">
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setChosen({});
              setI(0);
            }}
            className="h-12 rounded-full bg-gold text-[15px] font-medium text-ink"
          >
            Start again
          </button>
        )}
      </div>
    </>
  );
}
