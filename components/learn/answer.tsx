import { Fragment, type ReactNode } from "react";

// Small Markdown reader for written answers: headings, paragraphs, lists, tables,
// **key words** (shown in red so they stand out) and *italic*.
const KEY_RED = "#B3261E";

function inline(text: string, key = ""): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(
        <strong key={`${key}b${i++}`} className="font-semibold" style={{ color: KEY_RED }}>
          {inline(m[1], `${key}b${i}`)}
        </strong>,
      );
    } else {
      out.push(<em key={`${key}i${i++}`}>{m[2]}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
const isRule = (row: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(row.trim());

export function Answer({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t || t === "***" || t === "---") {
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    if (h) {
      const level = h[1].length;
      blocks.push(
        <p key={k++} className={level <= 2 ? "mt-4 text-[16px] font-semibold text-navy first:mt-0" : "mt-3 text-[15px] font-semibold text-ink first:mt-0"}>
          {inline(h[2].replace(/\*\*/g, ""), `h${k}`)}
        </p>,
      );
      i++;
      continue;
    }
    if (t.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(lines[i++]);
      const body = rows.filter((r) => !isRule(r)).map(cells);
      const [head, ...rest] = body;
      blocks.push(
        <div key={k++} className="mt-3 overflow-x-auto rounded-2xl border border-line first:mt-0">
          <table className="w-full border-collapse text-left text-[14px] leading-snug">
            {head ? (
              <thead className="bg-bg">
                <tr>
                  {head.map((c, j) => (
                    <th key={j} className="border-b border-line px-3 py-2 font-semibold text-navy">
                      {inline(c.replace(/\*\*/g, ""), `th${k}${j}`)}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {rest.map((r, ri) => (
                <tr key={ri} className="border-b border-line last:border-0">
                  {r.map((c, j) => (
                    <td key={j} className={`px-3 py-2 align-top ${j === 0 ? "font-medium" : ""}`}>
                      {inline(c, `td${k}${ri}${j}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^([-*•]|\d+[.)])\s+/.test(t)) {
      const ordered = /^\d+[.)]/.test(t);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].trim().replace(/^([-*•]|\d+[.)])\s+/, ""));
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={k++} className={`mt-2 flex flex-col gap-1 pl-5 first:mt-0 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `li${k}${j}`)}</li>
          ))}
        </List>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\||([-*•]|\d+[.)])\s+)/.test(lines[i].trim())) para.push(lines[i++].trim());
    blocks.push(
      <p key={k++} className="mt-2 first:mt-0">
        {para.map((p, j) => (
          <Fragment key={j}>
            {j ? <br /> : null}
            {inline(p, `p${k}${j}`)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className="text-[15px] leading-relaxed text-ink/90">{blocks}</div>;
}

// Plain text for short previews (teacher lists).
export const plainAnswer = (text: string) =>
  text
    .replace(/\*\*|\*|#{1,4}\s/g, "")
    .replace(/\|/g, " ")
    .replace(/-{3,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
