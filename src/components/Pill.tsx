import type { ReactNode } from "react";
import { CheckIcon, DotIcon } from "@/components/icons";

const styles = {
  // Solid + inverted (not just tint) so a fully paid flat reads as "done" at
  // a glance instead of blending in with the other soft-tinted statuses.
  paid: "bg-success text-surface shadow-[0_1px_3px_rgba(28,143,107,0.35)]",
  partial: "bg-warning-tint text-warning",
  promised: "bg-gold-tint text-gold",
  pending: "bg-brand-tint text-brand",
  not_visited: "bg-ground-alt text-ink-faint",
  not_home: "bg-critical-tint text-critical",
  outside: "bg-brand-tint text-brand",
  stall: "bg-gold-tint text-gold",
  no_stall: "bg-ground-alt text-ink-faint",
  paid_full: "bg-success text-surface shadow-[0_1px_3px_rgba(28,143,107,0.35)]",
  installment: "bg-warning-tint text-warning",
  not_paid: "bg-ground-alt text-ink-faint",
  disabled: "bg-ground-alt text-ink-faint",
} as const;

const checkTones = new Set(["paid", "paid_full"]);

export type PillTone = keyof typeof styles;

export const pillLabels: Record<PillTone, string> = {
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
  disabled: "Disabled",
};

export function Pill({ tone, children }: { tone: PillTone; children?: ReactNode }) {
  const Icon = checkTones.has(tone) ? CheckIcon : DotIcon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold whitespace-nowrap ${styles[tone]}`}
    >
      <Icon className={checkTones.has(tone) ? "h-[9px] w-[9px]" : "h-[7px] w-[7px]"} />
      {children ?? pillLabels[tone]}
    </span>
  );
}
