"use client";
import { FamilyPage } from "@/components/family/shell";
import { ResourcesHub, type Kind } from "@/components/family/resources";
import { WithParams } from "@/components/route";

const KINDS = ["short", "long", "mcq", "ebook"];

export default function Page() {
  return (
    <FamilyPage role="student" title="Resources">
      {(ctx) => (
        <WithParams
          render={(p) => {
            const k = p.get("k");
            return <ResourcesHub ctx={ctx} subjectId={p.get("s")} kind={k && KINDS.includes(k) ? (k as Kind) : null} chapterId={p.get("c")} bookId={p.get("b")} />;
          }}
        />
      )}
    </FamilyPage>
  );
}
