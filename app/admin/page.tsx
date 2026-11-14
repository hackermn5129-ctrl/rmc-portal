"use client";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { ErrorNote, Field, PrimaryButton } from "@/components/ui";

type ClassRow = { id: string; name: string; section: string };

async function fetchOverview() {
  const [students, teachers, cls] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher"),
    supabase.from("classes").select("id, name, section").order("name").order("section"),
  ]);
  return {
    counts: { students: students.count ?? 0, teachers: teachers.count ?? 0 },
    classes: (cls.data ?? []) as ClassRow[],
  };
}

function Overview() {
  const [counts, setCounts] = useState({ students: 0, teachers: 0 });
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    fetchOverview().then((data) => {
      if (!active) return;
      setCounts(data.counts);
      setClasses(data.classes);
    });
    return () => {
      active = false;
    };
  }, [version]);

  async function addClass(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Enter a class name, like Class 8.");
    setBusy(true);
    const { error } = await supabase.from("classes").insert({ name: name.trim(), section: section.trim().toUpperCase() });
    setBusy(false);
    if (error) return setError(error.code === "23505" ? "That class and section already exist." : "The class wasn't saved. Try again.");
    setName("");
    setSection("");
    setVersion((v) => v + 1);
  }

  const stats = [
    { label: "Students", value: counts.students },
    { label: "Teachers", value: counts.teachers },
    { label: "Classes", value: classes.length },
  ];

  return (
    <>
      <section aria-label="School totals" className="mt-5 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-2 rounded-3xl border border-line bg-white px-4 py-3.5">
            <span className="text-sm text-sub">{s.label}</span>
            <span className="text-[28px] font-medium leading-none tracking-tight tabular-nums">{s.value}</span>
          </div>
        ))}
      </section>

      <h2 className="mt-6 text-base font-medium">Classes</h2>
      <div className="mt-3 rounded-3xl border border-line bg-white px-4 py-1">
        {classes.length === 0 ? (
          <p className="py-4 text-sm leading-relaxed text-sub">Start by adding your classes below. Teachers and students come next.</p>
        ) : (
          <ul>
            {classes.map((c) => (
              <li key={c.id} className="flex h-14 items-center justify-between border-b border-line last:border-b-0">
                <span className="text-[15px]">
                  {c.name}
                  {c.section ? `-${c.section}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="mt-6 text-base font-medium">Add a class</h2>
      <form onSubmit={addClass} noValidate className="mt-3 flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5">
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Field label="Class name" id="class_name" placeholder="Class 8" value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Section" id="class_section" placeholder="A" maxLength={3} value={section} onChange={(e) => setSection(e.target.value)} />
        </div>
        <ErrorNote>{error}</ErrorNote>
        <PrimaryButton type="submit" busy={busy}>
          Add class
        </PrimaryButton>
      </form>
    </>
  );
}

export default function AdminPage() {
  return (
    <Portal role="admin" title="School overview">
      {() => <Overview />}
    </Portal>
  );
}
