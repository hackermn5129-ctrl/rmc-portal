"use client";
import { FamilyPage } from "@/components/family/shell";
import { Review } from "@/components/family/learn";
import { WithQuery } from "@/components/route";

export default function Page() {
  return (
    <FamilyPage role="student" title="Result" back="/student/tests">
      {(ctx) => <WithQuery name="a" render={(a) => (a ? <Review attemptId={a} base={ctx.base} /> : null)} />}
    </FamilyPage>
  );
}
