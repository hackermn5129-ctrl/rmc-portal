"use client";
import { ComingSoon, Portal } from "@/components/portal";

export default function Page() {
  return (
    <Portal role="teacher" title="Home">
      {() => <ComingSoon what="Attendance, tests and results for your classes" />}
    </Portal>
  );
}
