import type { ReactNode } from "react";
import { DotIcon } from "@/components/icons";

const styles = {
  paid: "bg-success-tint text-success",
  partial: "bg-warning-tint text-warning",
  promised: "bg-gold-tint text-gold",
  pending: "bg-brand-tint text-brand",
  not_visited: "bg-ground-alt text-ink-faint",
  not_home: "bg-critical-tint text-critical",
  outside: "bg-brand-tint text-brand",
  stall: "bg-gold-tint text-gold",
  no_stall: "bg-ground-alt text-ink-faint",
  paid_full: "bg-success-tint text-success",
  installment: "bg-warning-tint text-warning",
  not_paid: "bg-ground-alt text-ink-faint",
} as const;

export type PillTone = keyof typeof styles;

const labels: Record<PillTone, string> = {
  paid: "Paid",
  partial: "Partial",
  promised: "Promised",
  pending: "Pending",
  not_visited: "Not visited",
  not_home: "Nobody home",
  outside: "Outside",
  stall: "Stall",
  no_stall: "No stall",
  paid_full: "Paid full",
  installment: "Installment",
  not_paid: "Not paid",
};

export function Pill({ tone, children }: { tone: PillTone; children?: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold whitespace-nowrap ${styles[tone]}`}
    >
      <DotIcon className="h-[7px] w-[7px]" />
      {children ?? labels[tone]}
    </span>
  );
}
