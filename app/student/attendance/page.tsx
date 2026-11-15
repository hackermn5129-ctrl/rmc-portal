"use client";
import { FamilyPage, classOf } from "@/components/family/shell";
import { AttendanceOverview } from "@/components/family/attendance";

export default function Page() {
  return (
    <FamilyPage role="student" title="Attendance" subtitle={(c) => `${c.full_name} · ${classOf(c)}`}>
      {(ctx) => <AttendanceOverview {...ctx} />}
    </FamilyPage>
  );
}
