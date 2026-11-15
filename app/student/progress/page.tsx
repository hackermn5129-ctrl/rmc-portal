"use client";
import { FamilyPage, classOf } from "@/components/family/shell";
import { Progress } from "@/components/family/progress";

export default function Page() {
  return (
    <FamilyPage role="student" title="Progress" subtitle={(c) => `${c.full_name} · ${classOf(c)}`}>
      {(ctx) => <Progress {...ctx} />}
    </FamilyPage>
  );
}
