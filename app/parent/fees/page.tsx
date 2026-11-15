"use client";
import { FamilyPage, classOf } from "@/components/family/shell";
import { Fees } from "@/components/family/fees";

export default function Page() {
  return (
    <FamilyPage role="parent" title="Fees" subtitle={(c) => `${c.full_name} · ${classOf(c)}`}>
      {(ctx) => <Fees {...ctx} />}
    </FamilyPage>
  );
}
