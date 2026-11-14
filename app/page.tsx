"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/useProfile";

export default function Home() {
  const router = useRouter();
  const { profile } = useProfile();
  useEffect(() => {
    if (profile) router.replace(`/${profile.role}`);
  }, [profile, router]);
  return <p className="m-auto text-sm text-sub">Opening your portal</p>;
}
