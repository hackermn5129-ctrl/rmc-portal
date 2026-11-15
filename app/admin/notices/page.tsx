"use client";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { ErrorNote, Field, OkNote, PrimaryButton, SelectField } from "@/components/ui";
import { className, loadClasses, type ClassRow } from "@/lib/school";

type Audience = "everyone" | "parents" | "students" | "teachers";
type Notice = { id: string; title: string; body: string; audience: Audience; class_id: string | null; created_at: string };

const AUDIENCES: { value: Audience; label: string; urdu: string }[] = [
  { value: "everyone", label: "Everyone", urdu: "سب" },
  { value: "parents", label: "Parents", urdu: "والدین" },
  { value: "students", label: "Students", urdu: "طلبہ" },
  { value: "teachers", label: "Teachers", urdu: "اساتذہ" },
];

function Notices() {
  const [rows, setRows] = useState<Notice[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [version, setVersion] = useState(0);
  const [f, setF] = useState({ title: "", body: "", audience: "everyone" as Audience, class_id: "" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([supabase.from("notices").select("id, title, body, audience, class_id, created_at").order("created_at", { ascending: false }).limit(50), loadClasses()]).then(
      ([n, c]) => {
        if (!active) return;
        setRows((n.data ?? []) as Notice[]);
        setClasses(c);
      },
    );
    return () => {
      active = false;
    };
  }, [version]);

  async function send(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (!f.title.trim()) return setError("Write a short title, like School closed on Friday.");
    setBusy(true);
    const { error } = await supabase.from("notices").insert({ title: f.title.trim(), body: f.body.trim(), audience: f.audience, class_id: f.class_id || null });
    setBusy(false);
    if (error) return setError("The notice wasn't sent. Try again.");
    setOk("Notice sent. It shows on their home screen.");
    setF({ title: "", body: "", audience: f.audience, class_id: "" });
    setVersion((v) => v + 1);
  }

  async function remove(id: string) {
    if (confirm !== id) return setConfirm(id);
    await supabase.from("notices").delete().eq("id", id);
    setConfirm(null);
    setVersion((v) => v + 1);
  }

  const cls = new Map(classes.map((c) => [c.id, c]));

  return (
    <>
      <form onSubmit={send} noValidate className="mt-5 flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5">
        <h2 className="text-base font-medium">New notice</h2>
        <Field label="Title" id="n_title" placeholder="School closed on Friday" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <div className="flex flex-col gap-2">
          <label htmlFor="n_body" className="text-sm text-sub">
            Message (optional, English or Urdu)
          </label>
          <textarea
            id="n_body"
            rows={4}
            value={f.body}
            onChange={(e) => setF({ ...f, body: e.target.value })}
            className="rounded-2xl border border-line-strong bg-bg px-4 py-3 text-base text-ink"
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm text-sub">Who sees it</legend>
          <div className="grid grid-cols-4 gap-2">
            {AUDIENCES.map((a) => {
              const on = f.audience === a.value;
              return (
                <button
                  key={a.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setF({ ...f, audience: a.value })}
                  className={`flex flex-col items-center rounded-2xl border px-1 py-2 text-sm ${on ? "border-navy bg-navy text-white" : "border-line-strong bg-bg"}`}
                >
                  {a.label}
                  <span lang="ur" dir="rtl" className={`font-urdu text-xs leading-[2] ${on ? "text-mist" : "text-sub"}`}>
                    {a.urdu}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <SelectField label="Class" id="n_class" value={f.class_id} onChange={(e) => setF({ ...f, class_id: e.target.value })}>
          <option value="">Whole school</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              Only {className(c)}
            </option>
          ))}
        </SelectField>
        <ErrorNote>{error}</ErrorNote>
        <OkNote>{ok}</OkNote>
        <PrimaryButton type="submit" busy={busy}>
          Send notice
        </PrimaryButton>
      </form>

      <h2 className="mt-6 text-base font-medium">Sent</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.length === 0 && <li className="rounded-3xl border border-line bg-white p-4 text-sm text-sub">No notices yet.</li>}
        {rows.map((n) => (
          <li key={n.id} className="rounded-3xl border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium">{n.title}</p>
                <p className="mt-0.5 text-sm text-sub">
                  {AUDIENCES.find((a) => a.value === n.audience)?.label} · {n.class_id ? className(cls.get(n.class_id)) : "Whole school"} ·{" "}
                  {new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(n.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-sm ${confirm === n.id ? "bg-bad text-white" : "border border-line-strong text-sub hover:bg-bg"}`}
              >
                {confirm === n.id ? "Tap to delete" : "Delete"}
              </button>
            </div>
            {n.body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{n.body}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function NoticesPage() {
  return (
    <Portal role="admin" title="Notices" back="/admin/settings">
      {() => <Notices />}
    </Portal>
  );
}
