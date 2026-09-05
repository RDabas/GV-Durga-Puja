import type { Contribution, House, Owner } from "@/lib/types";
import { Pill } from "@/components/Pill";
import { PaymentTag } from "@/components/PaymentBreakdown";
import { formatINR, formatShortDate } from "@/lib/format";
import type { PreviousYearInfo } from "@/lib/store";

function summarise(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length <= 2) return names.join(", ");
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

function PayerRow({
  role,
  names,
  hint,
  contribution,
  collectorName,
  previousYear,
  onClick,
}: {
  role: string;
  names: string;
  hint?: string;
  contribution?: Contribution;
  collectorName?: string;
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
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[0.88rem] font-bold tabular-nums text-ink">
          {contribution && contribution.moneyAmount > 0
            ? formatINR(contribution.moneyAmount)
            : "—"}
        </span>
        {previousYear && (
          <>
            <span className="mt-0.5 block text-[0.66rem] tabular-nums text-ink-faint">
              last yr {formatINR(previousYear.amount)}
            </span>
            <span className="mt-1 flex flex-wrap items-center justify-end gap-1">
              <Pill tone={previousYear.status} />
              <PaymentTag mode={previousYear.mode} />
            </span>
          </>
        )}
      </span>
    </button>
  );
}

export function FlatCard({
  house,
  owner,
  ownerFlatCount,
  ownerContribution,
  tenantContribution,
  ownerCollector,
  tenantCollector,
  ownerPreviousYear,
  tenantPreviousYear,
  onEditOwner,
  onEditTenant,
}: {
  house: House;
  owner?: Owner;
  ownerFlatCount: number;
  ownerContribution?: Contribution;
  tenantContribution?: Contribution;
  ownerCollector?: string;
  tenantCollector?: string;
  ownerPreviousYear?: PreviousYearInfo;
  tenantPreviousYear?: PreviousYearInfo;
  onEditOwner: () => void;
  onEditTenant: () => void;
}) {
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

      <PayerRow
        role="Owner"
        names={owner ? owner.names.join(", ") : ""}
        hint={ownerFlatCount > 1 ? `Owns ${ownerFlatCount} flats — pays once` : undefined}
        contribution={ownerContribution}
        collectorName={ownerCollector}
        previousYear={ownerPreviousYear}
        onClick={onEditOwner}
      />

      {/* No tenant usually means owner-occupied, not missing data — so this
          stays a quiet link rather than an empty row asking to be filled. */}
      {hasTenant ? (
        <div className="border-t border-border">
          <PayerRow
            role="Tenant"
            names={summarise(house.tenantNames)}
            contribution={tenantContribution}
            collectorName={tenantCollector}
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
