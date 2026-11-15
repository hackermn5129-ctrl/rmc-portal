"use client";
import { useRef, useState, type ChangeEvent } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { ErrorNote } from "@/components/ui";
import { rs } from "@/lib/fees";
import { readVoucher, shrinkPhoto, voucherAmount, voucherMonths, type VoucherRead } from "@/lib/voucher";

export type VoucherPhoto = { voucher: VoucherRead; preview: string };

// The big button that takes or picks a photo of the handwritten fee receipt and reads it.
export function VoucherButton({ onRead }: { onRead: (v: VoucherPhoto) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function picked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const photo = await shrinkPhoto(file);
      const result = await readVoucher(photo.base64);
      if ("error" in result) setError(result.error);
      else onRead({ voucher: result.voucher, preview: photo.preview });
    } catch {
      setError("That photo couldn't be opened. Try another one.");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={picked} />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="flex h-16 items-center justify-between rounded-full bg-navy pl-6 pr-2 text-left text-white transition-colors hover:bg-ink disabled:opacity-60"
      >
        <span className="flex flex-col">
          <span className="text-base font-medium">{busy ? "Reading the voucher" : "Photo of the voucher"}</span>
          {!busy && (
            <span lang="ur" dir="rtl" className="font-urdu text-xs leading-[1.9] text-mist">
              رسید کی تصویر
            </span>
          )}
        </span>
        <span className="flex size-12 items-center justify-center rounded-full bg-gold">
          <Camera aria-hidden className="size-5 text-ink" strokeWidth={1.75} />
        </span>
      </button>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

const UNSURE: Record<string, string> = {
  voucher_no: "voucher no",
  name_urdu: "name",
  name_english: "name",
  father_urdu: "father's name",
  father_english: "father's name",
  class_text: "class",
  class_number: "class",
  serial_no: "serial no",
  month_text: "month",
  months: "month",
  date: "date",
  annual_fund: "annual fund",
  hostel_fund: "hostel fund",
  fee: "fee",
  other_amount: "other amount",
  total: "total",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-sub">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

// Shows the photo next to what was read from it, so the two can be compared.
export function VoucherCard({ photo, onRetake }: { photo: VoucherPhoto; onRetake?: () => void }) {
  const v = photo.voucher;
  const [zoom, setZoom] = useState(false);
  const parts = [
    ["Fee", v.fee],
    ["Annual fund", v.annual_fund],
    ["Hostel fund", v.hostel_fund],
    ["Other", v.other_amount],
  ].filter(([, n]) => Number(n) > 0) as [string, number][];
  const unsure = [...new Set(v.unsure.map((f) => UNSURE[f] ?? f))];
  const date = v.date ? new Date(v.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <section className="rounded-[28px] border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-medium">From the voucher</h2>
        {onRetake && (
          <button type="button" onClick={onRetake} className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line-strong px-4 text-sm hover:bg-bg">
            <RotateCcw aria-hidden className="size-4" strokeWidth={1.75} />
            Another photo
          </button>
        )}
      </div>
      <button type="button" onClick={() => setZoom((z) => !z)} aria-label={zoom ? "Make the photo smaller" : "Make the photo bigger"} className="mt-4 block w-full overflow-hidden rounded-2xl border border-line bg-bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.preview} alt="The voucher photo" className={`w-full object-contain ${zoom ? "" : "max-h-48"}`} />
      </button>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {v.voucher_no && <Row label="Voucher no">{v.voucher_no}</Row>}
        {(v.name_english || v.name_urdu) && (
          <Row label="Name">
            {v.name_english}
            {v.name_urdu && (
              <span lang="ur" dir="rtl" className="ml-2 font-urdu text-[13px] leading-[1.9] text-sub">
                {v.name_urdu}
              </span>
            )}
          </Row>
        )}
        {(v.father_english || v.father_urdu) && <Row label="Father">{v.father_english || v.father_urdu}</Row>}
        {(v.class_number > 0 || v.class_text) && <Row label="Class">{v.class_number > 0 ? `${v.class_number}${v.class_text ? ` (${v.class_text})` : ""}` : v.class_text}</Row>}
        {v.serial_no && <Row label="Serial no">{v.serial_no}</Row>}
        {voucherMonths(v) && <Row label="Fee for">{voucherMonths(v)}</Row>}
        {date && <Row label="Date">{date}</Row>}
        {parts.length > 1 && parts.map(([label, n]) => <Row key={label} label={label}>{rs(n)}</Row>)}
        <Row label="Amount">
          <span className="text-base font-medium tabular-nums">{voucherAmount(v) > 0 ? rs(voucherAmount(v)) : "Not found"}</span>
        </Row>
      </dl>
      {unsure.length > 0 && <p className="mt-4 rounded-2xl bg-bg px-4 py-3 text-sm text-warn">Check these against the photo: {unsure.join(", ")}.</p>}
    </section>
  );
}
