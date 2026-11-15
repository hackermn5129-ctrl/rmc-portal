"use client";
import { FamilyPage, classOf, today } from "@/components/family/shell";
import { ParentHome } from "@/components/family/home";

export default function Page() {
  return (
    <FamilyPage role="parent" title={(c) => c.full_name} subtitle={(c) => `${classOf(c)} · ${today()}`}>
      {(ctx) => <ParentHome {...ctx} />}
    </FamilyPage>
  );
}
