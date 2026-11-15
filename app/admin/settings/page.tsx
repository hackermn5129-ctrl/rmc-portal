"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { BedDouble, ChevronRight, FileText, Library, ListChecks, Megaphone, PlayCircle, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Portal, SignOutButton } from "@/components/portal";
import { ErrorNote, Field, OkNote, PrimaryButton } from "@/components/ui";
import { className, loadClasses, type ClassRow, type Session } from "@/lib/school";

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5">
      <h2 className="text-base font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Sessions() {
  const [rows, setRows] = useState<Session[]>([]);
  const [version, setVersion] = useState(0);
  const year = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const [form, setForm] = useState({ name: `${year}-${String(year + 1).slice(2)}`, starts_on: `${year}-04-01`, ends_on: `${year + 1}-03-31` });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("academic_years")
      .select("id, name, starts_on, ends_on, is_current")
      .order("starts_on", { ascending: false })
      .then(({ data }) => active && setRows((data ?? []) as Session[]));
    return () => {
      active = false;
    };
  }, [version]);

  async function makeCurrent(id: string) {
    setError("");
    await supabase.from("academic_years").update({ is_current: false }).neq("id", id);
    const { error } = await supabase.from("academic_years").update({ is_current: true }).eq("id", id);
    if (error) setError("That didn't save. Try again.");
    setVersion((v) => v + 1);
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (!form.name.trim()) return setError("Name the session, like 2026-27.");
    if (!form.starts_on || !form.ends_on || form.ends_on <= form.starts_on) return setError("The end date must be after the start date.");
    setBusy(true);
    const first = rows.length === 0;
    const { data, error } = await supabase
      .from("academic_years")
      .insert({ name: form.name.trim(), starts_on: form.starts_on, ends_on: form.ends_on, is_current: false })
      .select("id")
      .single();
    if (!error && first && data) await makeCurrent(data.id);
    setBusy(false);
    if (error) return setError(error.code === "23505" ? "A session with that name already exists." : "The session wasn't saved. Try again.");
    setOk("Session added.");
    setVersion((v) => v + 1);
  }

  return (
    <Box title="Academic session">
      <p className="text-sm leading-relaxed text-sub">Fees, tests and attendance are saved under the current session. Earlier sessions stay saved.</p>
      {rows.length > 0 && (
        <ul className="rounded-2xl bg-bg px-4 py-1">
          {rows.map((s) => (
            <li key={s.id} className="flex h-14 items-center justify-between border-b border-line last:border-b-0">
              <span className="text-[15px]">{s.name}</span>
              {s.is_current ? (
                <span className="rounded-full bg-navy px-3 py-1 text-sm text-white">Current</span>
              ) : (
                <button type="button" onClick={() => makeCurrent(s.id)} className="rounded-full border border-line-strong bg-white px-3 py-1 text-sm hover:bg-bg">
                  Make current
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} noValidate className="flex flex-col gap-4">
        <Field label="Session name" id="session_name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" id="starts_on" type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} />
          <Field label="Ends" id="ends_on" type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} />
        </div>
        <ErrorNote>{error}</ErrorNote>
        <OkNote>{ok}</OkNote>
        <PrimaryButton type="submit" busy={busy}>
          Add session
        </PrimaryButton>
      </form>
    </Box>
  );
}

function Subjects() {
  const [rows, setRows] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    supabase
      .from("subjects")
      .select("id, name")
      .order("name")
      .then(({ data }) => active && setRows(data ?? []));
    return () => {
      active = false;
    };
  }, [version]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Enter a subject, like Physics.");
    const { error } = await supabase.from("subjects").insert({ name: name.trim() });
    if (error) return setError(error.code === "23505" ? "That subject is already there." : "The subject wasn't saved.");
    setName("");
    setVersion((v) => v + 1);
  }

  return (
    <Box title="Subjects">
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rows.map((s) => (
            <span key={s.id} className="rounded-full bg-bg px-3 py-1.5 text-sm">
              {s.name}
            </span>
          ))}
        </div>
      )}
      <form onSubmit={add} noValidate className="flex flex-col gap-3">
        <Field label="New subject" id="subject" placeholder="Physics" value={name} onChange={(e) => setName(e.target.value)} />
        <ErrorNote>{error}</ErrorNote>
        <PrimaryButton type="submit">Add subject</PrimaryButton>
      </form>
    </Box>
  );
}

function Classes() {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    loadClasses().then((r) => active && setRows(r));
    return () => {
      active = false;
    };
  }, [version]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Enter a class name, like Class 8.");
    const { error } = await supabase.from("classes").insert({ name: name.trim(), section: section.trim().toUpperCase() });
    if (error) return setError(error.code === "23505" ? "That class and section already exist." : "The class wasn't saved. Try again.");
    setName("");
    setSection("");
    setVersion((v) => v + 1);
  }

  return (
    <Box title="Classes">
      <div className="flex flex-wrap gap-2">
        {rows.map((c) => (
          <span key={c.id} className="rounded-full bg-bg px-3 py-1.5 text-sm">
            {className(c)}
          </span>
        ))}
      </div>
      <form onSubmit={add} noValidate className="flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Field label="Class name" id="class_name" placeholder="Class 8" value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Section" id="class_section" placeholder="A" maxLength={3} value={section} onChange={(e) => setSection(e.target.value)} />
        </div>
        <ErrorNote>{error}</ErrorNote>
        <PrimaryButton type="submit">Add class</PrimaryButton>
      </form>
    </Box>
  );
}

export default function SettingsPage() {
  return (
    <Portal role="admin" title="School setup" back="/admin">
      {() => (
        <>
          <ul className="mt-5 rounded-3xl border border-line bg-white px-4 py-1">
            {[
              { href: "/teacher/tests", label: "My test marks", note: "Enter marks for the subjects you teach", Icon: FileText },
              { href: "/teacher/mcq", label: "My MCQ tests", note: "Online tests students take on the phone", Icon: ListChecks },
              { href: "/teacher/lectures", label: "My video lectures", note: "YouTube lessons by book chapter", Icon: PlayCircle },
              { href: "/teacher/resources", label: "Study resources", note: "Short and long questions, practice MCQs, e-books", Icon: Library },
              { href: "/admin/notices", label: "Notices", note: "Send news to parents, students or teachers", Icon: Megaphone },
              { href: "/admin/promote", label: "Promote students", note: "Move everyone up at the end of a session", Icon: TrendingUp },
              { href: "/admin/rates", label: "Hostel rates", note: "Rent and mess for each hostel type", Icon: BedDouble },
            ].map(({ href, label, note, Icon }) => (
              <li key={href} className="border-b border-line last:border-b-0">
                <Link href={href} className="flex items-center justify-between gap-3 py-3">
                  <span className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-bg">
                      <Icon aria-hidden className="size-[18px] text-navy" strokeWidth={1.75} />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[15px]">{label}</span>
                      <span className="text-sm text-sub">{note}</span>
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-[18px] text-sub" strokeWidth={1.75} />
                </Link>
              </li>
            ))}
          </ul>
          <Sessions />
          <Subjects />
          <Classes />
          <div className="mt-6">
            <SignOutButton />
          </div>
        </>
      )}
    </Portal>
  );
}
