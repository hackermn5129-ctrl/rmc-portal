import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Reads a photo of the school's handwritten fee receipt (the green "FEE RECEIPT" booklet)
// and returns what is written on it. It saves nothing: the admin checks the result on the
// Add payment screen and saves it there. Only a signed-in admin can call it.
//
// Needs the secret GEMINI_API_KEY (Google AI Studio). GEMINI_MODEL is optional.
//
// To help with handwriting, the reader is given the list of name words used at the school
// (single words such as "Zain" or "Ali", not whole names and not who they belong to) and
// today's date. The same photo can be sent turned several ways; the reader uses the upright one.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MODELS = [Deno.env.get("GEMINI_MODEL") ?? "", "gemini-3.5-flash", "gemini-2.5-pro", "gemini-2.5-flash"].filter(Boolean);
const MAX_IMAGE_CHARS = 4_000_000; // about 3 MB for each photo
const MAX_IMAGES = 3;

const prompt = (today: string, words: string[], count: number) => `${
  count > 1
    ? `These ${count} images are the SAME photo of one handwritten fee receipt, turned different ways. First decide which image shows the receipt upright (the English heading "FEE RECEIPT" reads normally, left to right). Read everything from that image only.`
    : `This is a photo of one handwritten fee receipt. It may be turned sideways or upside down; read it the right way up.`
} The receipt is from a boys' school in Pakistan. If the photo shows more than one receipt, read only the one that is filled in.

The printed form is in Urdu, with the English heading "FEE RECEIPT" and a printed receipt number next to it. Its printed labels are:
- نام مع ولدیت : the student's name, sometimes followed by the father's name (joined by ولد or بن).
- جماعت : the class. It may be a number or an Urdu word (اول 1, دوم 2, سوم 3, چہارم 4, پنجم 5, ششم 6, ہفتم 7, ہشتم 8, نہم 9, دہم 10).
- سیریل نمبر : a serial or registration number.
- فیس برائے ماہ : the month or months this fee is for.
- تاریخ : the date, written day-month-year. A two digit year means 20YY.
- سالانہ فنڈ : annual fund amount.
- ہاسٹل فنڈ : hostel fund amount.
- فیس : fee amount.
- the line between فیس and میزان : any other amount.
- میزان : the total.
- دستخط وصول کنندہ : a signature. Ignore it.

The handwriting is quick cursive in blue or black pen, written on the dotted lines. Work slowly and look at each stroke.

Names:
- These are the name words used by students and fathers at this school: ${words.join(", ")}.
- The name on the receipt is almost always made of words from that list. Read the handwriting, then choose the listed words that fit the strokes best. Many names start with محمد (Muhammad), often written very small or as a quick squiggle. Do not turn a short word into a longer one: زین (Zain) is not حسین (Hussain) and not حیدر (Haider).
- Only when the writing clearly shows a word that is not in the list, write what you see.
- name_urdu and father_urdu: the Urdu as written. name_english and father_english: the same names in English letters, using the spellings from the list.
- name_alternatives: up to three other possible readings of the student's name in English letters, most likely first. Use different words from the list that could also fit the strokes.
- If only one name is written, leave the father fields empty.

Amounts:
- Digits may be Western (0-9) or Urdu (۰-۹). In this handwriting a zero is often a small dot, a tiny circle or a short tick, and several zeros are written close together. Count every one of them.
- An amount usually ends with "/-" or "/=": a long slanted stroke. That stroke is not a digit and it does not replace any zero.
- First copy each amount exactly as written into the matching copy_ field (for example "17000/-"), then give the number.
- School fees here are thousands of rupees: usually 2000 to 60000. A fee below 2000 almost always means a zero was missed, so look again and count the zeros once more.

Date:
- Today is ${today}. A receipt is normally dated today or a few days before, never in the future. In this handwriting 5 can look like 2 or 6, and 1 like 7; use today's date to decide between them when a digit is unclear.
- copy_date: the date exactly as written. date: the same date as YYYY-MM-DD, or empty.

Other rules:
- Report only what is written by hand, plus the printed receipt number. Leave a field empty (or 0 for amounts) when its line is blank. Never fill a blank line.
- class_number: the class as a number from 1 to 12, or 0 if it is blank or unclear.
- months: the month numbers (1 = January ... 12 = December) for every month written. Urdu month names: جنوری, فروری, مارچ, اپریل, مئی, جون, جولائی, اگست, ستمبر, اکتوبر, نومبر, دسمبر.
- unsure: the names of the fields you could not read with confidence. Be honest: list name_english, fee or date whenever a letter or digit was a guess.
- If the photo is not this fee receipt at all, set is_fee_receipt to false.`;

const str = { type: "STRING" };
const int = { type: "INTEGER" };
const SCHEMA = {
  type: "OBJECT",
  properties: {
    is_fee_receipt: { type: "BOOLEAN" },
    voucher_no: str,
    name_urdu: str,
    name_english: str,
    name_alternatives: { type: "ARRAY", items: str },
    father_urdu: str,
    father_english: str,
    class_text: str,
    class_number: int,
    serial_no: str,
    month_text: str,
    months: { type: "ARRAY", items: int },
    copy_date: str,
    date: str,
    copy_annual_fund: str,
    annual_fund: int,
    copy_hostel_fund: str,
    hostel_fund: int,
    copy_fee: str,
    fee: int,
    copy_other_amount: str,
    other_amount: int,
    copy_total: str,
    total: int,
    unsure: { type: "ARRAY", items: str },
  },
  required: ["is_fee_receipt", "voucher_no", "name_urdu", "name_english", "name_alternatives", "father_urdu", "father_english", "class_text", "class_number", "serial_no", "month_text", "months", "copy_date", "date", "copy_annual_fund", "annual_fund", "copy_hostel_fund", "hostel_fund", "copy_fee", "fee", "copy_other_amount", "other_amount", "copy_total", "total", "unsure"],
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const money = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 && n < 10_000_000 ? n : 0;
};
const list = (v: unknown, max: number) => (Array.isArray(v) ? v.map(text).filter(Boolean).slice(0, max) : []);

function clean(raw: Record<string, unknown>, today: string) {
  const date = text(raw.date);
  const classNo = Math.round(Number(raw.class_number));
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date));
  const unsure = list(raw.unsure, 20);
  if (validDate && date > today && !unsure.includes("date")) unsure.push("date");
  return {
    is_fee_receipt: raw.is_fee_receipt !== false,
    voucher_no: text(raw.voucher_no).replace(/\D/g, ""),
    name_urdu: text(raw.name_urdu),
    name_english: text(raw.name_english),
    name_alternatives: list(raw.name_alternatives, 3),
    father_urdu: text(raw.father_urdu),
    father_english: text(raw.father_english),
    class_text: text(raw.class_text),
    class_number: classNo >= 1 && classNo <= 12 ? classNo : 0,
    serial_no: text(raw.serial_no),
    month_text: text(raw.month_text),
    months: Array.isArray(raw.months) ? raw.months.map((m) => Math.round(Number(m))).filter((m) => m >= 1 && m <= 12) : [],
    date: validDate ? date : "",
    annual_fund: money(raw.annual_fund),
    hostel_fund: money(raw.hostel_fund),
    fee: money(raw.fee),
    other_amount: money(raw.other_amount),
    total: money(raw.total),
    unsure,
  };
}

// Single name words used at the school, most common first.
function nameWords(rows: { full_name: string | null; father_name: string | null }[]): string[] {
  const count = new Map<string, number>();
  for (const r of rows)
    for (const name of [r.full_name, r.father_name])
      for (const w of (name ?? "").split(/[^A-Za-z]+/)) {
        if (w.length < 2) continue;
        const word = w[0].toUpperCase() + w.slice(1).toLowerCase();
        count.set(word, (count.get(word) ?? 0) + 1);
      }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 400).map(([w]) => w);
}

function thinking(model: string): Record<string, unknown> | null {
  if (/^gemini-2\.5/.test(model)) return { thinkingBudget: 8192 };
  if (/^gemini-[3-9]/.test(model)) return { thinkingLevel: "high" };
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return json({ error: "Sign in again." }, 401);
  const { data: profile } = await admin.from("profiles").select("role").eq("id", caller.user.id).maybeSingle();
  if (profile?.role !== "admin") return json({ error: "Only the admin can read vouchers." }, 403);

  const key = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!key) return json({ error: "The photo reader isn't switched on yet.", code: "NO_KEY" }, 503);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "The request wasn't readable." }, 400);
  }
  const images = (Array.isArray(body.images) ? body.images : [body.image])
    .map((i) => String(i ?? "").replace(/^data:[^,]*,/, ""))
    .filter(Boolean)
    .slice(0, MAX_IMAGES);
  if (!images.length || images.some((i) => !/^[A-Za-z0-9+/=\s]+$/.test(i))) return json({ error: "Send a photo." }, 400);
  if (images.some((i) => i.length > MAX_IMAGE_CHARS)) return json({ error: "That photo is too big. Take it again a little further away." }, 413);

  const { data: students } = await admin.from("students").select("full_name, father_name").eq("status", "active");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
  const parts = [...images.map((data) => ({ inline_data: { mime_type: "image/jpeg", data } })), { text: prompt(today, nameWords(students ?? []), images.length) }];

  const ask = (model: string, think: Record<string, unknown> | null) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA, ...(think ? { thinkingConfig: think } : {}) },
      }),
    });

  let busy = false;
  for (const model of MODELS) {
    let res: Response;
    try {
      res = await ask(model, thinking(model));
      if (res.status === 400 && thinking(model)) {
        const detail = await res.text();
        if (/API key|API_KEY/i.test(detail)) return json({ error: "The reader's key isn't working. It needs to be set again.", code: "BAD_KEY" }, 503);
        console.error("gemini refused the thinking setting", model, detail.slice(0, 300));
        res = await ask(model, null);
      }
    } catch {
      return json({ error: "The reader didn't answer. Check the internet and try again." }, 502);
    }
    if (res.status === 404) continue; // this model name isn't available to the key: try the next one
    if (res.status === 429) {
      busy = true; // this model's free limit is used up: try the next one
      console.error("gemini limit reached", model);
      continue;
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      const detail = await res.text();
      console.error("gemini refused", model, res.status, detail.slice(0, 500));
      if (/API key|API_KEY|permission/i.test(detail)) return json({ error: "The reader's key isn't working. It needs to be set again.", code: "BAD_KEY" }, 503);
      return json({ error: "The photo couldn't be read. Try a clearer photo." }, 502);
    }
    if (!res.ok) {
      console.error("gemini error", model, res.status, (await res.text()).slice(0, 500));
      continue;
    }
    const out = await res.json();
    const reply = (out?.candidates?.[0]?.content?.parts ?? [])
      .filter((p: { thought?: boolean }) => !p.thought)
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    try {
      const raw = JSON.parse(reply);
      const voucher = clean(raw, today);
      console.log("read", model, JSON.stringify({ no: voucher.voucher_no, copy_fee: raw.copy_fee, copy_total: raw.copy_total, copy_date: raw.copy_date, unsure: voucher.unsure }));
      if (!voucher.is_fee_receipt) return json({ error: "That doesn't look like a fee receipt. Take a photo of the filled receipt.", code: "NOT_RECEIPT" }, 422);
      return json({ ok: true, voucher, model });
    } catch {
      console.error("gemini reply not json", model, reply.slice(0, 300));
      continue;
    }
  }
  if (busy) return json({ error: "Too many photos in a short time. Wait a minute and try again.", code: "BUSY" }, 429);
  return json({ error: "The photo couldn't be read. Try again, or type the payment in.", code: "NO_MODEL" }, 503);
});
