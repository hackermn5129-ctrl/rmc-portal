import { supabase } from "./supabase";
import type { StudentLite } from "./fee-data";
import type { ClassRow } from "./school";

// What the reader found on a photo of the handwritten fee receipt.
export type VoucherRead = {
  voucher_no: string;
  name_urdu: string;
  name_english: string;
  name_alternatives?: string[];
  father_urdu: string;
  father_english: string;
  class_text: string;
  class_number: number;
  serial_no: string;
  month_text: string;
  months: number[];
  date: string;
  annual_fund: number;
  hostel_fund: number;
  fee: number;
  other_amount: number;
  total: number;
  unsure: string[];
};

// The total written on the voucher, or the sum of its lines when the total is left blank.
export const voucherAmount = (v: VoucherRead) => v.total || v.annual_fund + v.hostel_fund + v.fee + v.other_amount;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const voucherMonths = (v: VoucherRead) => v.months.map((m) => MONTHS[m - 1]).join(", ") || v.month_text;

// Makes the photo small enough to send (longest side 1600px). The receipt is wide, and phone photos
// of it are often taken sideways, so turned copies are sent too and the reader uses the upright one.
export async function shrinkPhoto(file: File, longest = 1600): Promise<{ images: string[]; preview: string }> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("unreadable"));
      img.src = URL.createObjectURL(file);
    });
  }
  const scale = Math.min(1, longest / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));

  const turned = (quarterTurns: number) => {
    const canvas = document.createElement("canvas");
    const side = quarterTurns % 2 === 1;
    canvas.width = side ? h : w;
    canvas.height = side ? w : h;
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((quarterTurns * Math.PI) / 2);
    ctx.drawImage(source, -w / 2, -h / 2, w, h);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const preview = turned(0);
  const urls = h > w ? [turned(1), turned(3), preview] : [preview, turned(2)];
  return { images: urls.map((u) => u.slice(u.indexOf(",") + 1)), preview };
}

export async function readVoucher(images: string[]): Promise<{ voucher: VoucherRead } | { error: string }> {
  const { data, error } = await supabase.functions.invoke("read-voucher", { body: { images } });
  if (!error && data?.ok && data.voucher) return { voucher: data.voucher as VoucherRead };
  if (data?.error) return { error: data.error };
  if (error && typeof error === "object" && "context" in error) {
    try {
      const body = await (error as { context: Response }).context.json();
      if (body?.error) return { error: body.error };
    } catch {}
  }
  return { error: "The photo couldn't be read. Check the internet and try again." };
}

// A payment already saved with this voucher number, if any.
export async function findVoucher(no: string): Promise<{ receipt_no: number; paid_on: string } | null> {
  if (!no.trim()) return null;
  const { data } = await supabase.from("fee_payments").select("receipt_no, paid_on").eq("voucher_no", no.trim()).order("created_at", { ascending: false }).limit(1);
  return (data?.[0] as { receipt_no: number; paid_on: string } | undefined) ?? null;
}

/* Matching the name on the voucher to a student.
   The voucher is handwritten in Urdu and the reader spells it in English, so spellings differ
   (Zain / Zaen, Ahmad / Ahmed). Names are compared mostly by their consonants. */

const ALIASES: Record<string, string> = { mohammad: "muhammad", mohammed: "muhammad", muhammed: "muhammad", mohamad: "muhammad", muhamad: "muhammad", mohd: "muhammad", muhd: "muhammad", m: "muhammad", md: "muhammad" };
const SKIP = new Set(["so", "do", "s", "o", "d", "bin", "bint", "ibn", "wald", "walad", "son", "of", "mr", "ms"]);
const COMMON = new Set(["muhammad"]);

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .split(" ")
    .filter((t) => t && !SKIP.has(t))
    .map((t) => ALIASES[t] ?? t);
}

function skeleton(t: string): string {
  const s = t
    .replace(/kh/g, "k")
    .replace(/gh/g, "g")
    .replace(/sh/g, "s")
    .replace(/ch/g, "c")
    .replace(/ph/g, "f")
    .replace(/[tdb]h/g, (m) => m[0])
    .replace(/q/g, "k")
    .replace(/w/g, "v")
    .replace(/c/g, "k");
  const body = s[0] + s.slice(1).replace(/[aeiouy]/g, "");
  return body.replace(/(.)\1+/g, "$1");
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = keep;
    }
  }
  return row[b.length];
}

const alike = (a: string, b: string) => (a === b ? 1 : 1 - distance(a, b) / Math.max(a.length, b.length, 1));
const tokenAlike = (a: string, b: string) => 0.6 * alike(skeleton(a), skeleton(b)) + 0.4 * alike(a, b);

// How well every word of `a` is found in `b`, from 0 to 1. Very common words count less.
function covered(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  let sum = 0;
  let weight = 0;
  for (const t of a) {
    const w = COMMON.has(t) ? 0.3 : 1;
    sum += w * Math.max(...b.map((u) => tokenAlike(t, u)));
    weight += w;
  }
  return sum / weight;
}

export function nameAlike(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  return (covered(ta, tb) + covered(tb, ta)) / 2;
}

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").replace(/^0+/, "");
const classNumbers = (c?: ClassRow) => (c ? (c.name.match(/\d+/g) ?? []).map(Number) : []);

export type Candidate = { student: StudentLite; score: number };

// The students most likely to be the one on the voucher, best first.
export function matchStudents(v: VoucherRead, students: StudentLite[], classes: ClassRow[]): { candidates: Candidate[]; sure: boolean } {
  const classById = new Map(classes.map((c) => [c.id, c]));
  const serial = digits(v.serial_no);
  const scored: Candidate[] = [];
  for (const s of students) {
    // The reader's first reading counts fully, its other possible readings a little less.
    let score = v.name_english ? nameAlike(v.name_english, s.full_name) : 0;
    for (const other of v.name_alternatives ?? []) score = Math.max(score, 0.93 * nameAlike(other, s.full_name));
    if (v.father_english && s.father_name) score = 0.65 * score + 0.35 * nameAlike(v.father_english, s.father_name);
    if (v.class_number) {
      const nums = classNumbers(classById.get(s.class_id ?? ""));
      if (nums.length) score += nums.includes(v.class_number) ? 0.1 : -0.1;
    }
    if (serial && (serial === digits(s.reg_no) || serial === digits(s.roll_no))) score += 0.2;
    if (score >= 0.5) scored.push({ student: s, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const candidates = scored.slice(0, 5);
  const sure = candidates.length > 0 && candidates[0].score >= 0.85 && (candidates.length === 1 || candidates[0].score - candidates[1].score >= 0.08);
  return { candidates, sure };
}
