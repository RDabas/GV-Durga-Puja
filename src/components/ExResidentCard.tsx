import { cardAccent, DisableToggleButton, PayerRow } from "@/components/FlatCard";
import type { Contribution, ExResident } from "@/lib/types";
import type { PreviousYearInfo } from "@/lib/store";

/**
 * One card per ex-resident — not tied to any flat/block, so no floor/block
 * header bar like FlatCard has. Reuses PayerRow for identical rendering
 * (status pill, amount, collector/date, follow-up note, previous-year line)
 * and DisableToggleButton for the same disable/enable behavior as an owner.
 */
export function ExResidentCard({
  exResident,
  contribution,
  collectorName,
  assignedToName,
  previousYear,
  onEdit,
  onToggleDisabled,
}: {
  exResident: ExResident;
  contribution?: Contribution;
  collectorName?: string;
  assignedToName?: string;
  previousYear?: PreviousYearInfo[];
  onEdit: () => void;
  onToggleDisabled: () => Promise<void>;
}) {
  const status = contribution?.status ?? "not_visited";
  const accent = cardAccent[exResident.disabled ? "not_visited" : status];

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-r-[3px] bg-surface shadow-[var(--shadow-card)] ${accent.border}`}
    >
      <PayerRow
        role="Ex Resident"
        names={exResident.names.join(", ")}
        contribution={contribution}
        collectorName={collectorName}
        assignedToName={assignedToName}
        previousYear={previousYear}
        disabled={exResident.disabled}
        headerAction={
          <DisableToggleButton
            name={exResident.names.join(", ")}
            disabled={exResident.disabled}
            onToggle={onToggleDisabled}
          />
        }
        onClick={onEdit}
      />
    </div>
  );
}
