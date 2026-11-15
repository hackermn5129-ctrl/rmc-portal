"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, type Profile, type Role } from "./supabase";

// Loads the signed-in person's profile. Sends them to /login when signed out,
// and to their own home when they open a page meant for another role.
export function useProfile(required?: Role | Role[]) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, role, full_name, phone")
        .eq("id", auth.session.user.id)
        .maybeSingle();
      if (!active) return;
      if (!data) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }
      const allowed = required === undefined ? null : Array.isArray(required) ? required : [required];
      if (allowed && !allowed.includes(data.role)) {
        router.replace(`/${data.role}`);
        return;
      }
      setProfile(data as Profile);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [String(required), router]);

  return { profile, loading };
}
