import { Star } from "lucide-react";

// How often a question came in board papers.
// More than 10 times: most important (red, 3 stars). 5 to 10 times: important (gold, 1 star).
export type Level = "top" | "high" | "normal";
export const levelOf = (n: number): Level => (n > 10 ? "top" : n >= 5 ? "high" : "normal");

export const LEVEL_INFO: Record<Level, { title: string; note: string }> = {
  top: { title: "Most important", note: "Asked more than 10 times in board papers" },
  high: { title: "Important", note: "Asked 5 to 10 times in board papers" },
  normal: { title: "Other questions", note: "Asked less than 5 times" },
};

export function AskedBadge({ n }: { n: number }) {
  const level = levelOf(n);
  const style =
    level === "top"
      ? { background: "#FDE3E1", color: "#B3261E", boxShadow: "inset 0 0 0 1.5px #E0574F" }
      : level === "high"
        ? { background: "#FBF0D2", color: "#8A6100", boxShadow: "inset 0 0 0 1.5px #E0B43C" }
        : { background: "#EEF1F5", color: "#4A5568" };
  const stars = level === "top" ? 3 : level === "high" ? 1 : 0;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums" style={style} title={`Asked ${n} ${n === 1 ? "time" : "times"} in board papers`}>
      {Array.from({ length: stars }, (_, i) => (
        <Star key={i} aria-hidden className="size-3" fill="currentColor" strokeWidth={0} />
      ))}
      Asked {n}×
    </span>
  );
}

// Border colour for a whole question card.
export const cardBorder = (n: number) => {
  const level = levelOf(n);
  return level === "top" ? "#E0574F" : level === "high" ? "#E0B43C" : undefined;
};

export function LevelHeading({ level, count }: { level: Level; count: number }) {
  const info = LEVEL_INFO[level];
  const color = level === "top" ? "#B3261E" : level === "high" ? "#8A6100" : "#4A5568";
  return (
    <div className="mt-5 flex items-baseline justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-[15px] font-semibold" style={{ color }}>
        {level !== "normal" &&
          Array.from({ length: level === "top" ? 3 : 1 }, (_, i) => <Star key={i} aria-hidden className="size-4" fill="currentColor" strokeWidth={0} />)}
        {info.title}
      </h3>
      <span className="text-[12px] text-sub">
        {info.note} · {count}
      </span>
    </div>
  );
}

// Short list of papers: first few, then "and N more".
export function sourcesLine(src: string[] | null | undefined, max = 4) {
  if (!src?.length) return "";
  const head = src.slice(0, max).join(" · ");
  return src.length > max ? `${head} · and ${src.length - max} more` : head;
}

// Question from the textbook's own exercise at the end of the chapter.
export function ExerciseBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: "#E4ECFA", color: "#2856A8" }} title="From the exercise at the end of the chapter in the book">
      Exercise
    </span>
  );
}

// Board question from the old syllabus, not in the new book.
export function OldBookBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: "#EEF1F5", color: "#5F6B7A" }} title="From the old book, not in the new course">
      From old book
    </span>
  );
}
