import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Reads a photo of the school's handwritten fee receipt (the green "FEE RECEIPT" booklet)
// and returns what is written on it. It saves nothing: the admin checks the result on the
// Add payment screen and saves it there. Only a signed-in admin can call it.
//
// Needs the secret GEMINI_API_KEY (Google AI Studio). GEMINI_MODEL is optional.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MODELS = [Deno.env.get("GEMINI_MODEL") ?? "", "gemini-3.5-flash", "gemini-2.5-flash"].filter(Boolean);
const MAX_IMAGE_CHARS = 6_000_000; // about 4.5 MB of photo
const MIMES = ["image/jpeg", "image/png", "image/webp"];

const PROMPT = `This is a photo of one handwritten fee receipt from a school in Pakistan. The photo may be turned sideways or upside down; read it the right way up. If the photo shows more than one receipt, read only the one that is filled in and most complete.

The printed form is in Urdu, with the English heading "FEE RECEIPT" and a printed receipt number next to it. Its printed labels are:
- نام مع ولدیت : the student's name, usually followed by the father's name (often joined by ولد or بن).
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

The handwriting is in blue or black pen. Digits may be Western (0-9) or Urdu (۰-۹). A zero is often written as a small dot or a tiny circle, and "/-" or "/=" after an amount only means "rupees"; it is not a digit. Amounts are whole rupees, normally between 500 and 100000.

Rules:
- Report only what is written by hand, plus the printed receipt number. Leave a field empty (or 0 for amounts) when its line is blank. Never guess a value that is not on the paper.
- name_urdu and father_urdu: copy the Urdu as written. name_english and father_english: spell the same names in English letters the way Pakistani names are usually spelled (for example محمد = Muhammad, علی = Ali, احمد = Ahmad, حسن = Hassan).
- If only one name is written, put it in the name fields and leave the father fields empty.
- class_number: the class as a number from 1 to 12, or 0 if it is blank or unclear.
- months: the month numbers (1 = January ... 12 = December) for every month written. Urdu month names: جنوری, فروری, مارچ, اپریل, مئی, جون, جولائی, اگست, ستمبر, اکتوبر, نومبر, دسمبر.
- date: as YYYY-MM-DD, or empty.
- unsure: list the names of the fields you could not read with confidence. If the photo is not this fee receipt at all, set is_fee_receipt to false.`;

const str = { type: "STRING" };
const int = { type: "INTEGER" };
const SCHEMA = {
  type: "OBJECT",
  properties: {
    is_fee_receipt: { type: "BOOLEAN" },
    voucher_no: str,
    name_urdu: str,
    name_english: str,
    father_urdu: str,
    father_english: str,
    class_text: str,
    class_number: int,
    serial_no: str,
    month_text: str,
    months: { type: "ARRAY", items: int },
    date: str,
    annual_fund: int,
    hostel_fund: int,
    fee: int,
    other_amount: int,
    total: int,
    unsure: { type: "ARRAY", items: str },
  },
  required: ["is_fee_receipt", "voucher_no", "name_urdu", "name_english", "father_urdu", "father_english", "class_text", "class_number", "serial_no", "month_text", "months", "date", "annual_fund", "hostel_fund", "fee", "other_amount", "total", "unsure"],
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const money = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 && n < 10_000_000 ? n : 0;
};

function clean(raw: Record<string, unknown>) {
  const date = text(raw.date);
  const classNo = Math.round(Number(raw.class_number));
  return {
    is_fee_receipt: raw.is_fee_receipt !== false,
    voucher_no: text(raw.voucher_no).replace(/\D/g, ""),
    name_urdu: text(raw.name_urdu),
    name_english: text(raw.name_english),
    father_urdu: text(raw.father_urdu),
    father_english: text(raw.father_english),
    class_text: text(raw.class_text),
    class_number: classNo >= 1 && classNo <= 12 ? classNo : 0,
    serial_no: text(raw.serial_no),
    month_text: text(raw.month_text),
    months: Array.isArray(raw.months) ? raw.months.map((m) => Math.round(Number(m))).filter((m) => m >= 1 && m <= 12) : [],
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) ? date : "",
    annual_fund: money(raw.annual_fund),
    hostel_fund: money(raw.hostel_fund),
    fee: money(raw.fee),
    other_amount: money(raw.other_amount),
    total: money(raw.total),
    unsure: Array.isArray(raw.unsure) ? raw.unsure.map(text).filter(Boolean).slice(0, 20) : [],
  };
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
  const image = String(body.image ?? "").replace(/^data:[^,]*,/, "");
  const mime = String(body.mime ?? "image/jpeg");
  if (!image || !/^[A-Za-z0-9+/=\s]+$/.test(image)) return json({ error: "Send a photo." }, 400);
  if (image.length > MAX_IMAGE_CHARS) return json({ error: "That photo is too big. Take it again a little further away." }, 413);
  if (!MIMES.includes(mime)) return json({ error: "Use a JPG or PNG photo." }, 400);

  const request = JSON.stringify({
    contents: [{ parts: [{ inline_data: { mime_type: mime, data: image } }, { text: PROMPT }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA },
  });

  let lastStatus = 0;
  for (const model of MODELS) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: request,
      });
    } catch {
      return json({ error: "The reader didn't answer. Check the internet and try again." }, 502);
    }
    lastStatus = res.status;
    if (res.status === 404) continue; // this model name isn't available to the key: try the next one
    if (res.status === 429) return json({ error: "Too many photos in a short time. Wait a minute and try again.", code: "BUSY" }, 429);
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      const detail = await res.text();
      console.error("gemini refused", model, res.status, detail.slice(0, 500));
      if (/API key|API_KEY|permission/i.test(detail)) return json({ error: "The reader's key isn't working. It needs to be set again.", code: "BAD_KEY" }, 503);
      return json({ error: "The photo couldn't be read. Try a clearer photo." }, 502);
    }
    if (!res.ok) {
      console.error("gemini error", model, res.status, (await res.text()).slice(0, 500));
      return json({ error: "The reader is busy. Try again in a moment." }, 502);
    }
    const out = await res.json();
    const reply = (out?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    try {
      const voucher = clean(JSON.parse(reply));
      if (!voucher.is_fee_receipt) return json({ error: "That doesn't look like a fee receipt. Take a photo of the filled receipt.", code: "NOT_RECEIPT" }, 422);
      return json({ ok: true, voucher });
    } catch {
      console.error("gemini reply not json", model, reply.slice(0, 300));
      return json({ error: "The photo couldn't be read. Try a clearer photo." }, 502);
    }
  }
  console.error("no gemini model available", MODELS, lastStatus);
  return json({ error: "The reader isn't available right now.", code: "NO_MODEL" }, 503);
});
