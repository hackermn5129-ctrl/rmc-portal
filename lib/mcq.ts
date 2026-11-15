// Video lectures and MCQ tests.

// Gets the 11-character video id from any YouTube link (watch, youtu.be, shorts, embed, live) or a bare id.
export function youtubeId(raw: string): string | null {
  const s = raw.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m =
    s.match(/[?&]v=([A-Za-z0-9_-]{11})/) ??
    s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ??
    s.match(/youtube(?:-nocookie)?\.com\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export const thumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;

export type DraftQuestion = { question: string; options: string[]; correct: number; explanation: string };

// Paste many questions at once. Each question looks like:
//   Q: What is the powerhouse of the cell?
//   A) Nucleus
//   B) Mitochondria
//   C) Ribosome
//   D) Golgi body
//   Answer: B
//   Why: (optional explanation)
// A blank line between questions. Numbers like "1." or "Q1." also work in place of "Q:".
export function parsePasted(text: string): { questions: DraftQuestion[]; errors: string[] } {
  const blocks = text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const questions: DraftQuestion[] = [];
  const errors: string[] = [];
  blocks.forEach((block, i) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    let question = "";
    const options: string[] = [];
    let answer = "";
    let explanation = "";
    for (const line of lines) {
      const opt = line.match(/^\(?([A-Fa-f])[).:-]\s*(.+)$/);
      const ans = line.match(/^(?:answer|ans|correct)\s*[:=-]\s*\(?([A-Fa-f1-6])\)?/i);
      const why = line.match(/^(?:why|explanation|reason)\s*[:=-]\s*(.+)$/i);
      if (ans) answer = ans[1];
      else if (why) explanation = why[1];
      else if (opt && question) options.push(opt[2]);
      else if (!question) question = line.replace(/^(?:q(?:uestion)?\s*\d*\s*[:.)-]|\d+\s*[.)-])\s*/i, "");
      else if (!options.length) question += " " + line;
    }
    const idx = /\d/.test(answer) ? Number(answer) - 1 : "abcdef".indexOf(answer.toLowerCase());
    if (!question || options.length < 2 || idx < 0 || idx >= options.length) {
      errors.push(`Question ${i + 1}: needs the question, at least 2 options (A, B…) and "Answer: B".`);
      return;
    }
    questions.push({ question, options, correct: idx, explanation });
  });
  return { questions, errors };
}

export const LETTERS = ["A", "B", "C", "D", "E", "F"];
