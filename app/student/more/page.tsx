"use client";
import { Portal } from "@/components/portal";
import { More } from "@/components/family/fees";

export default function Page() {
  return (
    <Portal role="student" title="More" back="/student">
      {(p) => <More profile={p} />}
    </Portal>
  );
}
