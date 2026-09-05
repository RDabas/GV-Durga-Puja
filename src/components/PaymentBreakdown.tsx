import { formatINR } from "@/lib/format";
import {
  paymentModeLabels,
  sortedBreakdown,
  type PaymentBreakdownTotals,
} from "@/lib/payment";
import type { PaymentMode } from "@/lib/types";

const chipStyles: Record<PaymentMode, string> = {
  cash: "bg-ground-alt text-ink-soft",
  gpay: "bg-success-tint text-success",
  phonepe: "bg-brand-tint text-brand",
  other_upi: "bg-gold-tint text-gold",
  pending: "bg-ground-alt text-ink-faint",
};

export function PaymentTag({ mode, amount }: { mode: PaymentMode; amount?: number }) {
  if (mode === "pending") return null;

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[0.66rem] font-semibold tabular-nums whitespace-nowrap ${chipStyles[mode]}`}
    >
      {paymentModeLabels[mode]}
      {amount !== undefined && ` ${formatINR(amount)}`}
    </span>
  );
}

export function PaymentBreakdown({ totals }: { totals: PaymentBreakdownTotals }) {
  const entries = sortedBreakdown(totals);
  if (entries.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {entries.map(([mode, amount]) => (
        <PaymentTag key={mode} mode={mode} amount={amount} />
      ))}
    </div>
  );
}
