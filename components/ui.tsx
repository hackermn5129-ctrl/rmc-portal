import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Crest() {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/rmc-crest.png" alt="RMC school crest" width={96} height={130} className="h-[130px] w-24 object-contain" />
      <div lang="ur" dir="rtl" className="text-center font-urdu text-lg leading-[2.2]">
        راشد منہاس ہائر سیکنڈری سکول چیچہ وطنی
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[28px] border border-line bg-white p-6 ${className}`}>{children}</div>;
}

export function Field({ label, id, ...props }: { label: string; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm text-sub">
        {label}
      </label>
      <input
        id={id}
        className="h-[52px] rounded-2xl border border-line-strong bg-bg px-4 text-base text-ink placeholder:text-sub/70"
        {...props}
      />
    </div>
  );
}

export function PrimaryButton({ children, busy, ...props }: { children: ReactNode; busy?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="flex h-14 items-center justify-between rounded-full bg-navy pl-6 pr-2 text-base font-medium text-white transition-colors hover:bg-ink disabled:opacity-60"
      disabled={busy || props.disabled}
      {...props}
    >
      <span>{busy ? "One moment" : children}</span>
      <span className="flex size-10 items-center justify-center rounded-full bg-gold">
        <ArrowRight aria-hidden className="size-[18px] text-ink" strokeWidth={1.75} />
      </span>
    </button>
  );
}

export function LinkButton({ href, children, icon = "arrow" }: { href: string; children: ReactNode; icon?: "arrow" | "plus" }) {
  const Icon = icon === "plus" ? Plus : ArrowRight;
  return (
    <Link href={href} className="flex h-14 items-center justify-between rounded-full bg-navy pl-6 pr-2 text-base font-medium text-white transition-colors hover:bg-ink">
      <span>{children}</span>
      <span className="flex size-10 items-center justify-center rounded-full bg-gold">
        <Icon aria-hidden className="size-[18px] text-ink" strokeWidth={1.75} />
      </span>
    </Link>
  );
}

export function SelectField({ label, id, children, ...props }: { label: string; id: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm text-sub">
        {label}
      </label>
      <select id={id} className="h-[52px] rounded-2xl border border-line-strong bg-bg px-4 text-base text-ink" {...props}>
        {children}
      </select>
    </div>
  );
}

export function OkNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-2xl bg-white px-4 py-3 text-sm text-ok">{children}</p>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad-ink">
      {children}
    </p>
  );
}
