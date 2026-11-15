"use client";
import { FamilyPage } from "@/components/family/shell";
import { Review } from "@/components/family/learn";
import { WithParams } from "@/components/route";

export default function Page() {
  return (
    <FamilyPage role="student" title="Result" back="/student/tests">
      {(ctx) => <WithParams render={(p) => <Review attemptId={p.get("a")} practiceId={p.get("p")} base={ctx.base} />} />}
    </FamilyPage>
  );
}
