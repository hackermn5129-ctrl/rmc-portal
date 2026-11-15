"use client";
import { FamilyPage, classOf } from "@/components/family/shell";
import { AttendanceMonth } from "@/components/family/attendance";
import { WithQuery } from "@/components/route";

export default function Page() {
  return (
    <FamilyPage role="student" title="Whole month" back="/student/attendance" subtitle={(c) => `${c.full_name} · ${classOf(c)}`}>
      {(ctx) => <WithQuery name="m" render={(m) => <AttendanceMonth {...ctx} month={m} />} />}
    </FamilyPage>
  );
}
