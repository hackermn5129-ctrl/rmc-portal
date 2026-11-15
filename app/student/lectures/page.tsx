"use client";
import { FamilyPage } from "@/components/family/shell";
import { LecturesHub } from "@/components/family/learn";
import { WithParams } from "@/components/route";

export default function Page() {
  return (
    <FamilyPage role="student" title="Lectures">
      {(ctx) => <WithParams render={(p) => <LecturesHub ctx={ctx} subjectId={p.get("s")} chapterId={p.get("c")} />} />}
    </FamilyPage>
  );
}
