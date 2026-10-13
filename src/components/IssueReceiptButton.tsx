"use client";

import { ReceiptIcon } from "@/components/icons";
import { generateReceiptPdf, type ReceiptPayer, type ReceiptPaymentDetails } from "@/lib/receiptPdf";
import { usePujaData } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";

/** Compact button that builds and shares a PDF receipt for one contribution — shown on a Sheet only once a payment actually exists to receipt. */
export function IssueReceiptButton({
  payer,
  payment,
}: {
  payer: ReceiptPayer;
  payment: ReceiptPaymentDetails;
}) {
  const { activeYear } = usePujaData();
  const { submitting, error, run } = useAsyncAction();

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => run(() => generateReceiptPdf(payer, payment, activeYear))}
        disabled={submitting}
        className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-[0.75rem] font-semibold text-brand active:scale-[0.98] disabled:opacity-60"
      >
        <ReceiptIcon className="h-[13px] w-[13px]" />
        {submitting ? "Preparing receipt…" : "Issue receipt (PDF)"}
      </button>
      {error && <p className="mt-1.5 text-[0.75rem] text-critical">{error}</p>}
    </div>
  );
}
