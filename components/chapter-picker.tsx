"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SelectField } from "@/components/ui";
import { chapterLabel, classGrades, loadChapters, type Chapter } from "@/lib/chapters";

// Choose the textbook chapter. If the chapter is missing, the teacher can add it.
export function ChapterPicker({
  classId,
  subjectId,
  value,
  onChange,
  teacherId,
}: {
  classId: string;
  subjectId: string;
  value: string;
  onChange: (id: string) => void;
  teacherId: string;
}) {
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [grades, setGrades] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState({ grade: "", number: "", title: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!classId || !subjectId) return;
    Promise.all([loadChapters(classId, subjectId), classGrades(classId)]).then(([list, g]) => {
      if (!active) return;
      setChapters(list);
      setGrades(g);
      setN((x) => ({ ...x, grade: String(g[0] ?? "") }));
    });
    return () => {
      active = false;
    };
  }, [classId, subjectId]);

  if (!classId || !subjectId) return null;
  if (!chapters) return <p className="text-sm text-sub">Loading chapters</p>;
  const twoBooks = grades.length > 1;

  async function add() {
    setError("");
    const num = Number(n.number);
    if (!n.title.trim()) return setError("Write the chapter name.");
    if (!(num >= 1 && num <= 99)) return setError("Write the chapter number, like 4.");
    const { data, error } = await supabase
      .from("chapters")
      .insert({ grade: Number(n.grade), subject_id: subjectId, number: num, title: n.title.trim(), source: "Added by teacher", created_by: teacherId })
      .select("id, grade, subject_id, number, title, source")
      .single();
    if (error || !data) return setError(error?.code === "23505" ? "That chapter number is already in the list." : "The chapter wasn't added. Try again.");
    const list = [...chapters!, data as Chapter].sort((a, b) => a.grade - b.grade || a.number - b.number);
    setChapters(list);
    onChange(data.id);
    setAdding(false);
    setN({ grade: String(grades[0] ?? ""), number: "", title: "" });
  }

  return (
    <div className="flex flex-col gap-2">
      <SelectField label="Chapter (Punjab textbook)" id="chapter" value={value} onChange={(e) => (e.target.value === "+" ? setAdding(true) : onChange(e.target.value))}>
        <option value="">{chapters.length ? "Choose the chapter" : "No chapters listed yet"}</option>
        {twoBooks
          ? grades.map((g) => (
              <optgroup key={g} label={`Class ${g} book`}>
                {chapters
                  .filter((c) => c.grade === g)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {chapterLabel(c)}
                    </option>
                  ))}
              </optgroup>
            ))
          : chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {chapterLabel(c)}
              </option>
            ))}
        <option value="+">+ Add a chapter that is missing</option>
      </SelectField>
      {adding && (
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-bg p-3">
          <p className="text-sm text-sub">Add the chapter as it is written in the book.</p>
          <div className="flex gap-2">
            {twoBooks && (
              <select aria-label="Book" value={n.grade} onChange={(e) => setN({ ...n, grade: e.target.value })} className="h-11 rounded-xl border border-line-strong bg-white px-2 text-sm">
                {grades.map((g) => (
                  <option key={g} value={g}>
                    Class {g}
                  </option>
                ))}
              </select>
            )}
            <input aria-label="Chapter number" inputMode="numeric" placeholder="No." value={n.number} onChange={(e) => setN({ ...n, number: e.target.value })} className="h-11 w-16 rounded-xl border border-line-strong bg-white px-3 text-sm" />
            <input aria-label="Chapter name" placeholder="Chapter name" value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-white px-3 text-sm" />
          </div>
          {error && (
            <p role="alert" className="text-sm text-bad-ink">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={add} className="h-10 rounded-full bg-navy px-4 text-sm font-medium text-white">
              Add chapter
            </button>
            <button type="button" onClick={() => setAdding(false)} className="h-10 rounded-full border border-line-strong bg-white px-4 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
