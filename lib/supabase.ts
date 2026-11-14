import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

export type Role = "admin" | "teacher" | "student" | "parent";
export type Profile = { id: string; role: Role; full_name: string; phone: string | null };
