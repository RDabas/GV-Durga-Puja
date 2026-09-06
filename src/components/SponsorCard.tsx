import { useState } from "react";
import type { Sponsor } from "@/lib/types";
import { PaymentBreakdown } from "@/components/PaymentBreakdown";
import { Pill } from "@/components/Pill";
import { ProgressBar } from "@/components/ProgressBar";
import { FormError } from "@/components/FormControls";
import { formatINR, formatShortDate } from "@/lib/format";
import { paymentModeBreakdown, paymentModeLabels } from "@/lib/payment";
import { useAsyncAction } from "@/lib/useAsyncAction";
import { usePujaData } from "@/lib/store";

export function SponsorCard({
  sponsor,
  onRecordPayment,
  onEdit,
  onDelete,
}: {
  sponsor: Sponsor;
  onRecordPayment?: () => void;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
}) {
  const { memberName } = usePujaData();
  const [confirming, setConfirming] = useState(false);
  const { submitting, error, run } = useAsyncAction();
  const received = sponsor.payments.reduce((sum, p) => sum + p.amount, 0);
  const percent =
    sponsor.amountPledged > 0 ? (received / sponsor.amountPledged) * 100 : 0;
  const history = [...sponsor.payments].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[0.9rem] font-bold text-ink">{sponsor.name}</span>
        <Pill tone={sponsor.type}>
          {sponsor.type === "stall" && sponsor.stallDetails
            ? `Stall — ${sponsor.stallDetails}`
            : undefined}
        </Pill>
      </div>
      <div className="mt-2.5 flex items-baseline justify-between">
        <span className="font-display text-[1.05rem] font-bold tabular-nums text-ink">
          {formatINR(received)}
        </span>
        <span className="text-[0.72rem] tabular-nums text-ink-faint">
          of {formatINR(sponsor.amountPledged)} pledged
        </span>
      </div>
      <ProgressBar percent={percent} />
      <PaymentBreakdown totals={paymentModeBreakdown(sponsor.payments)} />
      {history.length > 0 && (
        <div className="mt-2.5 space-y-1 border-t border-border pt-2.5">
          {history.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between text-[0.72rem] text-ink-faint"
            >
              <span>
                {formatShortDate(p.paymentDate)} · {paymentModeLabels[p.mode]} · received by{" "}
                <span className="font-semibold text-ink-soft">{memberName(p.memberId)}</span>
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
              Edit sponsor
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
          Delete sponsor
        </button>
      )}
      {onDelete && confirming && (
        <div className="mt-2.5 space-y-2 border-t border-border pt-2.5">
          <p className="text-[0.75rem] text-ink-faint">
            Delete this sponsor and all its recorded payments? This can&rsquo;t be undone.
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
