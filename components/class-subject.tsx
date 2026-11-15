"use client";
import { useEffect, useState } from "react";
import { SelectField } from "@/components/ui";
import { className, currentSession, type Session } from "@/lib/school";
import { loadMyClasses, type MyClass } from "@/lib/teacher";

// The classes this teacher teaches a subject in, and the current session.
export function useTeaching(teacherId: string) {
  const [classes, setClasses] = useState<MyClass[] | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([loadMyClasses(teacherId), currentSession()]).then(([all, s]) => {
      if (!active) return;
      setClasses(all.filter((c) => c.subjects.length > 0));
      setSession(s);
    });
    return () => {
      active = false;
    };
  }, [teacherId]);
  return { classes, session };
}

export function ClassSubjectFields({
  classes,
  classId,
  subjectId,
  onChange,
}: {
  classes: MyClass[];
  classId: string;
  subjectId: string;
  onChange: (classId: string, subjectId: string) => void;
}) {
  const subjects = classes.find((c) => c.id === classId)?.subjects ?? [];
  return (
    <div className="grid grid-cols-2 gap-3">
      <SelectField
        label="Class"
        id="cls"
        value={classId}
        onChange={(e) => {
          const subs = classes.find((c) => c.id === e.target.value)?.subjects ?? [];
          onChange(e.target.value, subs.length === 1 ? subs[0].id : "");
        }}
      >
        <option value="">Choose</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {className(c)}
          </option>
        ))}
      </SelectField>
      <SelectField label="Subject" id="sub" value={subjectId} onChange={(e) => onChange(classId, e.target.value)}>
        <option value="">Choose</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

// Pick the only class and subject if there is just one.
export function firstChoice(classes: MyClass[]) {
  if (classes.length !== 1) return { classId: "", subjectId: "" };
  return { classId: classes[0].id, subjectId: classes[0].subjects.length === 1 ? classes[0].subjects[0].id : "" };
}
