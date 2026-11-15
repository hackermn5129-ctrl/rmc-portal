"use client";
import { Portal } from "@/components/portal";
import { More } from "@/components/family/fees";

export default function Page() {
  return (
    <Portal role="parent" title="More" back="/parent">
      {(p) => <More profile={p} />}
    </Portal>
  );
}
