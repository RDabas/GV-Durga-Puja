import type { PaymentMode } from "@/lib/types";

export const paymentModeLabels: Record<PaymentMode, string> = {
  cash: "Cash",
  gpay: "GPay",
  phonepe: "PhonePe",
  other_upi: "Other UPI",
  pending: "",
};

/** Order breakdown chips render in, so a member's tags don't reshuffle row to row. */
const modeOrder: PaymentMode[] = ["cash", "gpay", "phonepe", "other_upi"];

export type PaymentBreakdownTotals = Partial<Record<PaymentMode, number>>;

export function paymentModeBreakdown(
  entries: { amount: number; mode: PaymentMode }[],
): PaymentBreakdownTotals {
  const totals: PaymentBreakdownTotals = {};
  for (const { amount, mode } of entries) {
    if (mode === "pending" || amount <= 0) continue;
    totals[mode] = (totals[mode] ?? 0) + amount;
  }
  return totals;
}

export function sortedBreakdown(
  totals: PaymentBreakdownTotals,
): [PaymentMode, number][] {
  return modeOrder
    .filter((mode) => (totals[mode] ?? 0) > 0)
    .map((mode) => [mode, totals[mode]!]);
}
