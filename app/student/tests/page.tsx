"use client";
import { FamilyPage } from "@/components/family/shell";
import { McqList } from "@/components/family/learn";

export default function Page() {
  return (
    <FamilyPage role="student" title="Tests">
      {(ctx) => <McqList {...ctx} />}
    </FamilyPage>
  );
}
