"use client";
import { FamilyPage } from "@/components/family/shell";
import { TakeTest } from "@/components/family/learn";
import { WithId } from "@/components/route";

export default function Page() {
  return (
    <FamilyPage role="student" title="MCQ test" back="/student/tests">
      {(ctx) => <WithId render={(id) => <TakeTest testId={id} {...ctx} />} />}
    </FamilyPage>
  );
}
