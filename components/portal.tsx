"use client";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, GraduationCap, House, LogOut, Users, Wallet } from "lucide-react";
import { supabase, type Profile, type Role } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";

const ROLE_LABEL: Record<Role, string> = { admin: "Principal", teacher: "Teacher", student: "Student", parent: "Parent" };

const ADMIN_NAV = [
  { href: "/admin", label: "Home", Icon: House, match: (p: string) => p === "/admin" },
  { href: "/admin/students", label: "Students", Icon: GraduationCap, match: (p: string) => p.startsWith("/admin/students") || p.startsWith("/admin/classes") },
  { href: "/admin/teachers", label: "Teachers", Icon: Users, match: (p: string) => p.startsWith("/admin/teachers") },
  { href: "/admin/fees", label: "Fees", Icon: Wallet, match: (p: string) => p.startsWith("/admin/fees") },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-[430px] px-5 pb-4 print:hidden">
      <div className="grid grid-cols-4 gap-1 rounded-[32px] border border-line bg-white p-2 shadow-[0_8px_24px_rgba(19,35,58,0.08)]">
        {ADMIN_NAV.map(({ href, label, Icon, match }) => {
          const on = match(path);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-3xl text-xs ${on ? "bg-navy font-medium text-white" : "text-sub hover:bg-bg"}`}
            >
              <Icon aria-hidden className="size-[18px]" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Portal({
  role,
  title,
  subtitle,
  back,
  children,
}: {
  role: Role;
  /** A function is worked out only after sign-in, in the browser (e.g. for today's month). */
  title: string | (() => string);
  subtitle?: string;
  back?: string;
  children: (profile: Profile) => ReactNode;
}) {
  const router = useRouter();
  const { profile, loading } = useProfile(role);
  if (loading || !profile) return <p className="m-auto text-sm text-sub">Opening your portal</p>;

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const isAdmin = profile.role === "admin";

  return (
    <main className={`flex flex-1 flex-col px-5 pt-12 print:p-0 ${isAdmin ? "pb-32" : "pb-8"}`}>
      <header className="flex items-center justify-between gap-3 print:hidden">
        {back && (
          <Link href={back} aria-label="Back" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-white hover:bg-bg">
            <ArrowLeft aria-hidden className="size-[18px]" strokeWidth={1.75} />
          </Link>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="truncate text-[22px] font-medium tracking-tight">{typeof title === "function" ? title() : title}</h1>
          <p className="truncate text-sm text-sub">{subtitle ?? `${profile.full_name} · ${ROLE_LABEL[profile.role]}`}</p>
        </div>
        {isAdmin ? (
          <Link
            href="/admin/settings"
            aria-label="Profile and school setup"
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-white text-sm font-medium hover:bg-bg"
          >
            {initials(profile.full_name)}
          </Link>
        ) : (
          <button type="button" onClick={signOut} aria-label="Sign out" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-white hover:bg-bg">
            <LogOut aria-hidden className="size-[18px]" strokeWidth={1.75} />
          </button>
        )}
      </header>
      {children(profile)}
      {isAdmin && <AdminNav />}
    </main>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await supabase.auth.signOut();
        router.replace("/login");
      }}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-full border border-line-strong bg-white text-[15px] font-medium text-bad hover:bg-bg"
    >
      <LogOut aria-hidden className="size-[18px]" strokeWidth={1.75} />
      Sign out
    </button>
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
