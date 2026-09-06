"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Pill } from "@/components/Pill";
import { CoinsIcon, DownloadIcon, PlusIcon, ReceiptIcon } from "@/components/icons";
import { exportPujaDataToExcel } from "@/lib/export";
import { knownBlocks } from "@/lib/directory";
import { formatINR } from "@/lib/format";
import { usePujaData } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";
import type { Block, Contribution, ContributionStatus } from "@/lib/types";

type FollowUpFilter = "active" | ContributionStatus;

const followUpFilters: { value: FollowUpFilter; label: string }[] = [
  { value: "active", label: "All" },
  { value: "promised", label: "Promised" },
  { value: "partial", label: "Partial" },
  { value: "pending", label: "Pending" },
  { value: "not_home", label: "Nobody home" },
  { value: "not_visited", label: "Not visited" },
];

interface FollowUpEntry {
  key: string;
  badge: string;
  name: string;
  /** Kept separate from name — a long name shouldn't be able to truncate this away. */
  flatInfo: string;
  blocks: Block[];
  status: ContributionStatus;
  contribution?: Contribution;
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
          ? `Promised ${formatINR(contribution.moneyAmount)}`
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
  const store = usePujaData();
  const { contributions, sponsors, vendorExpenses, houses, owners, contributionFor, memberName } =
    store;
  const { submitting: exporting, error: exportError, run: runExport } = useAsyncAction();
  const [blockFilter, setBlockFilter] = useState<Block | "all">("all");
  const [statusFilter, setStatusFilter] = useState<FollowUpFilter>("active");

  const paidAmount = contributions
    .filter((c) => c.status === "paid" || c.status === "partial")
    .reduce((sum, c) => sum + c.moneyAmount + c.bhogGroceryAmount, 0);
  const promisedAmount = contributions
    .filter((c) => c.status === "promised")
    .reduce((sum, c) => sum + c.moneyAmount, 0);
  const totalExpected = paidAmount + promisedAmount;
  // A flat counts as visited once either its tenant or its owner has an entry.
  const flatsVisited = houses.filter((h) => {
    const tenant = contributions.find((c) => c.houseId === h.id);
    const owner = h.ownerId
      ? contributions.find((c) => c.ownerId === h.ownerId)
      : undefined;
    return (
      (tenant && tenant.status !== "not_visited") ||
      (owner && owner.status !== "not_visited")
    );
  }).length;
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
      const ownerHouses = houses.filter((h) => h.ownerId === owner.id);
      if (ownerHouses.length === 0) continue;
      const contribution = contributionFor({ ownerId: owner.id });
      entries.push({
        key: `owner-${owner.id}`,
        badge: "OWN",
        name: `${owner.names.join(", ")} · owner`,
        flatInfo: ownerHouses.map((h) => `${h.block}-${h.flatNo}`).join(", "),
        blocks: [...new Set(ownerHouses.map((h) => h.block))],
        status: contribution?.status ?? "not_visited",
        contribution,
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
        blocks: [house.block],
        status: contribution?.status ?? "not_visited",
        contribution,
      });
    }

    return entries;
  }, [owners, houses, contributionFor]);

  const followUps = followUpEntries.filter((e) => {
    if (blockFilter !== "all" && !e.blocks.includes(blockFilter)) return false;
    if (statusFilter === "active") {
      return (
        e.status === "promised" ||
        e.status === "partial" ||
        e.status === "pending" ||
        e.status === "not_home"
      );
    }
    return e.status === statusFilter;
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="col-span-2 rounded-2xl border border-border bg-surface p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-ink-faint">
            <CoinsIcon className="h-[13px] w-[13px]" />
            From houses
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
            </span>
          </div>
          <div className="mt-2.5 text-[0.72rem] tabular-nums text-ink-soft">
            {flatsVisited} of {houses.length} flats visited
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <div className="text-[0.72rem] font-semibold text-ink-faint">Sponsors</div>
          <div className="mt-0.5 font-display text-[1.2rem] font-bold tabular-nums text-ink">
            {formatINR(sponsorReceived)}
          </div>
          <div className="mt-0.5 text-[0.72rem] text-ink-soft">{sponsors.length} confirmed</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <div className="text-[0.72rem] font-semibold text-ink-faint">Vendor spend</div>
          <div className="mt-0.5 font-display text-[1.2rem] font-bold tabular-nums text-ink">
            {formatINR(vendorPaid)}
          </div>
          <div className="mt-0.5 text-[0.72rem] tabular-nums text-ink-soft">
            {formatINR(vendorPending)} pending
          </div>
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
          {followUpFilters.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold ${
                statusFilter === value
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
          {followUps.map(({ key, badge, name, flatInfo, status, contribution }, i) => (
            <div
              key={key}
              className={`flex items-start gap-3 p-3 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <span className="flex h-[38px] min-w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-ground-alt px-1 font-display text-[0.78rem] font-bold text-ink-soft">
                {badge}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.88rem] font-semibold text-ink">{name}</div>
                <div className="mt-0.5 truncate text-[0.75rem] text-ink-faint">
                  {followUpDescription(status, contribution, memberName)}
                </div>
                {/* Never truncated — a long name shouldn't be able to hide which flat(s) this is. */}
                <div className="mt-1 text-[0.68rem] font-semibold text-ink-soft">{flatInfo}</div>
              </div>
              <Pill tone={status} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 px-0.5 text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
          Quick actions
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/collect"
            className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-3.5 text-[0.82rem] font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          >
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-brand-tint text-brand">
              <PlusIcon className="h-[15px] w-[15px]" />
            </span>
            Add collection
          </Link>
          <Link
            href="/vendors"
            className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-3.5 text-[0.82rem] font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          >
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-brand-tint text-brand">
              <ReceiptIcon className="h-[15px] w-[15px]" />
            </span>
            Add vendor bill
          </Link>
          <button
            type="button"
            onClick={() => runExport(() => exportPujaDataToExcel(store))}
            disabled={exporting}
            className="col-span-2 flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-3.5 text-[0.82rem] font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)] disabled:opacity-60"
          >
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-brand-tint text-brand">
              <DownloadIcon className="h-[15px] w-[15px]" />
            </span>
            {exporting ? "Preparing export…" : "Export to Excel"}
          </button>
        </div>
        {exportError && (
          <p className="mt-1.5 px-0.5 text-[0.75rem] text-critical">{exportError}</p>
        )}
      </div>
    </>
  );
}
