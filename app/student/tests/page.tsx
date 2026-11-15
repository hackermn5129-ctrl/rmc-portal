"use client";
import { FamilyPage } from "@/components/family/shell";
import { TestsHub } from "@/components/family/learn";
import { WithParams } from "@/components/route";

export default function Page() {
  return (
    <FamilyPage role="student" title="Tests">
      {(ctx) => <WithParams render={(p) => <TestsHub ctx={ctx} subjectId={p.get("s")} />} />}
    </FamilyPage>
  );
}
