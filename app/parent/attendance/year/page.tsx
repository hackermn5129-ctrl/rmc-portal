"use client";
import { FamilyPage, classOf } from "@/components/family/shell";
import { AttendanceYear } from "@/components/family/attendance";

export default function Page() {
  return (
    <FamilyPage role="parent" title="Whole year" back="/parent/attendance" subtitle={(c) => `${c.full_name} · ${classOf(c)}`}>
      {(ctx) => <AttendanceYear {...ctx} />}
    </FamilyPage>
  );
}
