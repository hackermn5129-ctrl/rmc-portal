"use client";
import { FamilyPage } from "@/components/family/shell";
import { Lectures } from "@/components/family/learn";

export default function Page() {
  return (
    <FamilyPage role="student" title="Lectures">
      {(ctx) => <Lectures {...ctx} />}
    </FamilyPage>
  );
}
