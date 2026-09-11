import { useState } from "react";
import type { VendorExpense } from "@/lib/types";
import { PaymentBreakdown } from "@/components/PaymentBreakdown";
import { Pill, type PillTone } from "@/components/Pill";
import { ProgressBar } from "@/components/ProgressBar";
import { FormError } from "@/components/FormControls";
import { formatINR, formatShortDate } from "@/lib/format";
import { paymentModeBreakdown, paymentModeLabels } from "@/lib/payment";
import { useAsyncAction } from "@/lib/useAsyncAction";
import { usePujaData } from "@/lib/store";

function statusFor(paid: number, total: number): PillTone {
  if (paid <= 0) return "not_paid";
  if (paid >= total) return "paid_full";
  return "installment";
}

export function VendorCard({
  expense,
  onRecordPayment,
  onEdit,
  onDelete,
}: {
  expense: VendorExpense;
  onRecordPayment?: () => void;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
}) {
  const { memberName } = usePujaData();
  const [confirming, setConfirming] = useState(false);
  const { submitting, error, run } = useAsyncAction();
  const paid = expense.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = expense.totalAmount - paid;
  const percent = expense.totalAmount > 0 ? (paid / expense.totalAmount) * 100 : 0;
  const history = [...expense.payments].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[0.9rem] font-bold text-ink">{expense.vendor.name}</div>
          <div className="mt-0.5 text-[0.74rem] text-ink-faint">{expense.vendor.serviceType}</div>
        </div>
        <Pill tone={statusFor(paid, expense.totalAmount)} />
      </div>
      <div className="mt-3 flex justify-between text-[0.72rem] text-ink-faint">
        <span>
          Total
          <b className="mt-0.5 block text-[0.86rem] font-bold tabular-nums text-ink">
            {formatINR(expense.totalAmount)}
          </b>
        </span>
        <span>
          Paid
          <b className="mt-0.5 block text-[0.86rem] font-bold tabular-nums text-ink">
            {formatINR(paid)}
          </b>
        </span>
        <span>
          Balance
          <b className="mt-0.5 block text-[0.86rem] font-bold tabular-nums text-ink">
            {formatINR(balance)}
          </b>
        </span>
      </div>
      <ProgressBar percent={percent} />
      <PaymentBreakdown totals={paymentModeBreakdown(expense.payments)} />
      {history.length > 0 && (
        <div className="mt-2.5 space-y-1 border-t border-border pt-2.5">
          {history.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between text-[0.72rem] text-ink-faint"
            >
              <span>
                {formatShortDate(p.paymentDate)} · {paymentModeLabels[p.mode]} · paid by{" "}
                <span className="font-semibold text-ink-soft">{memberName(p.memberId)}</span>
                {p.selfFunded && " · self-funded"}
              </span>
              <span className="shrink-0 tabular-nums text-ink-soft">{formatINR(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
      {(onEdit || onRecordPayment) && (
        <div className="mt-3 flex gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 rounded-xl border border-border py-2 text-[0.78rem] font-semibold text-ink-soft active:scale-[0.99]"
            >
              Edit bill
            </button>
          )}
          {onRecordPayment && (
            <button
              type="button"
              onClick={onRecordPayment}
              className="flex-1 rounded-xl border border-border py-2 text-[0.78rem] font-semibold text-ink-soft active:scale-[0.99]"
            >
              Record payment
            </button>
          )}
        </div>
      )}
      {onDelete && !confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-2 w-full py-1 text-[0.72rem] font-semibold text-critical"
        >
          Delete bill
        </button>
      )}
      {onDelete && confirming && (
        <div className="mt-2.5 space-y-2 border-t border-border pt-2.5">
          <p className="text-[0.75rem] text-ink-faint">
            Delete this vendor bill and all its recorded payments? This can&rsquo;t be undone.
          </p>
          <FormError message={error} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={submitting}
              className="flex-1 rounded-xl border border-border py-2 text-[0.78rem] font-semibold text-ink-soft disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => run(onDelete)}
              disabled={submitting}
              className="flex-1 rounded-xl bg-critical py-2 text-[0.78rem] font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
