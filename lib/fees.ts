export type Residence = "day_scholar" | "hostel_simple" | "hostel_cooler" | "hostel_ac";

export const RESIDENCES: { value: Residence; label: string; urdu: string }[] = [
  { value: "day_scholar", label: "Day scholar", urdu: "ڈے سکالر" },
  { value: "hostel_simple", label: "Simple hostel", urdu: "سادہ ہاسٹل" },
  { value: "hostel_cooler", label: "Cooler hostel", urdu: "کولر ہاسٹل" },
  { value: "hostel_ac", label: "AC hostel", urdu: "اے سی ہاسٹل" },
];

export const residenceLabel = (r: Residence) => RESIDENCES.find((x) => x.value === r)?.label ?? r;

export type HostelRate = { residence: Residence; monthly_rent: number; mess_fee: number };

// School-wide charges set once on the Fee rates page.
export type FeeRates = { tuition_upto_8: number; tuition_9_10: number; hostel_extra_9_10: number; annual: number; lunch: number; transport_near: number; transport_far: number };
export const emptyRates: FeeRates = { tuition_upto_8: 0, tuition_9_10: 0, hostel_extra_9_10: 0, annual: 0, lunch: 0, transport_near: 0, transport_far: 0 };

// Academic fee for a class: Class 9 and 10 pay the higher one.
export function tuitionFor(rates: FeeRates, grades?: number[] | null): number {
  return (grades ?? []).some((g) => g >= 9) ? rates.tuition_9_10 : rates.tuition_upto_8;
}

// Class 9 and 10 pay a little more for the hostel than the base rate.
export function hostelExtraFor(rates: FeeRates, grades?: number[] | null): number {
  return (grades ?? []).some((g) => g >= 9) ? rates.hostel_extra_9_10 : 0;
}

export type FeePlan = {
  id: string;
  student_id: string;
  effective_from: string;
  residence: Residence;
  tuition_fee: number;
  hostel_rent: number;
  mess_fee: number;
  other_fee: number;
  other_note: string | null;
  monthly_total: number;
};

export type FeeDraft = {
  residence: Residence;
  tuition_fee: string;
  hostel_rent: string;
  mess_fee: string;
  other_fee: string;
  other_note: string;
};

export const emptyDraft: FeeDraft = {
  residence: "day_scholar",
  tuition_fee: "",
  hostel_rent: "0",
  mess_fee: "0",
  other_fee: "0",
  other_note: "",
};

export function draftFromPlan(p: FeePlan): FeeDraft {
  return {
    residence: p.residence,
    tuition_fee: String(p.tuition_fee),
    hostel_rent: String(p.hostel_rent),
    mess_fee: String(p.mess_fee),
    other_fee: String(p.other_fee),
    other_note: p.other_note ?? "",
  };
}

const num = (s: string) => {
  const n = Number(s.replace(/,/g, "").trim() || "0");
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

// Checks a draft and returns the numbers to save, or an error message.
export function readDraft(d: FeeDraft): { error: string } | { values: Omit<FeePlan, "id" | "student_id" | "effective_from" | "monthly_total"> } {
  if (!d.tuition_fee.trim()) return { error: "Enter the monthly tuition fee." };
  const day = d.residence === "day_scholar";
  const values = {
    residence: d.residence,
    tuition_fee: num(d.tuition_fee),
    hostel_rent: day ? 0 : num(d.hostel_rent),
    mess_fee: day ? 0 : num(d.mess_fee),
    other_fee: num(d.other_fee),
    other_note: d.other_note.trim() || null,
  };
  if ([values.tuition_fee, values.hostel_rent, values.mess_fee, values.other_fee].some(Number.isNaN))
    return { error: "Amounts must be numbers, like 4500." };
  return { values };
}

export function draftTotal(d: FeeDraft): number {
  const day = d.residence === "day_scholar";
  const parts = [d.tuition_fee, day ? "0" : d.hostel_rent, day ? "0" : d.mess_fee, d.other_fee].map(num);
  return parts.reduce((a, b) => a + (Number.isNaN(b) ? 0 : b), 0);
}

export const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;

// First day of a month as YYYY-MM-DD.
export function monthStart(offset = 0, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
