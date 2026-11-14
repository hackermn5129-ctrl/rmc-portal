"use client";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { supabase, type Profile, type Role } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";

const ROLE_LABEL: Record<Role, string> = { admin: "Principal", teacher: "Teacher", student: "Student", parent: "Parent" };

export function Portal({ role, title, back, children }: { role: Role; title: string; back?: string; children: (profile: Profile) => ReactNode }) {
  const router = useRouter();
  const { profile, loading } = useProfile(role);
  if (loading || !profile) return <p className="m-auto text-sm text-sub">Opening your portal</p>;

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="flex flex-1 flex-col px-5 pb-8 pt-12 print:p-0">
      <header className="flex items-center justify-between gap-3 print:hidden">
        {back && (
          <Link href={back} aria-label="Back" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-white hover:bg-bg">
            <ArrowLeft aria-hidden className="size-[18px]" strokeWidth={1.75} />
          </Link>
        )}
        <div className="flex flex-1 flex-col gap-0.5">
          <h1 className="text-[22px] font-medium tracking-tight">{title}</h1>
          <p className="text-sm text-sub">
            {profile.full_name} · {ROLE_LABEL[profile.role]}
          </p>
        </div>
        <button type="button" onClick={signOut} aria-label="Sign out" className="flex size-11 items-center justify-center rounded-full border border-line-strong bg-white hover:bg-bg">
          <LogOut aria-hidden className="size-[18px]" strokeWidth={1.75} />
        </button>
      </header>
      {children(profile)}
    </main>
  );
}

export function ComingSoon({ what }: { what: string }) {
  return (
    <div className="mt-5 rounded-[28px] bg-navy p-5 text-bg">
      <p className="text-sm text-mist">You&apos;re signed in</p>
      <h2 className="mt-1 text-2xl font-medium leading-tight tracking-tight">{what}</h2>
      <p className="mt-2 text-sm leading-relaxed text-mist">This part of the portal is being built. Your account already works.</p>
    </div>
  );
}
