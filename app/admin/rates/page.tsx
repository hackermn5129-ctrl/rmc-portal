"use client";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { ErrorNote, Field, PrimaryButton } from "@/components/ui";
import { RESIDENCES, type FeeRates, type HostelRate, type Residence } from "@/lib/fees";
import { loadFeeRates } from "@/lib/fee-data";

type Draft = { hostel: Record<Residence, string>; mess: Record<Residence, number>; rates: Record<keyof FeeRates, string> };
const HOSTELS = RESIDENCES.filter((r) => r.value !== "day_scholar");

const GROUPS: { title: string; urdu: string; note?: string; fields: { key: keyof FeeRates; label: string }[] }[] = [
  {
    title: "Academic fee",
    urdu: "ماہانہ فیس",
    note: "Per month. Fills in by itself from the student's class.",
    fields: [
      { key: "tuition_upto_8", label: "Up to Class 8" },
      { key: "tuition_9_10", label: "Class 9 and 10" },
    ],
  },
  {
    title: "Day scholars",
    urdu: "ڈے سکالر",
    note: "Per month, only for those who take them.",
    fields: [
      { key: "lunch", label: "Lunch from mess" },
      { key: "transport_near", label: "Transport" },
      { key: "transport_far", label: "Transport, far" },
    ],
  },
  { title: "Annual charges", urdu: "سالانہ فنڈ", note: "Once a year.", fields: [{ key: "annual", label: "Per year" }] },
];

const num = (s: string) => Number(s.replace(/,/g, "").trim() || 0);

function Rates() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([supabase.from("hostel_rates").select("residence, monthly_rent, mess_fee"), loadFeeRates()]).then(([h, fr]) => {
      const hostel = {} as Draft["hostel"];
      const mess = {} as Draft["mess"];
      for (const r of RESIDENCES) {
        const row = (h.data as HostelRate[] | null)?.find((x) => x.residence === r.value);
        hostel[r.value] = String(row?.monthly_rent ?? 0);
        mess[r.value] = Number(row?.mess_fee ?? 0);
      }
      const rates = {} as Draft["rates"];
      for (const k of Object.keys(fr) as (keyof FeeRates)[]) rates[k] = String(fr[k]);
      setDraft({ hostel, mess, rates });
    });
  }, []);

  if (!draft) return <p className="mt-6 text-sm text-sub">Loading rates</p>;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError("");
    setSaved(false);
    const now = new Date().toISOString();
    const hostelRows = HOSTELS.map((h) => ({ residence: h.value, monthly_rent: num(draft.hostel[h.value]), mess_fee: draft.mess[h.value], updated_at: now }));
    const rateRows = (Object.keys(draft.rates) as (keyof FeeRates)[]).map((key) => ({ key, amount: num(draft.rates[key]), updated_at: now }));
    if ([...hostelRows.map((r) => r.monthly_rent), ...rateRows.map((r) => r.amount)].some((n) => !Number.isFinite(n) || n < 0))
      return setError("Amounts must be numbers, like 5000.");
    setBusy(true);
    const [a, b] = await Promise.all([supabase.from("hostel_rates").upsert(hostelRows), supabase.from("fee_rates").upsert(rateRows)]);
    setBusy(false);
    if (a.error || b.error) return setError("The rates weren't saved. Try again.");
    setSaved(true);
  }

  const card = "flex flex-col gap-3 rounded-[28px] border border-line bg-white p-5";
  const head = (title: string, urdu: string, note?: string) => (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-medium">{title}</h2>
        <span lang="ur" dir="rtl" className="font-urdu text-sm leading-[2] text-sub">
          {urdu}
        </span>
      </div>
      {note && <p className="text-sm text-sub">{note}</p>}
    </div>
  );

  return (
    <form onSubmit={save} noValidate className="mt-5 flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-sub">Set these once. They fill in by themselves when you set a student&apos;s fee. Changing them here does not change fees already set for a student.</p>

      <div className={card}>
        {head(GROUPS[0].title, GROUPS[0].urdu, GROUPS[0].note)}
        <div className="grid grid-cols-2 gap-3">
          {GROUPS[0].fields.map((f) => (
            <Field key={f.key} label={f.label} id={f.key} inputMode="numeric" value={draft.rates[f.key]} onChange={(e) => setDraft({ ...draft, rates: { ...draft.rates, [f.key]: e.target.value } })} />
          ))}
        </div>
      </div>

      <div className={card}>
        {head("Hostel", "ہاسٹل", "Per month, mess included. Added on top of the academic fee.")}
        {HOSTELS.map((h) => (
          <Field key={h.value} label={h.label} id={h.value} inputMode="numeric" value={draft.hostel[h.value]} onChange={(e) => setDraft({ ...draft, hostel: { ...draft.hostel, [h.value]: e.target.value } })} />
        ))}
      </div>

      {GROUPS.slice(1).map((g) => (
        <div key={g.title} className={card}>
          {head(g.title, g.urdu, g.note)}
          {g.fields.map((f) => (
            <Field key={f.key} label={f.label} id={f.key} inputMode="numeric" value={draft.rates[f.key]} onChange={(e) => setDraft({ ...draft, rates: { ...draft.rates, [f.key]: e.target.value } })} />
          ))}
        </div>
      ))}

      <ErrorNote>{error}</ErrorNote>
      {saved && <p className="rounded-2xl bg-white px-4 py-3 text-sm text-ok">Rates saved.</p>}
      <PrimaryButton type="submit" busy={busy}>
        Save rates
      </PrimaryButton>
    </form>
  );
}

export default function RatesPage() {
  return (
    <Portal role="admin" title="Fee rates" back="/admin/settings">
      {() => <Rates />}
    </Portal>
  );
}
