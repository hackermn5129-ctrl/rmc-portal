"use client";
import { FamilyPage } from "@/components/family/shell";
import { TestsHub } from "@/components/family/learn";
import { WithParams } from "@/components/route";

export default function Page() {
  return (
    <FamilyPage role="parent" title="Online tests" back="/parent/progress">
      {(ctx) => <WithParams render={(p) => <TestsHub ctx={ctx} subjectId={p.get("s")} />} />}
    </FamilyPage>
  );
}
