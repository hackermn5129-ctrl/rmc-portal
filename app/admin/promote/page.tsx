"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { ErrorNote, OkNote, PrimaryButton } from "@/components/ui";
import { className, currentSession, loadClasses, type ClassRow, type Session } from "@/lib/school";

type Student = { id: string; full_name: string; class_id: string | null };
const PASSED = "passed";

// Class 8-A -> Class 9-A (same section if it exists, else any Class 9). No higher class -> passed out.
function nextClass(c: ClassRow, all: ClassRow[]): string {
  const n = Number(c.name.match(/\d+/)?.[0]);
  if (!Number.isFinite(n)) return c.id;
  const up = all.filter((x) => Number(x.name.match(/\d+/)?.[0]) === n + 1);
  return (up.find((x) => x.section === c.section) ?? up[0])?.id ?? PASSED;
}

function Promote() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [target, setTarget] = useState<Record<string, string>>({});
  const [hold, setHold] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([loadClasses(), supabase.from("students").select("id, full_name, class_id").eq("status", "active").order("full_name"), currentSession()]).then(
      ([c, s, sess]) => {
        if (!active) return;
        setClasses(c);
        setStudents((s.data ?? []) as Student[]);
        setSession(sess);
        setTarget(Object.fromEntries(c.map((cls) => [cls.id, nextClass(cls, c)])));
      },
    );
    return () => {
      active = false;
    };
  }, [version]);

  if (session === undefined) return <p className="mt-6 text-sm text-sub">Loading</p>;
  if (!session) return <p className="mt-6 text-sm text-sub">Set the current session in School setup first.</p>;

  const inClass = (id: string) => students.filter((s) => s.class_id === id);
  const moving = students.filter((s) => s.class_id && !hold.has(s.id)).length;

  async function run() {
    setError("");
    if (!armed) return setArmed(true);
    setBusy(true);
    const map = classes.map((c) => ({ from: c.id, to: target[c.id] === PASSED ? null : target[c.id] || c.id }));
    const { data, error } = await supabase.rpc("promote_students", { p_map: map, p_hold_back: [...hold] });
    setBusy(false);
    setArmed(false);
    if (error) return setError("Promotion didn't go through. Nothing was changed. Try again.");
    setOk(`${data} students moved. Now open School setup and make the new session current.`);
    setHold(new Set());
    setVersion((v) => v + 1);
  }

  return (
    <>
      <section className="mt-5 rounded-[28px] bg-navy p-5 text-white">
        <p className="text-sm text-mist">Ending session</p>
        <p className="mt-1 text-2xl font-medium">{session.name}</p>
        <p className="mt-3 text-sm leading-relaxed text-mist">
          Each class moves up together. Marks, attendance and fees of {session.name} stay saved under that session. Students in the last class are marked as passed out.
        </p>
      </section>

      <ul className="mt-4 flex flex-col gap-2">
        {classes.map((c) => {
          const list = inClass(c.id);
          const held = list.filter((s) => hold.has(s.id)).length;
          return (
            <li key={c.id} className="rounded-3xl border border-line bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="flex flex-col">
                  <span className="text-[15px] font-medium">{className(c)}</span>
                  <span className="text-sm text-sub">
                    {list.length} students{held ? ` · ${held} staying back` : ""}
                  </span>
                </span>
                <label className="flex items-center gap-2 text-sm text-sub">
                  <span className="sr-only">{className(c)} moves to</span>
                  <span aria-hidden>to</span>
                  <select
                    value={target[c.id] ?? ""}
                    onChange={(e) => setTarget({ ...target, [c.id]: e.target.value })}
                    className="h-11 rounded-2xl border border-line-strong bg-bg px-3 text-[15px] text-ink"
                  >
                    {classes
                      .filter((x) => x.id !== c.id)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {className(x)}
                        </option>
                      ))}
                    <option value={PASSED}>Passed out</option>
                    <option value={c.id}>Stay in {className(c)}</option>
                  </select>
                </label>
              </div>
              {list.length > 0 && (
                <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id} className="mt-2 flex items-center gap-1 text-sm text-navy">
                  Choose who stays back
                  <ChevronDown aria-hidden className={`size-4 transition-transform ${open === c.id ? "rotate-180" : ""}`} strokeWidth={1.75} />
                </button>
              )}
              {open === c.id && (
                <ul className="mt-2 rounded-2xl bg-bg px-3 py-1">
                  {list.map((s) => (
                    <li key={s.id} className="border-b border-line last:border-b-0">
                      <label className="flex h-11 items-center gap-3 text-[15px]">
                        <input
                          type="checkbox"
                          className="size-5 accent-[#1F3A5F]"
                          checked={hold.has(s.id)}
                          onChange={(e) => {
                            const next = new Set(hold);
                            if (e.target.checked) next.add(s.id);
                            else next.delete(s.id);
                            setHold(next);
                          }}
                        />
                        {s.full_name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-col gap-3">
        <ErrorNote>{error}</ErrorNote>
        <OkNote>{ok}</OkNote>
        {ok && (
          <Link href="/admin/settings" className="text-center text-sm text-navy">
            Open School setup
          </Link>
        )}
        {armed && (
          <p className="rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad-ink">
            This moves {moving} students to their new classes. Tap the button again to confirm.
          </p>
        )}
        <PrimaryButton type="button" onClick={run} busy={busy}>
          {armed ? "Yes, promote now" : "Promote students"}
        </PrimaryButton>
      </div>
    </>
  );
}

export default function PromotePage() {
  return (
    <Portal role="admin" title="Promote students" back="/admin/settings">
      {() => <Promote />}
    </Portal>
  );
}
