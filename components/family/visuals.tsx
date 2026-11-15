import { ArrowDown, ArrowUp, Check, Minus, X } from "lucide-react";
import type { DayStatus } from "@/lib/family";

const OK = "#2E7D5B";
const WARN = "#B7791F";
const BAD = "#B4443C";

export const toneColor = (p: number | null | undefined, good = 70, fair = 50) => (p === null || p === undefined ? "#8792A0" : p >= good ? OK : p >= fair ? WARN : BAD);

export function Ring({
  percent,
  size = 52,
  stroke = 6,
  color = "#1F3A5F",
  track = "#E6EBF0",
  label,
  showText = false,
}: {
  percent: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  label: string;
  showText?: boolean;
}) {
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 tabular-nums">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      {percent !== null && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(p / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      {showText && (
        <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="500" fill="#13233A">
          {percent === null ? "–" : `${Math.round(percent)}%`}
        </text>
      )}
    </svg>
  );
}

// Area line chart, as on the design canvas: dashed guides, last point highlighted.
export function LineChart({ points, label, color = OK }: { points: { label: string; value: number }[]; label: string; color?: string }) {
  if (points.length === 0) return null;
  const W = 318,
    H = 170,
    left = 8,
    right = 284,
    top = 30,
    bottom = 128;
  const vals = points.map((p) => p.value);
  let lo = Math.floor(Math.min(...vals) / 5) * 5 - 5;
  let hi = Math.ceil(Math.max(...vals) / 5) * 5 + 5;
  lo = Math.max(0, lo);
  hi = Math.min(100, Math.max(hi, lo + 10));
  const x = (i: number) => (points.length === 1 ? (left + right) / 2 : left + (i * (right - left)) / (points.length - 1));
  const y = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
  const guides = [lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.55, lo + (hi - lo) * 0.9].map(Math.round);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const last = points.length - 1;
  const gid = `g-${label.replace(/\W/g, "").slice(0, 12)}`;
  // Show at most 6 x labels.
  const step = Math.ceil(points.length / 6);
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full tabular-nums">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {guides.map((g) => (
        <g key={g}>
          <line x1={left} y1={y(g)} x2={right} y2={y(g)} stroke="rgba(19,35,58,0.10)" strokeDasharray="3 4" />
          <text x={W} y={y(g) + 4} textAnchor="end" fontSize="11" fill="#5F6B7A">
            {g}%
          </text>
        </g>
      ))}
      {points.length > 1 && <path d={`M${x(0)},142 L${line.replaceAll(" ", " L")} L${x(last)},142 Z`} fill={`url(#${gid})`} />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1={x(last)} y1={y(points[last].value)} x2={x(last)} y2="142" stroke={color} strokeDasharray="2 3" />
      <circle cx={x(last)} cy={y(points[last].value)} r="9" fill={color} fillOpacity="0.18" />
      <circle cx={x(last)} cy={y(points[last].value)} r="4.5" fill={color} stroke="#FFFFFF" strokeWidth="2" />
      {points.map((p, i) =>
        i % step === 0 || i === last ? (
          <text key={i} x={x(i)} y="162" textAnchor={i === 0 && points.length > 1 ? "start" : i === last && points.length > 1 ? "end" : "middle"} fontSize="11" fill="#5F6B7A">
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <span className="w-14" />;
  const lo = Math.min(...values),
    hi = Math.max(...values);
  const pts = values.map((v, i) => `${(2 + (i * 52) / (values.length - 1)).toFixed(1)},${(hi === lo ? 12 : 20 - ((v - lo) / (hi - lo)) * 16).toFixed(1)}`).join(" ");
  return (
    <svg aria-hidden width="56" height="24" viewBox="0 0 56 24" className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Change({ value, suffix }: { value: number | null; suffix: string }) {
  if (value === null || Math.round(value) === 0) return null;
  const up = value > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[13px] font-medium tabular-nums ${up ? "text-ok" : "text-bad"}`}>
      <Icon aria-hidden className="size-4" strokeWidth={2.25} />
      {Math.abs(Math.round(value))}% {suffix}
    </span>
  );
}

const DAY_STYLE: Record<DayStatus | "none", { bg: string; Icon: typeof Check | null; label: string }> = {
  present: { bg: "bg-ok", Icon: Check, label: "present" },
  partial: { bg: "bg-warn", Icon: Minus, label: "partly present" },
  absent: { bg: "bg-bad", Icon: X, label: "absent" },
  leave: { bg: "bg-mist", Icon: Minus, label: "on leave" },
  none: { bg: "border border-dashed border-line-strong", Icon: null, label: "not marked" },
};

export function DayDot({ status, label, size = 40 }: { status: DayStatus | null; label: string; size?: number }) {
  const s = DAY_STYLE[status ?? "none"];
  return (
    <div role="img" aria-label={`${label}: ${s.label}`} className={`flex items-center justify-center rounded-full ${s.bg}`} style={{ width: size, height: size }}>
      {s.Icon && <s.Icon aria-hidden className="text-white" style={{ width: size / 2, height: size / 2 }} strokeWidth={2.5} />}
    </div>
  );
}

export function DayLegend() {
  return (
    <div className="mt-4 flex flex-wrap gap-4">
      {(
        [
          ["bg-ok", "Full day"],
          ["bg-warn", "Partly present"],
          ["bg-bad", "Absent"],
        ] as const
      ).map(([bg, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5 text-[13px] text-sub">
          <span aria-hidden className={`size-3 rounded-full ${bg}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

export function Urdu({ children, className = "" }: { children: string; className?: string }) {
  return (
    <span lang="ur" dir="rtl" className={`font-urdu text-left text-[13px] leading-[1.8] ${className}`}>
      {children}
    </span>
  );
}
