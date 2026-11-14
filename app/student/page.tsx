"use client";
import { ComingSoon, Portal } from "@/components/portal";

export default function Page() {
  return (
    <Portal role="student" title="Home">
      {() => <ComingSoon what="Your tests, lectures and results" />}
    </Portal>
  );
}
