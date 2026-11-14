"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";

type ClassRow = { id: string; name: string; section: string; count: number };

function Classes() {
  const [classes, setClasses] = useState<ClassRow[] | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("classes").select("id, name, section"),
      supabase.from("students").select("class_id").eq("status", "active"),
    ]).then(([cls, st]) => {
      const counts = new Map<string, number>();
      for (const s of st.data ?? []) if (s.class_id) counts.set(s.class_id, (counts.get(s.class_id) ?? 0) + 1);
      const rows = (cls.data ?? []).map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }));
      rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || a.section.localeCompare(b.section));
      setClasses(rows);
    });
  }, []);

  if (!classes) return <p className="mt-6 text-sm text-sub">Loading classes</p>;

  return (
    <div className="mt-5 rounded-3xl border border-line bg-white px-4 py-1">
      {classes.length === 0 ? (
        <p className="py-4 text-sm text-sub">Add classes from the home screen first.</p>
      ) : (
        <ul>
          {classes.map((c) => (
            <li key={c.id} className="border-b border-line last:border-b-0">
              <Link href={`/admin/classes/${c.id}`} className="flex h-14 items-center justify-between">
                <span className="text-[15px]">
                  {c.name}
                  {c.section ? `-${c.section}` : ""}
                </span>
                <span className="flex items-center gap-2 text-sm text-sub tabular-nums">
                  {c.count} {c.count === 1 ? "student" : "students"}
                  <ChevronRight aria-hidden className="size-[18px]" strokeWidth={1.75} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function StudentsPage() {
  return (
    <Portal role="admin" title="Students" back="/admin">
      {() => <Classes />}
    </Portal>
  );
}
