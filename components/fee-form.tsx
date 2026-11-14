"use client";
import { RESIDENCES, draftTotal, rs, type FeeDraft, type HostelRate, type Residence } from "@/lib/fees";
import { Field } from "./ui";

// Picks day scholar or a hostel type and the monthly charges.
// Choosing a hostel type fills its rent and mess fee from the saved rates.
export function FeeForm({ draft, onChange, rates }: { draft: FeeDraft; onChange: (d: FeeDraft) => void; rates: HostelRate[] }) {
  const set = (patch: Partial<FeeDraft>) => onChange({ ...draft, ...patch });

  function pick(r: Residence) {
    if (r === "day_scholar") return set({ residence: r, hostel_rent: "0", mess_fee: "0" });
    const rate = rates.find((x) => x.residence === r);
    set({ residence: r, hostel_rent: String(rate?.monthly_rent ?? 0), mess_fee: String(rate?.mess_fee ?? 0) });
  }

  const hostel = draft.residence !== "day_scholar";

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

      <Field label="Tuition fee (monthly)" id="tuition" inputMode="numeric" placeholder="4500" value={draft.tuition_fee} onChange={(e) => set({ tuition_fee: e.target.value })} />
      {hostel && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hostel rent" id="rent" inputMode="numeric" value={draft.hostel_rent} onChange={(e) => set({ hostel_rent: e.target.value })} />
          <Field label="Mess fee" id="mess" inputMode="numeric" value={draft.mess_fee} onChange={(e) => set({ mess_fee: e.target.value })} />
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
