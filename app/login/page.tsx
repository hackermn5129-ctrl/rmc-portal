"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isRegNo, isUsername, isValidPhone, phoneToLoginId, regToLoginId, usernameToLoginId } from "@/lib/phone";
import { Card, Crest, ErrorNote, Field, PrimaryButton } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
    supabase.functions
      .invoke("manage-users", { body: { action: "status" } })
      .then(({ data }) => setNeedsSetup(Boolean(data?.needs_setup)));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const loginId = isValidPhone(phone) ? phoneToLoginId(phone) : isRegNo(phone) ? regToLoginId(phone) : isUsername(phone) ? usernameToLoginId(phone) : null;
    if (!loginId) {
      setError("Enter your phone number (0300 1234567) or, for students, your registration number.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginId, password });
    setBusy(false);
    if (error) {
      setError("That number or password isn't right. Try again.");
      return;
    }
    router.replace("/");
  }

  return (
    <main className="flex flex-1 flex-col px-6 pb-8 pt-16">
      <Crest />
      <Card className="mt-8">
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-1">
            <h1 className="text-[26px] font-medium tracking-tight">Sign in</h1>
            <p className="text-sm text-sub">For students, parents, teachers and staff</p>
          </div>
          <Field label="Phone number or registration no" id="phone" type="text" autoCapitalize="none" autoComplete="username" placeholder="0300 1234567 or 000083" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Field label="Password" id="password" type="password" autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <ErrorNote>{error}</ErrorNote>
          <PrimaryButton type="submit" busy={busy}>
            Sign in
          </PrimaryButton>
        </form>
      </Card>
      <p className="mt-auto pt-8 text-center text-[13px] text-sub">
        {needsSetup ? (
          <Link href="/setup" className="font-medium text-navy underline underline-offset-4">
            First time here? Set up the principal account
          </Link>
        ) : (
          "Forgot your password? Ask the school office to reset it."
        )}
      </p>
    </main>
  );
}
