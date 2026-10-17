import { useState } from "react";
import {
  cardAccent,
  DisableToggleButton,
  extraPaymentsFor,
  PayerRow,
  paymentActionChipFor,
} from "@/components/FlatCard";
import { FormError } from "@/components/FormControls";
import { Pill, pillLabels } from "@/components/Pill";
import { usePujaData } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";
import type { Contribution, OutsideCollection } from "@/lib/types";

/** "4 people · Both nights (18 & 19 Oct)" — built from the contribution's pass fields, not stored as its own string. */
function passHint(contribution: Contribution | undefined): string | undefined {
  if (!contribution?.passPeopleCount) return undefined;
  const nights =
    contribution.passDay18 && contribution.passDay19
      ? "Both nights (18 & 19 Oct)"
      : contribution.passDay18
        ? "18 Oct only"
        : contribution.passDay19
          ? "19 Oct only"
          : "";
  const people = contribution.passPeopleCount;
  return `${people} ${people === 1 ? "person" : "people"} · ${nights}`;
}

/**
 * One card per outside-collection entry — not tied to any flat/block, so no
 * floor/block header bar like FlatCard has. Reuses PayerRow for identical
 * rendering (status pill, amount, collector/date, follow-up note) and
 * DisableToggleButton for the same disable/enable behavior as an owner or
 * ex-resident, plus a type Pill shown next to the status pill.
 */
export function OutsideCollectionCard({
  outsideCollection,
  contribution,
  collectorName,
  assignedToName,
  onEdit,
  onToggleDisabled,
  onDelete,
}: {
  outsideCollection: OutsideCollection;
  contribution?: Contribution;
  collectorName?: string;
  assignedToName?: string;
  onEdit: () => void;
  onToggleDisabled: () => Promise<void>;
  /** Only ever offered once the entry is already disabled — a permanent delete, not a toggle. */
  onDelete?: () => Promise<void>;
}) {
  const { contributionPayments, memberName } = usePujaData();
  const status = contribution?.status ?? "not_visited";
  const accent = cardAccent[outsideCollection.disabled ? "not_visited" : status];
  const [confirming, setConfirming] = useState(false);
  const { submitting, error, run } = useAsyncAction();

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-r-[3px] bg-surface shadow-[var(--shadow-card)] ${accent.border}`}
    >
      <PayerRow
        role="Outside Collection"
        names={outsideCollection.name}
        hint={
          outsideCollection.type === "stall" && outsideCollection.stallDetails
            ? `Stall — ${outsideCollection.stallDetails}`
            : outsideCollection.type === "dandiya_pass"
              ? passHint(contribution)
              : undefined
        }
        contribution={contribution}
        collectorName={collectorName}
        assignedToName={assignedToName}
        disabled={outsideCollection.disabled}
        extraBadge={!outsideCollection.disabled ? <Pill tone={outsideCollection.type} /> : undefined}
        headerAction={
          <DisableToggleButton
            name={outsideCollection.name}
            disabled={outsideCollection.disabled}
            onToggle={onToggleDisabled}
          />
        }
        receiptAction={paymentActionChipFor(
          contribution,
          outsideCollection.name,
          pillLabels[outsideCollection.type],
          `OC-${outsideCollection.id.slice(0, 6)}`,
          collectorName,
          outsideCollection.type === "dandiya_pass"
            ? `Dandiya Night Pass — ${passHint(contribution)}`
            : undefined,
          outsideCollection.type === "dandiya_pass" ? "Dandiya Night Pass" : undefined,
          extraPaymentsFor(contribution, contributionPayments, memberName),
        )}
        onClick={onEdit}
      />
      {onDelete && outsideCollection.disabled && !confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full border-t border-border py-1.5 text-[0.72rem] font-semibold text-critical"
        >
          Delete
        </button>
      )}
      {onDelete && outsideCollection.disabled && confirming && (
        <div className="space-y-2 border-t border-border p-3">
          <p className="text-[0.75rem] text-ink-faint">
            Permanently delete {outsideCollection.name}? This can&rsquo;t be undone.
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
