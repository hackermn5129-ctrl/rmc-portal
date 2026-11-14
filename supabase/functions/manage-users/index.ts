import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Creates accounts for the RMC Portal.
//   status:    tells the login page whether the first admin still has to be made.
//   bootstrap: makes the first admin. Needs the one-time setup code and only works while no admin exists.
//   create:    makes any other account. Only a signed-in admin can call it.

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

  let role: string;
  if (action === "bootstrap") {
    if (adminCount !== 0) return json({ error: "Setup is already done. Sign in instead." }, 409);
    if (SETUP_CODE_SHA256.length !== 64) return json({ error: "Setup isn't available right now." }, 503);
    const given = await sha256Hex(String(body.setup_code ?? ""));
    if (!sameText(given, SETUP_CODE_SHA256)) return json({ error: "That setup code isn't right." }, 403);
    role = "admin";
  } else if (action === "create") {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: caller } = await admin.auth.getUser(token);
    if (!caller?.user) return json({ error: "Sign in first." }, 401);
    const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", caller.user.id).maybeSingle();
    if (callerProfile?.role !== "admin") return json({ error: "Only the admin can add accounts." }, 403);
    role = String(body.role ?? "");
    if (!ROLES.includes(role)) return json({ error: "Pick a valid role." }, 400);
  } else {
    return json({ error: "Unknown action." }, 400);
  }

  const fullName = String(body.full_name ?? "").trim();
  const phone = normalizePhone(String(body.phone ?? ""));
  const password = String(body.password ?? "");
  if (fullName.length < 3) return json({ error: "Enter the full name." }, 400);
  if (!/^03\d{9}$/.test(phone)) return json({ error: "Enter an 11-digit mobile number, like 0300 1234567." }, 400);
  if (password.length < 8) return json({ error: "Use a password with at least 8 characters." }, 400);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: `${phone}@${LOGIN_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
  });
  if (createError || !created?.user) {
    const taken = /already|registered|exists/i.test(createError?.message ?? "");
    return json({ error: taken ? "That phone number already has an account." : "The account wasn't created. Try again." }, taken ? 409 : 500);
  }

  const { error: profileError } = await admin.from("profiles").insert({ id: created.user.id, role, full_name: fullName, phone });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: "The account wasn't saved. Try again." }, 500);
  }

  return json({ ok: true, id: created.user.id, role });
});
