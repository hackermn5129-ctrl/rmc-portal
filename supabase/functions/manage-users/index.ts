import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Creates accounts for the RMC Portal.
//   status:    tells the login page whether the first admin still has to be made.
//   bootstrap: makes the first admin. Needs the one-time setup code and only works while no admin exists.
//   create:    makes any other account. Only a signed-in admin can call it.
//              With student_id it also links the account: a parent to that child (an existing
//              parent account with the same phone is linked instead of making a second one),
//              or a student login to that student record.
//   reset:     sets a new password for an account. Only a signed-in admin can call it.

const LOGIN_DOMAIN = "users.rmc-portal.app";
// Fingerprint (SHA-256) of the one-time setup code. It is kept out of this public file on purpose:
// the deployed function holds the real value, and setup locks itself once the first admin exists.
const SETUP_CODE_SHA256 = Deno.env.get("SETUP_CODE_SHA256") ?? "";
const ROLES = ["admin", "teacher", "student", "parent"];
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function normalizePhone(raw: string): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("0092")) d = "0" + d.slice(4);
  else if (d.startsWith("92") && d.length === 12) d = "0" + d.slice(2);
  return d;
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "The request wasn't readable." }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count: adminCount, error: countError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (countError) return json({ error: "The database didn't answer. Try again." }, 500);

  const action = body.action;
  if (action === "status") return json({ needs_setup: adminCount === 0 });

  async function callerIsAdmin(): Promise<boolean> {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: caller } = await admin.auth.getUser(token);
    if (!caller?.user) return false;
    const { data: p } = await admin.from("profiles").select("role").eq("id", caller.user.id).maybeSingle();
    return p?.role === "admin";
  }

  if (action === "reset") {
    if (!(await callerIsAdmin())) return json({ error: "Only the admin can reset passwords." }, 403);
    const userId = String(body.user_id ?? "");
    const password = String(body.password ?? "");
    if (password.length < 8) return json({ error: "Use a password with at least 8 characters." }, 400);
    const { data: target } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (!target) return json({ error: "That account wasn't found." }, 404);
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return json({ error: "The password wasn't changed. Try again." }, 500);
    return json({ ok: true });
  }

  let role: string;
  if (action === "bootstrap") {
    if (adminCount !== 0) return json({ error: "Setup is already done. Sign in instead." }, 409);
    if (SETUP_CODE_SHA256.length !== 64) return json({ error: "Setup isn't available right now." }, 503);
    const given = await sha256Hex(String(body.setup_code ?? ""));
    if (!sameText(given, SETUP_CODE_SHA256)) return json({ error: "That setup code isn't right." }, 403);
    role = "admin";
  } else if (action === "create") {
    if (!(await callerIsAdmin())) return json({ error: "Only the admin can add accounts." }, 403);
    role = String(body.role ?? "");
    if (!ROLES.includes(role)) return json({ error: "Pick a valid role." }, 400);
  } else {
    return json({ error: "Unknown action." }, 400);
  }

  const studentId = body.student_id ? String(body.student_id) : null;
  let regNo: string | null = null;
  if (studentId) {
    const { data: st } = await admin.from("students").select("id, profile_id, reg_no").eq("id", studentId).maybeSingle();
    if (!st) return json({ error: "That student wasn't found." }, 404);
    if (role === "student" && st.profile_id) return json({ error: "This student already has a login." }, 409);
    regNo = st.reg_no ? String(st.reg_no).replace(/\D/g, "").padStart(6, "0") : null;
  }

  const fullName = String(body.full_name ?? "").trim();
  const phone = normalizePhone(String(body.phone ?? ""));
  const password = String(body.password ?? "");
  if (fullName.length < 3) return json({ error: "Enter the full name." }, 400);
  // A student login made from the student's profile signs in with the registration number.
  const byReg = role === "student" && !!studentId && !phone;
  if (byReg && !regNo) return json({ error: "Add the registration number first." }, 400);
  if (!byReg && !/^03\d{9}$/.test(phone)) return json({ error: "Enter an 11-digit mobile number, like 0300 1234567." }, 400);

  if (role === "parent" && studentId) {
    const { data: existing } = await admin.from("profiles").select("id, role").eq("phone", phone).maybeSingle();
    if (existing) {
      if (existing.role !== "parent") return json({ error: "That phone number belongs to a staff or student account." }, 409);
      await admin.from("parent_students").upsert({ parent_id: existing.id, student_id: studentId }, { onConflict: "parent_id,student_id", ignoreDuplicates: true });
      return json({ ok: true, id: existing.id, role, linked_existing: true });
    }
  }
  if (password.length < 8) return json({ error: "Use a password with at least 8 characters." }, 400);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: byReg ? `r${regNo}@${LOGIN_DOMAIN}` : `${phone}@${LOGIN_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: byReg ? { full_name: fullName, reg_no: regNo } : { full_name: fullName, phone },
  });
  if (createError || !created?.user) {
    const taken = /already|registered|exists/i.test(createError?.message ?? "");
    return json({ error: taken ? (byReg ? "That registration number already has a login." : "That phone number already has an account.") : "The account wasn't created. Try again." }, taken ? 409 : 500);
  }

  const { error: profileError } = await admin.from("profiles").insert({ id: created.user.id, role, full_name: fullName, phone: byReg ? null : phone });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: "The account wasn't saved. Try again." }, 500);
  }

  if (studentId && role === "parent") await admin.from("parent_students").insert({ parent_id: created.user.id, student_id: studentId });
  if (studentId && role === "student") await admin.from("students").update({ profile_id: created.user.id }).eq("id", studentId);

  return json({ ok: true, id: created.user.id, role });
});
