"use client";

import { useMemo, useState } from "react";
import { ContributionSheet } from "@/components/ContributionSheet";
import { Pill } from "@/components/Pill";
import { ProgressBar } from "@/components/ProgressBar";
import { CoinsIcon, SponsorsIcon, VendorsIcon } from "@/components/icons";
import { knownBlocks } from "@/lib/directory";
import { formatINR } from "@/lib/format";
import { usePujaData } from "@/lib/store";
import type { Block, Contribution, ContributionStatus, House } from "@/lib/types";

const followUpStatusOptions: { value: ContributionStatus; label: string }[] = [
  { value: "promised", label: "Promised" },
  { value: "partial", label: "Partial" },
  { value: "pending", label: "Pending" },
  { value: "not_home", label: "Nobody home" },
  { value: "not_visited", label: "Not visited" },
];

// Pending and Nobody home are the two that actually need someone to go back
// — Promised/Partial are already committed and Not visited is usually the
// biggest bucket by far, so both stay opt-in rather than the default view.
const defaultFollowUpStatuses: ContributionStatus[] = ["pending", "not_home"];

// Same solid-badge color language as FlatCard's per-status accent, so a
// row's avatar tells you its status at a glance instead of blending into a
// uniform gray list.
const followUpAvatarTone: Record<ContributionStatus, string> = {
  paid: "bg-success text-surface",
  partial: "bg-warning text-surface",
  promised: "bg-gold text-surface",
  pending: "bg-brand text-surface",
  not_home: "bg-critical text-surface",
  not_visited: "bg-ground-alt text-ink-soft",
};

interface FollowUpEntry {
  key: string;
  badge: string;
  name: string;
  /** Kept separate from name — a long name shouldn't be able to truncate this away. */
  flatInfo: string;
  block: Block;
  status: ContributionStatus;
  contribution?: Contribution;
  /** Anchor for editing — for an owner entry, any one of their flats works. */
  house: House;
  role: "owner" | "tenant";
}

function followUpDescription(
  status: ContributionStatus,
  contribution: Contribution | undefined,
  memberName: (memberId?: string) => string | undefined,
): string {
  const assignee = memberName(contribution?.assignedToMemberId) ?? contribution?.assignedToName;
  const assignedTag = assignee ? `assigned to ${assignee}` : undefined;

  switch (status) {
    case "promised":
      return [
        contribution && contribution.moneyAmount > 0
          ? `Promised ${formatINR(contribution.originalPledgeAmount ?? contribution.moneyAmount)}`
          : "Promised to pay",
        contribution?.followUpNote,
      ]
        .filter(Boolean)
        .join(" · ");
    case "not_home":
      return [contribution?.followUpNote ?? "No one was home — go back", assignedTag]
        .filter(Boolean)
        .join(" · ");
    case "pending":
      return [contribution?.followUpNote ?? "Spoke to them — payment pending", assignedTag]
        .filter(Boolean)
        .join(" · ");
    case "partial":
      return `Partial — ${formatINR(contribution?.moneyAmount ?? 0)} so far`;
    default:
      return [contribution?.followUpNote ?? "Not visited yet", assignedTag]
        .filter(Boolean)
        .join(" · ");
  }
}

export default function DashboardPage() {
  const {
    years,
    activeYear,
    contributions,
    sponsors,
    vendorExpenses,
    houses,
    owners,
    contributionFor,
    memberName,
    ownerPrimaryHouse,
    previousYearInfo,
  } = usePujaData();
  const [blockFilter, setBlockFilter] = useState<Block | "all">("all");
  const [statusFilters, setStatusFilters] = useState<ContributionStatus[]>(defaultFollowUpStatuses);
  const [moneyBlockFilter, setMoneyBlockFilter] = useState<Block | "all">("all");
  const [editing, setEditing] = useState<{ house: House; role: "owner" | "tenant" } | null>(
    null,
  );

  const sponsorReceived = sponsors.reduce(
    (sum, s) => sum + s.payments.reduce((ps, p) => ps + p.amount, 0),
    0,
  );
  const vendorPaid = vendorExpenses.reduce(
    (sum, e) => sum + e.payments.reduce((s, p) => s + p.amount, 0),
    0,
  );
  const vendorPending = vendorExpenses.reduce((sum, e) => sum + e.totalAmount, 0) - vendorPaid;

  // Every flat and every owner gets an entry even with no contribution row
  // yet — "not visited" is the implicit default, same as FlatCard shows it,
  // so this list can answer "who haven't we been to" as well as who's
  // promised, partial, or not home.
  const followUpEntries = useMemo<FollowUpEntry[]>(() => {
    const entries: FollowUpEntry[] = [];

    for (const owner of owners) {
      if (owner.disabled) continue;
      const ownerHouses = houses.filter((h) => h.ownerId === owner.id);
      if (ownerHouses.length === 0) continue;
      const primaryHouse = ownerPrimaryHouse(owner.id) ?? ownerHouses[0];
      const contribution = contributionFor({ ownerId: owner.id });
      entries.push({
        key: `owner-${owner.id}`,
        badge: "OWN",
        name: `${owner.names.join(", ")} · owner`,
        flatInfo: ownerHouses.map((h) => `${h.block}-${h.flatNo}`).join(", "),
        block: primaryHouse.block,
        status: contribution?.status ?? "not_visited",
        contribution,
        house: primaryHouse,
        role: "owner",
      });
    }

    for (const house of houses) {
      const contribution = contributionFor({ houseId: house.id });
      const hasTenant = house.tenantNames.length > 0 || contribution !== undefined;
      if (!hasTenant) continue;
      entries.push({
        key: `tenant-${house.id}`,
        badge: house.flatNo,
        name: house.tenantNames.join(", ") || "Tenant",
        flatInfo: `${house.block}-${house.flatNo}`,
        block: house.block,
        status: contribution?.status ?? "not_visited",
        contribution,
        house,
        role: "tenant",
      });
    }

    // Owners and tenants were pushed as two separate groups above — sort by
    // each entry's anchor flat so the list reads in a sensible flat order
    // instead of "every owner, then every tenant" in DB order.
    entries.sort(
      (a, b) =>
        b.house.block.localeCompare(a.house.block) ||
        b.house.floor - a.house.floor ||
        b.house.flatNo.localeCompare(a.house.flatNo),
    );
    return entries;
  }, [owners, houses, contributionFor, ownerPrimaryHouse]);

  // Money stats reuse the same per-owner/per-flat entries as the follow-up
  // list — an owner spanning several blocks is counted once, against their
  // primary flat's block only, so the same payment can't inflate more than
  // one block's total.
  const moneyEntries =
    moneyBlockFilter === "all"
      ? followUpEntries
      : followUpEntries.filter((e) => e.block === moneyBlockFilter);
  const paidAmount = moneyEntries
    .filter((e) => e.status === "paid" || e.status === "partial")
    .reduce((sum, e) => sum + (e.contribution?.moneyAmount ?? 0) + (e.contribution?.bhogGroceryAmount ?? 0), 0);
  const promisedAmount = moneyEntries
    .filter((e) => e.status === "promised")
    .reduce((sum, e) => sum + (e.contribution?.moneyAmount ?? 0), 0);
  const totalExpected = paidAmount + promisedAmount;
  const housesInMoneyBlock =
    moneyBlockFilter === "all" ? houses : houses.filter((h) => h.block === moneyBlockFilter);
  // A flat counts as visited once either its tenant or its owner has an
  // entry — the owner side only counts on their primary flat, so a
  // multi-flat owner's one visit doesn't count as visiting every flat.
  const flatsVisited = housesInMoneyBlock.filter((h) => {
    const tenant = contributions.find((c) => c.houseId === h.id);
    const isPrimary = h.ownerId ? ownerPrimaryHouse(h.ownerId)?.id === h.id : false;
    const ownerDisabled = h.ownerId ? owners.find((o) => o.id === h.ownerId)?.disabled : false;
    const owner =
      h.ownerId && isPrimary && !ownerDisabled
        ? contributions.find((c) => c.ownerId === h.ownerId)
        : undefined;
    return (
      (tenant && tenant.status !== "not_visited") ||
      (owner && owner.status !== "not_visited")
    );
  }).length;

  const previousYear = [...years]
    .filter((y) => y.year < activeYear.year)
    .sort((a, b) => b.year - a.year)[0];

  // Same primary-flat consolidation as the current-year totals above — a
  // multi-flat owner's prior-year payment only counts once, against their
  // primary flat's block, so last year's figure is comparable to this year's.
  const previousYearAmountByBlock = useMemo(() => {
    const totals: Partial<Record<Block, number>> & { all: number } = { all: 0 };
    const add = (block: Block, amount: number) => {
      totals.all += amount;
      totals[block] = (totals[block] ?? 0) + amount;
    };
    for (const house of houses) {
      const entries = previousYearInfo[house.id];
      if (entries) add(house.block, entries.reduce((s, e) => s + e.amount, 0));
    }
    for (const owner of owners) {
      const entries = previousYearInfo[owner.id];
      const primary = entries ? ownerPrimaryHouse(owner.id) : undefined;
      if (entries && primary) add(primary.block, entries.reduce((s, e) => s + e.amount, 0));
    }
    return totals;
  }, [houses, owners, previousYearInfo, ownerPrimaryHouse]);

  const lastYearAmount =
    moneyBlockFilter === "all"
      ? previousYearAmountByBlock.all
      : (previousYearAmountByBlock[moneyBlockFilter] ?? 0);
  // Compared against Total (paid + promised), not just paid — it sits under
  // the Total figure, so it should track the same number.
  const trendPercent =
    previousYear && lastYearAmount > 0
      ? Math.round(((totalExpected - lastYearAmount) / lastYearAmount) * 100)
      : null;

  const followUps = followUpEntries.filter((e) => {
    if (blockFilter !== "all" && e.block !== blockFilter) return false;
    return statusFilters.includes(e.status);
  });

  const vendorTotal = vendorPaid + vendorPending;
  const vendorPaidPercent = vendorTotal > 0 ? (vendorPaid / vendorTotal) * 100 : 0;
  const flatsVisitedPercent =
    housesInMoneyBlock.length > 0 ? (flatsVisited / housesInMoneyBlock.length) * 100 : 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="col-span-2 rounded-2xl border border-r-[3px] border-brand/30 border-r-brand bg-surface p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-brand-tint text-brand">
              <CoinsIcon className="h-[13px] w-[13px]" />
            </span>
            <span className="text-[0.72rem] font-semibold text-ink-faint">From houses</span>
          </div>

          <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            <button
              type="button"
              onClick={() => setMoneyBlockFilter("all")}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
                moneyBlockFilter === "all"
                  ? "bg-brand text-white"
                  : "border border-border bg-surface text-ink-soft"
              }`}
            >
              All blocks
            </button>
            {knownBlocks.map((block) => (
              <button
                key={block}
                type="button"
                onClick={() => setMoneyBlockFilter(block)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
                  moneyBlockFilter === block
                    ? "bg-brand text-white"
                    : "border border-border bg-surface text-ink-soft"
                }`}
              >
                {block}
              </button>
            ))}
          </div>

          <div className="mt-2.5 flex justify-between text-[0.72rem] text-ink-faint">
            <span>
              Paid
              <b className="mt-0.5 block text-[1.05rem] font-bold tabular-nums text-ink">
                {formatINR(paidAmount)}
              </b>
            </span>
            <span>
              Promised
              <b className="mt-0.5 block text-[1.05rem] font-bold tabular-nums text-ink">
                {formatINR(promisedAmount)}
              </b>
            </span>
            <span>
              Total
              <b className="mt-0.5 block text-[1.05rem] font-bold tabular-nums text-ink">
                {formatINR(totalExpected)}
              </b>
              {trendPercent !== null && (
                <span
                  className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.66rem] font-bold tabular-nums ${
                    trendPercent >= 0 ? "bg-success-tint text-success" : "bg-critical-tint text-critical"
                  }`}
                >
                  {trendPercent >= 0 ? "▲" : "▼"} {Math.abs(trendPercent)}% vs {previousYear!.year}
                </span>
              )}
            </span>
          </div>
          <div className="mt-2.5 text-[0.72rem] tabular-nums text-ink-soft">
            {flatsVisited} of {housesInMoneyBlock.length} flats visited
          </div>
          <ProgressBar percent={flatsVisitedPercent} />
        </div>
        <div className="rounded-2xl border border-r-[3px] border-gold/30 border-r-gold bg-surface p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-gold-tint text-gold">
              <SponsorsIcon className="h-[13px] w-[13px]" />
            </span>
            <span className="text-[0.72rem] font-semibold text-ink-faint">Sponsors</span>
          </div>
          <div className="mt-1.5 font-display text-[1.2rem] font-bold tabular-nums text-ink">
            {formatINR(sponsorReceived)}
          </div>
          <div className="mt-0.5 text-[0.72rem] text-ink-soft">{sponsors.length} confirmed</div>
        </div>
        <div
          className={`rounded-2xl border border-r-[3px] bg-surface p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${
            vendorPending > 0 ? "border-warning/30 border-r-warning" : "border-success/30 border-r-success"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] ${
                vendorPending > 0 ? "bg-warning-tint text-warning" : "bg-success-tint text-success"
              }`}
            >
              <VendorsIcon className="h-[13px] w-[13px]" />
            </span>
            <span className="text-[0.72rem] font-semibold text-ink-faint">Vendor spend</span>
          </div>
          <div className="mt-1.5 font-display text-[1.2rem] font-bold tabular-nums text-ink">
            {formatINR(vendorPaid)}
          </div>
          <div className="mt-0.5 text-[0.72rem] tabular-nums text-ink-soft">
            {vendorPending > 0 ? `${formatINR(vendorPending)} pending` : "Fully settled"}
          </div>
          {vendorTotal > 0 && <ProgressBar percent={vendorPaidPercent} />}
        </div>
      </div>

      <div>
        <p className="mb-2 px-0.5 text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
          Needs follow-up
        </p>

        <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          <button
            type="button"
            onClick={() => setBlockFilter("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold ${
              blockFilter === "all"
                ? "bg-brand text-white"
                : "border border-border bg-surface text-ink-soft"
            }`}
          >
            All blocks
          </button>
          {knownBlocks.map((block) => (
            <button
              key={block}
              type="button"
              onClick={() => setBlockFilter(block)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold ${
                blockFilter === block
                  ? "bg-brand text-white"
                  : "border border-border bg-surface text-ink-soft"
              }`}
            >
              {block}
            </button>
          ))}
        </div>

        <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          <button
            type="button"
            onClick={() =>
              setStatusFilters(
                statusFilters.length === followUpStatusOptions.length
                  ? []
                  : followUpStatusOptions.map((o) => o.value),
              )
            }
            className={`shrink-0 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold ${
              statusFilters.length === followUpStatusOptions.length
                ? "bg-brand text-white"
                : "border border-border bg-surface text-ink-soft"
            }`}
          >
            All
          </button>
          {followUpStatusOptions.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                setStatusFilters((prev) =>
                  prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
                )
              }
              className={`shrink-0 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold ${
                statusFilters.includes(value)
                  ? "bg-brand text-white"
                  : "border border-border bg-surface text-ink-soft"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          {followUps.length === 0 && (
            <p className="p-3 text-[0.8rem] text-ink-faint">Nothing matches this filter.</p>
          )}
          {followUps.map(({ key, badge, name, flatInfo, status, contribution, house, role }, i) => (
            <button
              type="button"
              key={key}
              onClick={() => setEditing({ house, role })}
              className={`flex w-full items-start gap-3 p-3 text-left transition active:scale-[0.99] ${i > 0 ? "border-t border-border" : ""}`}
            >
              <span
                className={`flex h-[38px] min-w-[38px] shrink-0 items-center justify-center rounded-[11px] px-1 font-display text-[0.78rem] font-bold ${followUpAvatarTone[status]}`}
              >
                {badge}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.88rem] font-semibold text-ink">{name}</div>
                <div className="mt-0.5 truncate text-[0.75rem] text-ink-faint">
                  {followUpDescription(status, contribution, memberName)}
                </div>
                {contribution?.originalPledgeAmount != null && (
                  <div className="mt-0.5 text-[0.72rem] font-semibold text-gold">
                    {formatINR(contribution.moneyAmount)} remaining of{" "}
                    {formatINR(contribution.originalPledgeAmount)}
                  </div>
                )}
                {/* Never truncated — a long name shouldn't be able to hide which flat(s) this is. */}
                <div className="mt-1 text-[0.68rem] font-semibold text-ink-soft">{flatInfo}</div>
              </div>
              <Pill tone={status} />
            </button>
          ))}
        </div>
      </div>

      {editing && (
        <ContributionSheet
          key={`${editing.house.id}-${editing.role}`}
          open
          house={editing.house}
          role={editing.role}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
