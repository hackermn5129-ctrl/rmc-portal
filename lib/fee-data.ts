import { supabase } from "./supabase";
import { monthStart } from "./fees";
import { loadClasses, type ClassRow } from "./school";

export type StudentLite = { id: string; full_name: string; father_name: string | null; class_id: string | null; phone: string | null; roll_no: string | null; reg_no: string | null };
export type Balance = { student_id: string; total_due: number; total_paid: number; outstanding: number; unpaid_months: number; oldest_unpaid: string | null };
export const ALERT_MONTHS = 2;

export type FeeOverview = {
  noSession: boolean;
  classes: ClassRow[];
  students: StudentLite[];
  balances: Map<string, Balance>;
  month: { due: number; paid: number };
};

// Makes this month's fee records (safe to repeat), then loads everything the fee screens need.
export async function loadFeeOverview(): Promise<FeeOverview> {
  const gen = await supabase.rpc("generate_fee_records", { p_month: monthStart() });
  const noSession = !!gen.error && /NO_SESSION/.test(gen.error.message);

  const [classes, st, bal, month] = await Promise.all([
    loadClasses(),
    supabase.from("students").select("id, full_name, father_name, class_id, phone, roll_no, reg_no").eq("status", "active").order("full_name"),
    supabase.from("student_fee_balance").select("*"),
    supabase.from("fee_status").select("amount_due, amount_paid").eq("month", monthStart()),
  ]);

  const balances = new Map<string, Balance>();
  for (const b of bal.data ?? [])
    balances.set(b.student_id, {
      ...b,
      total_due: Number(b.total_due),
      total_paid: Number(b.total_paid),
      outstanding: Number(b.outstanding),
      unpaid_months: Number(b.unpaid_months),
    } as Balance);

  const due = (month.data ?? []).reduce((a, r) => a + Number(r.amount_due), 0);
  const paid = (month.data ?? []).reduce((a, r) => a + Math.min(Number(r.amount_paid), Number(r.amount_due)), 0);

  return { noSession, classes, students: (st.data ?? []) as StudentLite[], balances, month: { due, paid } };
}

export const isPending = (b?: Balance) => !!b && b.outstanding > 0;
export const isAlert = (b?: Balance) => !!b && b.outstanding > 0 && b.unpaid_months >= ALERT_MONTHS;
