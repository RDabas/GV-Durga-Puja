import { cardAccent, DisableToggleButton, PayerRow } from "@/components/FlatCard";
import { IssueReceiptChip } from "@/components/IssueReceiptButton";
import { Pill, pillLabels } from "@/components/Pill";
import { today } from "@/lib/format";
import type { Contribution, OutsideCollection } from "@/lib/types";

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
}: {
  outsideCollection: OutsideCollection;
  contribution?: Contribution;
  collectorName?: string;
  assignedToName?: string;
  onEdit: () => void;
  onToggleDisabled: () => Promise<void>;
}) {
  const status = contribution?.status ?? "not_visited";
  const accent = cardAccent[outsideCollection.disabled ? "not_visited" : status];

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
        receiptAction={
          contribution && (contribution.moneyAmount > 0 || contribution.bhogGroceryAmount > 0) ? (
            <IssueReceiptChip
              payer={{
                name: outsideCollection.name,
                context: pillLabels[outsideCollection.type],
                refCode: `OC-${outsideCollection.id.slice(0, 6)}`,
              }}
              payment={{
                moneyAmount: contribution.moneyAmount,
                bhogGroceryAmount: contribution.bhogGroceryAmount,
                paymentMode: contribution.paymentMode,
                paymentDate: contribution.paymentDate ?? today(),
                collectorName,
              }}
            />
          ) : undefined
        }
        onClick={onEdit}
      />
    </div>
  );
}
