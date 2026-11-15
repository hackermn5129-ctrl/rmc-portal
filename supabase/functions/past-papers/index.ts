// Brings board past papers into the school's Cloudflare R2 storage.
// Called only by the database (pg_net) with a one-time key from paper_import_keys.
//   { key, action: "scan", urls: [...] }   reads each page and saves the links it finds in paper_scans
//   { key, action: "import", limit }       downloads pending paper_import_jobs into R2 and lists them in past_papers
//   { key, action: "move", limit }         moves papers saved earlier in Supabase storage over to R2
// R2 keys are Edge Function secrets (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY); account, bucket and
// public link are in paper_storage_config. Work runs in the background; results are read back from the tables.
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const UA = { "User-Agent": "Mozilla/5.0 (RMC school portal; past papers import)" };

function linksIn(html: string, base: string) {
  const out = new Set<string>();
  for (const m of html.matchAll(/(?:href|src|data-src|data-url|data-file)\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      out.add(new URL(m[1].replace(/&amp;/g, "&"), base).toString());
    } catch {
      /* skip bad links */
    }
  }
  // Links written inside scripts or JSON (for example embedded PDF viewers).
  for (const m of html.replace(/\\\//g, "/").matchAll(/https?:\/\/[^\s"'<>()]+?\.pdf/gi)) {
    try {
      out.add(new URL(m[0].replace(/&amp;/g, "&"), base).toString());
    } catch {
      /* skip bad links */
    }
  }
  return [...out];
}

async function scan(urls: string[]) {
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: UA });
      const html = r.ok ? await r.text() : "";
      const titles = [...html.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)].map((m) => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean);
      await db.from("paper_scans").upsert({ page_url: url, status: r.status, links: { links: linksIn(html, r.url || url), headings: titles }, fetched_at: new Date().toISOString() });
    } catch (e) {
      await db.from("paper_scans").upsert({ page_url: url, status: 0, links: { error: String(e) }, fetched_at: new Date().toISOString() });
    }
  }
}

type R2 = { client: AwsClient; endpoint: string; publicBase: string };

async function r2(): Promise<R2> {
  const { data } = await db.from("paper_storage_config").select("*").maybeSingle();
  const id = Deno.env.get("R2_ACCESS_KEY_ID");
  const secret = Deno.env.get("R2_SECRET_ACCESS_KEY");
  if (!data?.r2_account_id || !data?.public_base_url || !id || !secret) throw new Error("R2 is not set up yet");
  return {
    client: new AwsClient({ accessKeyId: id, secretAccessKey: secret, service: "s3", region: "auto" }),
    endpoint: `https://${data.r2_account_id}.r2.cloudflarestorage.com/${data.r2_bucket}`,
    publicBase: String(data.public_base_url).replace(/\/+$/, ""),
  };
}

async function putR2(store: R2, key: string, bytes: Uint8Array) {
  const r = await store.client.fetch(`${store.endpoint}/${key}`, { method: "PUT", body: bytes, headers: { "Content-Type": "application/pdf" } });
  if (!r.ok) throw new Error(`R2 upload: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return `${store.publicBase}/${key}`;
}

const isPdf = (b: Uint8Array) => b.length > 1000 && new TextDecoder().decode(b.slice(0, 5)) === "%PDF-";

async function keyFor(job: { url: string; grade: number; subject_id: string; board: string; year: number }) {
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(job.url)))).slice(0, 6).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${job.grade}/${job.subject_id}/${job.year}/${job.board.toLowerCase().replace(/[^a-z]+/g, "-")}-${hash}.pdf`;
}

async function importOne(store: R2, job: { url: string; grade: number; subject_id: string; board: string; year: number; syllabus: string; title: string }) {
  try {
    const r = await fetch(job.url, { headers: UA });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (!isPdf(bytes)) throw new Error("Not a PDF");
    const key = await keyFor(job);
    const fileUrl = await putR2(store, key, bytes);
    const row = await db.from("past_papers").upsert(
      { grade: job.grade, subject_id: job.subject_id, board: job.board, year: job.year, syllabus: job.syllabus, title: job.title, storage_path: null, file_url: fileUrl, file_size: bytes.length, source_url: job.url },
      { onConflict: "source_url" },
    );
    if (row.error) throw new Error(row.error.message);
    await db.from("paper_import_jobs").update({ status: "done", error: null, updated_at: new Date().toISOString() }).eq("url", job.url);
  } catch (e) {
    await db.from("paper_import_jobs").update({ status: "failed", error: String(e).slice(0, 300), updated_at: new Date().toISOString() }).eq("url", job.url);
  }
}

async function runImport(limit: number) {
  const store = await r2();
  const { data } = await db.from("paper_import_jobs").select("*").eq("status", "pending").limit(limit);
  const jobs = data ?? [];
  if (!jobs.length) return;
  await db.from("paper_import_jobs").update({ status: "working" }).in("url", jobs.map((j) => j.url));
  for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map((j) => importOne(store, j)));
}

// Papers saved in Supabase storage before R2 was set up: copy to R2, then free the Supabase space.
async function runMove(limit: number) {
  const store = await r2();
  const { data } = await db.from("past_papers").select("id, storage_path").not("storage_path", "is", null).is("file_url", null).limit(limit);
  for (const p of data ?? []) {
    try {
      const dl = await db.storage.from("past-papers").download(p.storage_path);
      if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "missing");
      const fileUrl = await putR2(store, p.storage_path, new Uint8Array(await dl.data.arrayBuffer()));
      await db.from("past_papers").update({ file_url: fileUrl, storage_path: null }).eq("id", p.id);
      await db.storage.from("past-papers").remove([p.storage_path]);
    } catch (e) {
      console.error("move failed", p.id, String(e));
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const body = await req.json().catch(() => ({}));
  const { data: k } = await db.from("paper_import_keys").select("key").eq("key", String(body.key ?? "")).maybeSingle();
  if (!k) return new Response("Not allowed", { status: 403 });

  const limit = Math.min(Number(body.limit) || 20, 40);
  const work =
    body.action === "scan" ? scan((body.urls ?? []).slice(0, 40)) : body.action === "import" ? runImport(limit) : body.action === "move" ? runMove(limit) : null;
  if (!work) return new Response("Unknown action", { status: 400 });
  // @ts-ignore EdgeRuntime is provided by Supabase
  EdgeRuntime.waitUntil(work.catch((e) => console.error(String(e))));
  return new Response(JSON.stringify({ started: true }), { status: 202, headers: { "Content-Type": "application/json" } });
});
