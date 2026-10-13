"use client";

import { ReceiptIcon } from "@/components/icons";
import { generateReceiptPdf, type ReceiptPayer, type ReceiptPaymentDetails } from "@/lib/receiptPdf";
import { usePujaData } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";

/**
 * Small pill button that builds and shares a PDF receipt for one
 * contribution — sits directly on the payer's card (alongside the
 * Disable/Enable toggle) rather than inside its edit sheet, so issuing a
 * receipt never requires opening the card first.
 */
export function IssueReceiptChip({
  payer,
  payment,
}: {
  payer: ReceiptPayer;
  payment: ReceiptPaymentDetails;
}) {
  const { activeYear } = usePujaData();
  const { submitting, error, run } = useAsyncAction();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        run(() => generateReceiptPdf(payer, payment, activeYear));
      }}
      disabled={submitting}
      title={error ?? undefined}
      className="flex shrink-0 items-center gap-1 rounded-full bg-ground-alt px-2.5 py-1 text-[0.66rem] font-bold whitespace-nowrap text-ink-soft transition active:scale-95 disabled:opacity-60"
    >
      <ReceiptIcon className="h-3 w-3" />
      {submitting ? "…" : error ? "Retry" : "Receipt"}
    </button>
  );
}
