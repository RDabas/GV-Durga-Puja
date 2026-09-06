"use client";

import Link from "next/link";
import { Pill } from "@/components/Pill";
import { CoinsIcon, PlusIcon, ReceiptIcon } from "@/components/icons";
import { formatINR } from "@/lib/format";
import { usePujaData } from "@/lib/store";

export default function DashboardPage() {
  const { contributions, sponsors, vendorExpenses, houses, owners } = usePujaData();

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

  const followUps = contributions
    .filter(
      (c) => c.status === "promised" || c.status === "partial" || c.status === "not_home",
    )
    .map((c) => {
      const house = c.houseId ? houses.find((h) => h.id === c.houseId) : undefined;
      const owner = c.ownerId ? owners.find((o) => o.id === c.ownerId) : undefined;
      return {
        contribution: c,
        badge: house ? house.flatNo : "OWN",
        title: house
          ? `${house.block}-${house.flatNo} · ${house.tenantNames.join(", ") || "Tenant"}`
          : `${owner?.names.join(", ") ?? "Owner"} · owner`,
      };
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
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          {followUps.map(({ contribution, badge, title }, i) => (
            <div
              key={contribution.id}
              className={`flex items-center gap-3 p-3 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <span className="flex h-[38px] min-w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-ground-alt px-1 font-display text-[0.78rem] font-bold text-ink-soft">
                {badge}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.88rem] font-semibold text-ink">{title}</div>
                <div className="mt-0.5 truncate text-[0.75rem] text-ink-faint">
                  {contribution.status === "promised"
                    ? [
                        contribution.moneyAmount > 0
                          ? `Promised ${formatINR(contribution.moneyAmount)}`
                          : "Promised to pay",
                        contribution.followUpNote,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : contribution.status === "not_home"
                      ? contribution.followUpNote ?? "No one was home — go back"
                      : `Partial — ${formatINR(contribution.moneyAmount)} so far`}
                </div>
              </div>
              <Pill tone={contribution.status} />
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
        </div>
      </div>
    </>
  );
}
