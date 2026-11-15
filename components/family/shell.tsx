"use client";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Portal } from "@/components/portal";
import type { Profile } from "@/lib/supabase";
import { currentSession, useChild, type Child } from "@/lib/family";
import { className, type Session } from "@/lib/school";

export type FamilyRole = "student" | "parent";
export type Ctx = { child: Child; profile: Profile; session: Session | null; base: string };

let sessionPromise: Promise<Session | null> | null = null;
const getSession = () => (sessionPromise ??= currentSession());

export const classOf = (c: Child) => className(c.classes);
export const today = () => new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });

function ChildText({ profile, render }: { profile: Profile; render: (c: Child) => ReactNode }) {
  const { child } = useChild(profile);
  return <>{child ? render(child) : " "}</>;
}

function Body({ profile, role, render }: { profile: Profile; role: FamilyRole; render: (ctx: Ctx) => ReactNode }) {
  const { children, child, choose } = useChild(profile);
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getSession().then((s) => active && setSession(s));
    return () => {
      active = false;
    };
  }, []);

  if (!children || session === undefined) return <p className="mt-6 text-sm text-sub">Loading</p>;
  if (!child)
    return (
      <div className="mt-5 rounded-[28px] bg-navy p-5 text-white">
        <h2 className="text-xl font-medium">No student linked yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-mist">Please ask the school office to link your child to this login.</p>
      </div>
    );

  return (
    <>
      {children.length > 1 && (
        <div role="tablist" aria-label="Choose child" className="mt-4 flex gap-2 overflow-x-auto">
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === child.id}
              onClick={() => choose(c.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm ${c.id === child.id ? "border-navy bg-navy text-white" : "border-line-strong bg-white"}`}
            >
              {c.full_name.split(" ").slice(0, 2).join(" ")}
            </button>
          ))}
        </div>
      )}
      <Fragment key={child.id}>{render({ child, profile, session, base: `/${role}` })}</Fragment>
    </>
  );
}

// A student or parent page. Title and subtitle can use the chosen child.
export function FamilyPage({
  role,
  title,
  subtitle,
  back,
  children,
}: {
  role: FamilyRole;
  title: string | ((c: Child) => ReactNode);
  subtitle?: (c: Child) => ReactNode;
  back?: string;
  children: (ctx: Ctx) => ReactNode;
}) {
  return (
    <Portal
      role={role}
      back={back}
      title={typeof title === "string" ? title : (p) => <ChildText profile={p} render={title} />}
      subtitle={(p) => <ChildText profile={p} render={(c) => (subtitle ? subtitle(c) : `${classOf(c)} · ${today()}`)} />}
    >
      {(p) => <Body profile={p} role={role} render={children} />}
    </Portal>
  );
}
