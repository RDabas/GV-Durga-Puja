import type { ReactNode } from "react";
import type { Contribution, ContributionStatus, House, Owner } from "@/lib/types";
import { Pill } from "@/components/Pill";
import { PaymentTag } from "@/components/PaymentBreakdown";
import { formatINR, formatShortDate } from "@/lib/format";
import type { PreviousYearInfo } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";

function summarise(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length <= 2) return names.join(", ");
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

/**
 * Card-level accent — the badge and border reflect the single "best" status
 * on the card (owner or tenant, whichever is further along), following the
 * same solid-badge-plus-accent-border pattern for every status instead of
 * treating "paid" as the only one worth highlighting.
 */
const cardAccent: Record<ContributionStatus, { badge: string; border: string }> = {
  paid: { badge: "bg-success text-surface", border: "border-success/40 border-r-success" },
  partial: { badge: "bg-warning text-surface", border: "border-warning/40 border-r-warning" },
  promised: { badge: "bg-gold text-surface", border: "border-gold/40 border-r-gold" },
  pending: { badge: "bg-brand text-surface", border: "border-brand/40 border-r-brand" },
  not_home: { badge: "bg-critical text-surface", border: "border-critical/40 border-r-critical" },
  not_visited: { badge: "bg-ground-alt text-ink", border: "border-border" },
};

// Best-to-worst — the card shows whichever status is furthest along between
// its owner and tenant, so a "paid" owner isn't outranked by a "not visited"
// tenant slot that simply hasn't been looked at yet.
const statusRank: ContributionStatus[] = [
  "paid",
  "partial",
  "promised",
  "pending",
  "not_home",
  "not_visited",
];

function bestStatus(...statuses: (ContributionStatus | undefined)[]): ContributionStatus {
  for (const s of statusRank) {
    if (statuses.includes(s)) return s;
  }
  return "not_visited";
}

/** Small "Disable"/"Enable" link shown right next to the owner's role label — a real sibling button, not nested inside the row's own tap-to-edit button. */
function DisableToggleButton({
  ownerName,
  disabled,
  onToggle,
}: {
  ownerName: string;
  disabled?: boolean;
  onToggle: () => Promise<void>;
}) {
  const { submitting, error, run } = useAsyncAction();
  const tone = error
    ? "bg-critical-tint text-critical"
    : disabled
      ? "bg-success-tint text-success"
      : "bg-warning-tint text-warning";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        const question = disabled
          ? `Enable ${ownerName || "this owner"} again? They'll count toward this year's totals and follow-up list.`
          : `Disable ${ownerName || "this owner"}? They'll be excluded from this year's totals and follow-up list until re-enabled.`;
        if (window.confirm(question)) run(onToggle);
      }}
      disabled={submitting}
      title={error ?? undefined}
      className={`shrink-0 rounded-full px-2.5 py-1 text-[0.66rem] font-bold whitespace-nowrap transition active:scale-95 disabled:opacity-60 ${tone}`}
    >
      {submitting ? "…" : error ? "Retry" : disabled ? "Enable" : "Disable"}
    </button>
  );
}

/** Shown on a multi-flat owner's non-primary flats instead of the full PayerRow — their money and status already live on the primary flat, so this is just a pointer there. */
function OwnerReferenceRow({
  names,
  primaryFlatLabel,
  status,
  disabled,
  headerAction,
  onClick,
}: {
  names: string;
  primaryFlatLabel: string;
  status: ContributionStatus;
  disabled?: boolean;
  headerAction?: ReactNode;
  onClick: () => void;
}) {
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="flex items-center justify-between gap-2 px-3.5 pt-2.5">
        <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-ink-faint">
          Owner
        </span>
        {headerAction}
      </div>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-3.5 pb-2.5 pt-1 text-left transition active:scale-[0.99]"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.82rem] font-semibold text-ink">
            {names || "—"}
          </span>
          {disabled ? (
            <span className="mt-0.5 block truncate text-[0.68rem] text-ink-faint">Disabled</span>
          ) : (
            <span className="mt-1 block">
              <Pill tone={status}>{`Paid via ${primaryFlatLabel}`}</Pill>
            </span>
          )}
        </span>
      </button>
    </div>
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
  disabled,
  headerAction,
  onClick,
}: {
  role: string;
  names: string;
  hint?: string;
  contribution?: Contribution;
  collectorName?: string;
  assignedToName?: string;
  previousYear?: PreviousYearInfo[];
  /** Owner is excluded from this year's totals/follow-up — show that instead of their current-year status. */
  disabled?: boolean;
  headerAction?: ReactNode;
  onClick: () => void;
}) {
  const status = contribution?.status ?? "not_visited";

  return (
    <div className={disabled ? "opacity-50" : ""}>
      {headerAction && (
        <div className="flex items-center justify-between gap-2 px-3 pt-3">
          <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-ink-faint">
            {role}
          </span>
          {headerAction}
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-start gap-3 px-3 text-left transition active:scale-[0.99] ${headerAction ? "pb-3 pt-1" : "py-3"}`}
      >
        <span className="min-w-0 flex-1">
          {!headerAction && (
            <span className="block text-[0.62rem] font-semibold uppercase tracking-wide text-ink-faint">
              {role}
            </span>
          )}
        <span className="mt-0.5 block truncate text-[0.85rem] font-semibold text-ink">
          {names || "Add name"}
        </span>
        {hint && (
          <span className="mt-0.5 block truncate text-[0.68rem] text-ink-faint">{hint}</span>
        )}
        {disabled ? (
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <Pill tone="disabled" />
          </span>
        ) : (
          <>
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
          </>
        )}
      </span>
      <span className="shrink-0 text-right">
        {!disabled && (
          <>
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
          </>
        )}
        {previousYear?.map((py, i) => (
          <span
            key={i}
            className="mt-0.5 block whitespace-nowrap text-[0.66rem] tabular-nums text-ink-faint"
          >
            last yr {formatINR(py.amount)}
            {py.payerName && ` · ${py.payerName}`}
          </span>
        ))}
      </span>
      </button>
    </div>
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
  onToggleOwnerDisabled,
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
  ownerPreviousYear?: PreviousYearInfo[];
  tenantPreviousYear?: PreviousYearInfo[];
  onEditOwner: () => void;
  onEditTenant: () => void;
  onToggleOwnerDisabled?: () => Promise<void>;
}) {
  // A disabled owner's status is excluded — same as everywhere else they're
  // "not considered" — so their card doesn't get accented by a stale status.
  const cardStatus = bestStatus(
    owner && !owner.disabled ? ownerContribution?.status : undefined,
    tenantContribution?.status,
  );
  const accent = cardAccent[cardStatus];
  const hasTenant = house.tenantNames.length > 0 || tenantContribution !== undefined;
  // Disabling only makes sense when a tenant is also on the flat (an
  // owner-occupied flat has no one else to fall back on) — but re-enabling
  // must always stay available so a disabled owner is never stuck that way.
  const showDisableToggle = owner && onToggleOwnerDisabled && (owner.disabled || hasTenant);
  const disableToggle = showDisableToggle ? (
    <DisableToggleButton
      ownerName={owner!.names.join(", ")}
      disabled={owner!.disabled}
      onToggle={onToggleOwnerDisabled!}
    />
  ) : undefined;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-r-[3px] bg-surface shadow-[var(--shadow-card)] ${accent.border}`}
    >
      <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-2">
        <span
          className={`flex h-8 min-w-[2.5rem] shrink-0 items-center justify-center rounded-lg px-1.5 font-display text-[0.8rem] font-bold ${accent.badge}`}
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
          disabled={owner.disabled}
          headerAction={disableToggle}
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
          disabled={owner?.disabled}
          headerAction={disableToggle}
          onClick={onEditOwner}
        />
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
