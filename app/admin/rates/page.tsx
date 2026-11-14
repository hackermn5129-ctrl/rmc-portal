"use client";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Portal } from "@/components/portal";
import { ErrorNote, Field, PrimaryButton } from "@/components/ui";
import { RESIDENCES, type HostelRate, type Residence } from "@/lib/fees";

type Draft = Record<Residence, { rent: string; mess: string }>;
const HOSTELS = RESIDENCES.filter((r) => r.value !== "day_scholar");

function Rates() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("hostel_rates")
      .select("residence, monthly_rent, mess_fee")
      .then(({ data }) => {
        const d = {} as Draft;
        for (const r of RESIDENCES) {
          const row = (data as HostelRate[] | null)?.find((x) => x.residence === r.value);
          d[r.value] = { rent: String(row?.monthly_rent ?? 0), mess: String(row?.mess_fee ?? 0) };
        }
        setDraft(d);
      });
  }, []);

  if (!draft) return <p className="mt-6 text-sm text-sub">Loading rates</p>;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError("");
    setSaved(false);
    const rows = HOSTELS.map((h) => ({
      residence: h.value,
      monthly_rent: Number(draft[h.value].rent.replace(/,/g, "") || 0),
      mess_fee: Number(draft[h.value].mess.replace(/,/g, "") || 0),
      updated_at: new Date().toISOString(),
    }));
    if (rows.some((r) => !Number.isFinite(r.monthly_rent) || !Number.isFinite(r.mess_fee) || r.monthly_rent < 0 || r.mess_fee < 0))
      return setError("Amounts must be numbers, like 6000.");
    setBusy(true);
    const { error } = await supabase.from("hostel_rates").upsert(rows);
    setBusy(false);
    if (error) return setError("The rates weren't saved. Try again.");
    setSaved(true);
  }

  return (
    <form onSubmit={save} noValidate className="mt-5 flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-sub">
        Set these once. They fill in by themselves when you add a hostel student. Changing them here does not change fees already set for a student.
      </p>
      {HOSTELS.map((h) => (
        <div key={h.value} className="flex flex-col gap-3 rounded-[28px] border border-line bg-white p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-medium">{h.label}</h2>
            <span lang="ur" dir="rtl" className="font-urdu text-sm leading-[2] text-sub">
              {h.urdu}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Rent per month"
              id={`${h.value}_rent`}
              inputMode="numeric"
              value={draft[h.value].rent}
              onChange={(e) => setDraft({ ...draft, [h.value]: { ...draft[h.value], rent: e.target.value } })}
            />
            <Field
              label="Mess per month"
              id={`${h.value}_mess`}
              inputMode="numeric"
              value={draft[h.value].mess}
              onChange={(e) => setDraft({ ...draft, [h.value]: { ...draft[h.value], mess: e.target.value } })}
            />
          </div>
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
    <Portal role="admin" title="Hostel rates" back="/admin">
      {() => <Rates />}
    </Portal>
  );
}
