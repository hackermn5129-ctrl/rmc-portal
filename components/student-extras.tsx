"use client";
import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isValidPhone } from "@/lib/phone";
import { ErrorNote, Field, OkNote, PrimaryButton } from "./ui";
import { currentSession } from "@/lib/school";
import { monthStart } from "@/lib/fees";

type Day = { held_on: string; day_status: "present" | "partial" | "absent" | "leave" };

const DOT: Record<Day["day_status"], string> = { present: "bg-ok", partial: "bg-warn", absent: "bg-bad", leave: "bg-mist" };
const DAY_LABEL: Record<Day["day_status"], string> = { present: "Present", partial: "Partly present", absent: "Absent", leave: "Leave" };

function percentOf(days: Day[]): number | null {
  const counted = days.filter((d) => d.day_status !== "leave");
  if (!counted.length) return null;
  const score = counted.reduce((a, d) => a + (d.day_status === "present" ? 1 : d.day_status === "partial" ? 0.5 : 0), 0);
  return (score / counted.length) * 100;
}

const tone = (p: number | null) => (p === null ? "text-sub" : p >= 90 ? "text-ok" : p >= 75 ? "text-warn" : "text-bad");
const show = (p: number | null) => (p === null ? "–" : `${Math.round(p)}%`);

// Attendance for the whole session: this month, this week and the year.
export function AttendanceSummary({ studentId }: { studentId: string }) {
  const [days, setDays] = useState<Day[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const session = await currentSession();
      let q = supabase.from("daily_attendance").select("held_on, day_status").eq("student_id", studentId).order("held_on");
      if (session) q = q.eq("academic_year_id", session.id);
      const { data } = await q;
      if (active) setDays((data ?? []) as Day[]);
    })();
    return () => {
      active = false;
    };
  }, [studentId]);

  if (!days) return null;
  const month = days.filter((d) => d.held_on >= monthStart());
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toLocaleDateString("en-CA");
    return { iso, label: d.toLocaleDateString("en-GB", { weekday: "narrow" }), day: days.find((x) => x.held_on === iso) };
  });
  const mp = percentOf(month);
  const yp = percentOf(days);
  const count = (s: Day["day_status"]) => month.filter((d) => d.day_status === s).length;

  return (
    <section className="mt-4 rounded-[28px] border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Attendance</h2>
        <span className="text-sm text-sub">
          Session <span className={`font-medium tabular-nums ${tone(yp)}`}>{show(yp)}</span>
        </span>
      </div>
      {days.length === 0 ? (
        <p className="mt-2 text-sm text-sub">No attendance marked yet this session.</p>
      ) : (
        <>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-sub">This month</p>
              <p className={`text-[34px] font-medium leading-none tracking-tight tabular-nums ${tone(mp)}`}>{show(mp)}</p>
            </div>
            <dl className="grid grid-cols-3 gap-3 text-center text-xs text-sub">
              {(["present", "partial", "absent"] as const).map((s) => (
                <div key={s}>
                  <dd className="text-base font-medium text-ink tabular-nums">{count(s)}</dd>
                  <dt>{s === "partial" ? "Part" : DAY_LABEL[s]}</dt>
                </div>
              ))}
            </dl>
          </div>
          <ul className="mt-4 grid grid-cols-7 gap-1" aria-label="Last 7 days">
            {last7.map((d) => (
              <li key={d.iso} className="flex flex-col items-center gap-1.5">
                <span className="text-xs text-sub">{d.label}</span>
                <span
                  className={`size-7 rounded-full ${d.day ? DOT[d.day.day_status] : "border border-dashed border-line-strong"}`}
                  role="img"
                  aria-label={`${d.iso}: ${d.day ? DAY_LABEL[d.day.day_status] : "not marked"}`}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

type Account = { id: string; full_name: string; phone: string | null };
type StudentForLogins = { id: string; full_name: string; father_name: string | null; phone: string | null };

async function callFn(body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string; linked_existing?: boolean }> {
  const { data, error } = await supabase.functions.invoke("manage-users", { body });
  if (!error && data?.ok) return data;
  if (data?.error) return { error: data.error };
  if (error && typeof error === "object" && "context" in error) {
    try {
      return { error: (await (error as { context: Response }).context.json()).error };
    } catch {}
  }
  return { error: "That didn't go through. Check your connection and try again." };
}

export function ResetPassword({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (pw.length < 8) return setErr("Use at least 8 characters.");
    setBusy(true);
    const r = await callFn({ action: "reset", user_id: userId, password: pw });
    setBusy(false);
    if (r.error) return setErr(r.error);
    setMsg(`New password for ${name} is saved. Tell them: ${pw}`);
    setPw("");
  }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1 text-sm hover:bg-bg">
        <KeyRound aria-hidden className="size-4" strokeWidth={1.75} />
        Reset password
      </button>
    );

  return (
    <form onSubmit={save} noValidate className="mt-2 flex w-full flex-col gap-2">
      <Field label={`New password for ${name}`} id={`pw_${userId}`} autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} />
      <ErrorNote>{err}</ErrorNote>
      <OkNote>{msg}</OkNote>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="h-11 flex-1 rounded-full bg-navy text-[15px] font-medium text-white disabled:opacity-60">
          {busy ? "One moment" : "Save password"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-full px-4 text-[15px] text-sub">
          Close
        </button>
      </div>
    </form>
  );
}

function NewLogin({ role, student, onDone }: { role: "parent" | "student"; student: StudentForLogins; onDone: () => void }) {
  const [f, setF] = useState({
    full_name: role === "parent" ? student.father_name ?? "" : student.full_name,
    phone: role === "parent" ? student.phone ?? "" : "",
    password: "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (f.full_name.trim().length < 3) return setErr("Enter the full name.");
    if (!isValidPhone(f.phone)) return setErr("Enter an 11-digit mobile number, like 0300 1234567.");
    setBusy(true);
    const r = await callFn({ action: "create", role, student_id: student.id, ...f });
    setBusy(false);
    if (r.error) return setErr(r.error);
    onDone();
  }

  return (
    <form onSubmit={save} noValidate className="mt-3 flex flex-col gap-3 rounded-2xl bg-bg p-4">
      <Field label={role === "parent" ? "Parent's name" : "Student's name"} id={`${role}_name`} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
      <Field label="Phone number (used to sign in)" id={`${role}_phone`} type="tel" inputMode="numeric" placeholder="0300 1234567" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <Field
        label="Password"
        id={`${role}_pw`}
        autoComplete="off"
        placeholder={role === "parent" ? "Not needed if this parent already has a login" : "At least 8 characters"}
        value={f.password}
        onChange={(e) => setF({ ...f, password: e.target.value })}
      />
      <ErrorNote>{err}</ErrorNote>
      <PrimaryButton type="submit" busy={busy}>
        {role === "parent" ? "Give parent a login" : "Give student a login"}
      </PrimaryButton>
    </form>
  );
}

function AccountRow({ a, label, children }: { a: Account; label: string; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-3 last:border-b-0">
      <span className="flex flex-col">
        <span className="text-[15px]">{a.full_name}</span>
        <span className="text-sm text-sub tabular-nums">
          {label} · signs in with {a.phone}
        </span>
      </span>
      <span className="flex flex-wrap gap-2">
        <ResetPassword userId={a.id} name={a.full_name} />
        {children}
      </span>
    </li>
  );
}

// Parent and student logins for one student: add, link and reset passwords.
export function Logins({ student, profileId }: { student: StudentForLogins; profileId: string | null }) {
  const [parents, setParents] = useState<Account[]>([]);
  const [own, setOwn] = useState<Account | null>(null);
  const [adding, setAdding] = useState<"parent" | "student" | null>(null);
  const [unlink, setUnlink] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [note, setNote] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: links } = await supabase.from("parent_students").select("parent_id").eq("student_id", student.id);
      const ids = [...(links ?? []).map((l) => l.parent_id), ...(profileId ? [profileId] : [])];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name, phone").in("id", ids) : { data: [] };
      if (!active) return;
      const all = (profs ?? []) as Account[];
      setParents(all.filter((p) => p.id !== profileId));
      setOwn(all.find((p) => p.id === profileId) ?? null);
    })();
    return () => {
      active = false;
    };
  }, [student.id, profileId, version]);

  async function removeParent(id: string) {
    if (unlink !== id) return setUnlink(id);
    await supabase.from("parent_students").delete().eq("parent_id", id).eq("student_id", student.id);
    setUnlink(null);
    setVersion((v) => v + 1);
  }

  return (
    <section className="mt-4 rounded-[28px] border border-line bg-white p-5">
      <h2 className="text-base font-medium">Portal logins</h2>
      <p className="mt-1 text-sm text-sub">Parents see marks, attendance and fees. The student sees their own.</p>
      {(parents.length > 0 || own) && (
        <ul className="mt-2">
          {parents.map((p) => (
            <AccountRow key={p.id} a={p} label="Parent">
              <button
                type="button"
                onClick={() => removeParent(p.id)}
                className={`rounded-full px-3 py-1 text-sm ${unlink === p.id ? "bg-bad text-white" : "border border-line-strong text-sub hover:bg-bg"}`}
              >
                {unlink === p.id ? "Tap to remove" : "Remove"}
              </button>
            </AccountRow>
          ))}
          {own && <AccountRow a={own} label="Student" />}
        </ul>
      )}
      <OkNote>{note}</OkNote>
      {adding ? (
        <NewLogin
          role={adding}
          student={student}
          onDone={() => {
            setNote(adding === "parent" ? "Parent login ready. If they already had one, this child was added to it." : "Student login ready.");
            setAdding(null);
            setVersion((v) => v + 1);
          }}
        />
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setAdding("parent")} className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-medium text-ink">
            <UserPlus aria-hidden className="size-4" strokeWidth={1.75} />
            Add parent login
          </button>
          {!own && (
            <button type="button" onClick={() => setAdding("student")} className="flex items-center gap-1.5 rounded-full border border-line-strong px-4 py-2 text-sm hover:bg-bg">
              <UserPlus aria-hidden className="size-4" strokeWidth={1.75} />
              Add student login
            </button>
          )}
        </div>
      )}
    </section>
  );
}
