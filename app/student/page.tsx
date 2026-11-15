"use client";
import { FamilyPage, classOf, today } from "@/components/family/shell";
import { StudentHome } from "@/components/family/home";

export default function Page() {
  return (
    <FamilyPage role="student" title={() => today()} subtitle={(c) => `${c.full_name} · ${classOf(c)}${c.reg_no ? ` · ${c.reg_no}` : ""}`}>
      {(ctx) => <StudentHome {...ctx} />}
    </FamilyPage>
  );
}
