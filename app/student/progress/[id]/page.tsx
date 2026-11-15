"use client";
import { FamilyPage, classOf } from "@/components/family/shell";
import { SubjectProgress } from "@/components/family/progress";
import { WithId } from "@/components/route";

export default function Page() {
  return (
    <FamilyPage role="student" title="Every test" back="/student/progress" subtitle={(c) => `${c.full_name} · ${classOf(c)}`}>
      {(ctx) => <WithId render={(id) => <SubjectProgress {...ctx} subjectId={id} />} />}
    </FamilyPage>
  );
}
