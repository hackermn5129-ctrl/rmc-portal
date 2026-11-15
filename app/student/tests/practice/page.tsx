"use client";
import { FamilyPage } from "@/components/family/shell";
import { TakePractice } from "@/components/family/learn";
import { WithParams } from "@/components/route";

export default function Page() {
  return (
    <FamilyPage role="student" title="My test" back="/student/tests">
      {(ctx) => <WithParams render={(p) => (p.get("a") ? <TakePractice attemptId={p.get("a")!} base={ctx.base} /> : null)} />}
    </FamilyPage>
  );
}
