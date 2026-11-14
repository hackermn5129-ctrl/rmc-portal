"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isValidPhone, phoneToLoginId } from "@/lib/phone";
import { Card, ErrorNote, Field, PrimaryButton } from "@/components/ui";

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: "", phone: "", password: "", setup_code: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (form.full_name.trim().length < 3) return setError("Enter the principal's full name.");
    if (!isValidPhone(form.phone)) return setError("Enter an 11-digit mobile number, like 0300 1234567.");
    if (form.password.length < 8) return setError("Use a password with at least 8 characters.");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("manage-users", { body: { action: "bootstrap", ...form } });
    if (error || !data?.ok) {
      setBusy(false);
      let message = data?.error as string | undefined;
      if (!message && error && "context" in error) {
        try {
          message = (await (error.context as Response).json()).error;
        } catch {}
      }
      return setError(message ?? "Setup didn't go through. Check your connection and try again.");
    }
    const signIn = await supabase.auth.signInWithPassword({ email: phoneToLoginId(form.phone), password: form.password });
    setBusy(false);
    router.replace(signIn.error ? "/login" : "/admin");
  }

  return (
    <main className="flex flex-1 flex-col px-6 pb-8 pt-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-medium tracking-tight">Set up the principal account</h1>
        <p className="text-sm leading-relaxed text-sub">This works once. After it, every other account is made from inside the admin portal.</p>
      </div>
      <Card className="mt-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <Field label="Full name" id="full_name" autoComplete="name" value={form.full_name} onChange={set("full_name")} />
          <Field label="Phone number" id="phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="0300 1234567" value={form.phone} onChange={set("phone")} />
          <Field label="Choose a password" id="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={set("password")} />
          <Field label="Setup code" id="setup_code" type="password" autoComplete="off" placeholder="Your one-time code" value={form.setup_code} onChange={set("setup_code")} />
          <ErrorNote>{error}</ErrorNote>
          <PrimaryButton type="submit" busy={busy}>
            Create account
          </PrimaryButton>
        </form>
      </Card>
      <Link href="/login" className="mt-6 py-3 text-center text-sm text-navy">
        Back to sign in
      </Link>
    </main>
  );
}
