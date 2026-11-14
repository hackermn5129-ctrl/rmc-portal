"use client";
import { ComingSoon, Portal } from "@/components/portal";

export default function Page() {
  return (
    <Portal role="parent" title="Home">
      {() => <ComingSoon what="Your child's attendance, marks and fees" />}
    </Portal>
  );
}
