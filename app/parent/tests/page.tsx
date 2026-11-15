"use client";
import { FamilyPage } from "@/components/family/shell";
import { McqList } from "@/components/family/learn";

export default function Page() {
  return (
    <FamilyPage role="parent" title="Online tests" back="/parent/progress">
      {(ctx) => <McqList {...ctx} />}
    </FamilyPage>
  );
}
