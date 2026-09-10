import { useState } from "react";
import type { Contribution, ContributionStatus, House, Owner } from "@/lib/types";
import { Pill } from "@/components/Pill";
import { PaymentTag } from "@/components/PaymentBreakdown";
import { FormError } from "@/components/FormControls";
import { formatINR, formatShortDate } from "@/lib/format";
import type { PreviousYearInfo } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";

function summarise(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length <= 2) return names.join(", ");
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

const referenceDotTone: Record<ContributionStatus, string> = {
  paid: "bg-success",
  partial: "bg-warning",
  promised: "bg-gold",
  pending: "bg-brand",
  not_home: "bg-critical",
  not_visited: "bg-ink-faint/40",
};

/** Shown on a multi-flat owner's non-primary flats instead of the full PayerRow — their money and status already live on the primary flat, so this is just a pointer there. */
function OwnerReferenceRow({
  names,
  primaryFlatLabel,
  status,
  onClick,
}: {
  names: string;
  primaryFlatLabel: string;
  status: ContributionStatus;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition active:scale-[0.99]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[0.62rem] font-semibold uppercase tracking-wide text-ink-faint">
          Owner
        </span>
        <span className="mt-0.5 block truncate text-[0.82rem] font-semibold text-ink">
          {names || "—"}
        </span>
        <span className="mt-0.5 block truncate text-[0.68rem] text-ink-faint">
          Paid via {primaryFlatLabel}
        </span>
      </span>
      <span className={`h-2 w-2 shrink-0 rounded-full ${referenceDotTone[status]}`} />
    </button>
  );
}

function PayerRow({
  role,
  names,
  hint,
  contribution,
  collectorName,
  assignedToName,
  previousYear,
  onClick,
}: {
  role: string;
  names: string;
  hint?: string;
  contribution?: Contribution;
  collectorName?: string;
  assignedToName?: string;
  previousYear?: PreviousYearInfo;
  onClick: () => void;
}) {
  const status = contribution?.status ?? "not_visited";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 p-3 text-left transition active:scale-[0.99]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[0.62rem] font-semibold uppercase tracking-wide text-ink-faint">
          {role}
        </span>
        <span className="mt-0.5 block truncate text-[0.85rem] font-semibold text-ink">
          {names || "Add name"}
        </span>
        {hint && (
          <span className="mt-0.5 block truncate text-[0.68rem] text-ink-faint">{hint}</span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <Pill tone={status} />
          {contribution && <PaymentTag mode={contribution.paymentMode} />}
          {contribution?.contributionKind === "both" && (
            <span className="text-[0.7rem] text-ink-faint">+ bhog</span>
          )}
        </span>
        {(collectorName || contribution?.paymentDate) && (
          <span className="mt-1 block truncate text-[0.68rem] text-ink-faint">
            {collectorName && `to ${collectorName}`}
            {collectorName && contribution?.paymentDate && " · "}
            {contribution?.paymentDate && formatShortDate(contribution.paymentDate)}
          </span>
        )}
        {assignedToName && (
          <span className="mt-1 block truncate text-[0.68rem] font-semibold text-brand">
            Follow up: {assignedToName}
          </span>
        )}
        {contribution?.followUpNote && (
          <span className="mt-1 block text-[0.7rem] text-ink-soft">
            {contribution.followUpNote}
          </span>
        )}
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[0.88rem] font-bold tabular-nums text-ink">
          {contribution?.originalPledgeAmount != null
            ? formatINR(contribution.originalPledgeAmount)
            : contribution && contribution.moneyAmount > 0
              ? formatINR(contribution.moneyAmount)
              : "—"}
        </span>
        {contribution?.originalPledgeAmount != null && (
          <span className="mt-0.5 block whitespace-nowrap text-[0.7rem] font-semibold tabular-nums text-gold">
            {formatINR(contribution.moneyAmount)} remaining of{" "}
            {formatINR(contribution.originalPledgeAmount)}
          </span>
        )}
        {previousYear && (
          <span className="mt-0.5 block whitespace-nowrap text-[0.66rem] tabular-nums text-ink-faint">
            last yr {formatINR(previousYear.amount)}
            {previousYear.payerName && ` · ${previousYear.payerName}`}
          </span>
        )}
      </span>
    </button>
  );
}

export function FlatCard({
  house,
  owner,
  ownerFlatCount,
  isPrimaryOwnerFlat = true,
  primaryFlatLabel,
  ownerContribution,
  tenantContribution,
  ownerCollector,
  tenantCollector,
  ownerAssignedTo,
  tenantAssignedTo,
  ownerPreviousYear,
  tenantPreviousYear,
  onEditOwner,
  onEditTenant,
  onRemoveOwner,
}: {
  house: House;
  owner?: Owner;
  ownerFlatCount: number;
  /** False on a multi-flat owner's non-primary flats — shows a compact reference row instead of the full owner row. */
  isPrimaryOwnerFlat?: boolean;
  /** "A-113" style label for the owner's primary flat — required whenever isPrimaryOwnerFlat is false. */
  primaryFlatLabel?: string;
  ownerContribution?: Contribution;
  tenantContribution?: Contribution;
  ownerCollector?: string;
  tenantCollector?: string;
  ownerAssignedTo?: string;
  tenantAssignedTo?: string;
  ownerPreviousYear?: PreviousYearInfo;
  tenantPreviousYear?: PreviousYearInfo;
  onEditOwner: () => void;
  onEditTenant: () => void;
  onRemoveOwner?: () => Promise<void>;
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const { submitting: removing, error: removeError, run: runRemove } = useAsyncAction();
  const anyPaid =
    ownerContribution?.status === "paid" || tenantContribution?.status === "paid";
  const hasTenant = house.tenantNames.length > 0 || tenantContribution !== undefined;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-2">
        <span
          className={`flex h-8 min-w-[2.5rem] shrink-0 items-center justify-center rounded-lg px-1.5 font-display text-[0.8rem] font-bold ${
            anyPaid ? "bg-success-tint text-success" : "bg-ground-alt text-ink"
          }`}
        >
          {house.flatNo}
        </span>
        <span className="text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
          {house.block} block
        </span>
      </div>

      {owner && !isPrimaryOwnerFlat && primaryFlatLabel ? (
        <OwnerReferenceRow
          names={owner.names.join(", ")}
          primaryFlatLabel={primaryFlatLabel}
          status={ownerContribution?.status ?? "not_visited"}
          onClick={onEditOwner}
        />
      ) : (
        <PayerRow
          role="Owner"
          names={owner ? owner.names.join(", ") : ""}
          hint={ownerFlatCount > 1 ? `Owns ${ownerFlatCount} flats — pays once` : undefined}
          contribution={ownerContribution}
          collectorName={ownerCollector}
          assignedToName={ownerAssignedTo}
          previousYear={ownerPreviousYear}
          onClick={onEditOwner}
        />
      )}

      {owner && onRemoveOwner && (
        <div className="border-t border-border px-3.5 py-2">
          {!confirmingRemove ? (
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              className="text-[0.72rem] font-semibold text-critical"
            >
              Remove owner
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[0.72rem] text-ink-faint">
                {ownerFlatCount > 1
                  ? `Removes ${owner.names.join(", ")} from all ${ownerFlatCount} flats they own, not just this one, and deletes their recorded contribution. This can't be undone.`
                  : "Removes this owner and deletes their recorded contribution. This can't be undone."}
              </p>
              <FormError message={removeError} />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  disabled={removing}
                  className="flex-1 rounded-xl border border-border py-2 text-[0.78rem] font-semibold text-ink-soft disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => runRemove(onRemoveOwner)}
                  disabled={removing}
                  className="flex-1 rounded-xl bg-critical py-2 text-[0.78rem] font-semibold text-white disabled:opacity-60"
                >
                  {removing ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No tenant usually means owner-occupied, not missing data — so this
          stays a quiet link rather than an empty row asking to be filled. */}
      {hasTenant ? (
        <div className="border-t border-border">
          <PayerRow
            role="Tenant"
            names={summarise(house.tenantNames)}
            contribution={tenantContribution}
            collectorName={tenantCollector}
            assignedToName={tenantAssignedTo}
            previousYear={tenantPreviousYear}
            onClick={onEditTenant}
          />
        </div>
      ) : (
        <div className="border-t border-border px-3.5 py-2">
          <button
            type="button"
            onClick={onEditTenant}
            className="text-[0.72rem] font-semibold text-ink-faint"
          >
            + Add tenant
          </button>
        </div>
      )}
    </div>
  );
}
