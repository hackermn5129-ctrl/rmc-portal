"use client";
import { RESIDENCES, draftTotal, rs, type FeeDraft, type FeeRates, type HostelRate, type Residence } from "@/lib/fees";
import { Field } from "./ui";

// Picks day scholar or a hostel type and the monthly charges.
// Choosing a hostel type fills its rent and mess fee from the saved rates
// (plus the Class 9 and 10 extra, when the student is in those classes).
// For day scholars, lunch and transport are added with one tap from the saved rates.
export function FeeForm({ draft, onChange, rates, extras, hostelExtra = 0 }: { draft: FeeDraft; onChange: (d: FeeDraft) => void; rates: HostelRate[]; extras?: FeeRates; hostelExtra?: number }) {
  const set = (patch: Partial<FeeDraft>) => onChange({ ...draft, ...patch });

  function pick(r: Residence) {
    if (r === "day_scholar") return set({ residence: r, hostel_rent: "0", mess_fee: "0" });
    const rate = rates.find((x) => x.residence === r);
    // Lunch and transport are for day scholars only.
    const clear = lunchOn || transport ? { other_fee: "0", other_note: "" } : {};
    set({ residence: r, hostel_rent: String(Number(rate?.monthly_rent ?? 0) + hostelExtra), mess_fee: String(rate?.mess_fee ?? 0), ...clear });
  }

  const hostel = draft.residence !== "day_scholar";
  const other = Number(draft.other_fee.replace(/,/g, "") || 0);
  const lunchOn = /lunch/i.test(draft.other_note);
  const transport: "near" | "far" | null = !/transport/i.test(draft.other_note) || !extras ? null : other - (lunchOn ? extras.lunch : 0) === extras.transport_far ? "far" : "near";

  function setExtras(lunch: boolean, tr: "near" | "far" | null) {
    if (!extras) return;
    const total = (lunch ? extras.lunch : 0) + (tr === "near" ? extras.transport_near : tr === "far" ? extras.transport_far : 0);
    set({ other_fee: String(total), other_note: [lunch && "Lunch", tr && "Transport"].filter(Boolean).join(" + ") });
  }

  const chip = (on: boolean) =>
    `rounded-full border px-4 py-2 text-sm transition-colors ${on ? "border-navy bg-navy text-white" : "border-line-strong bg-bg text-ink hover:bg-white"}`;

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-sub">Stays as</legend>
        <div className="grid grid-cols-2 gap-2">
          {RESIDENCES.map((r) => {
            const on = draft.residence === r.value;
            return (
              <button
                key={r.value}
                type="button"
                aria-pressed={on}
                onClick={() => pick(r.value)}
                className={`flex flex-col items-start rounded-2xl border px-4 py-3 text-left transition-colors ${
                  on ? "border-navy bg-navy text-white" : "border-line-strong bg-bg text-ink hover:bg-white"
                }`}
              >
                <span className="text-[15px] font-medium">{r.label}</span>
                <span lang="ur" dir="rtl" className={`font-urdu text-xs leading-[2] ${on ? "text-mist" : "text-sub"}`}>
                  {r.urdu}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Academic fee (monthly)" id="tuition" inputMode="numeric" placeholder="5000" value={draft.tuition_fee} onChange={(e) => set({ tuition_fee: e.target.value })} />
      {hostel && <Field label="Hostel fee (mess included)" id="rent" inputMode="numeric" value={draft.hostel_rent} onChange={(e) => set({ hostel_rent: e.target.value })} />}
      {hostel && Number(draft.mess_fee) > 0 && <Field label="Mess fee" id="mess" inputMode="numeric" value={draft.mess_fee} onChange={(e) => set({ mess_fee: e.target.value })} />}
      {!hostel && extras && (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-sub">Also takes</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={lunchOn} onClick={() => setExtras(!lunchOn, transport)} className={chip(lunchOn)}>
              Lunch from mess · {rs(extras.lunch)}
            </button>
            <button type="button" aria-pressed={transport === "near"} onClick={() => setExtras(lunchOn, transport === "near" ? null : "near")} className={chip(transport === "near")}>
              Transport · {rs(extras.transport_near)}
            </button>
            <button type="button" aria-pressed={transport === "far"} onClick={() => setExtras(lunchOn, transport === "far" ? null : "far")} className={chip(transport === "far")}>
              Transport, far · {rs(extras.transport_far)}
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <Field label="Other" id="other" inputMode="numeric" value={draft.other_fee} onChange={(e) => set({ other_fee: e.target.value })} />
        <Field label="What for (optional)" id="other_note" placeholder="Transport" value={draft.other_note} onChange={(e) => set({ other_note: e.target.value })} />
      </div>

      <div className="flex items-baseline justify-between rounded-2xl bg-bg px-4 py-3">
        <span className="text-sm text-sub">Monthly total</span>
        <span className="text-xl font-medium tabular-nums">{rs(draftTotal(draft))}</span>
      </div>
    </div>
  );
}
