"use client";

import { useState } from "react";
import { CarriedFundSheet } from "@/components/CarriedFundSheet";
import { FundTransferSheet } from "@/components/FundTransferSheet";
import { MembersSheet } from "@/components/MembersSheet";
import { paymentModeChipStyles, PaymentTag } from "@/components/PaymentBreakdown";
import { DownloadIcon } from "@/components/icons";
import { formatINR, formatShortDate } from "@/lib/format";
import { committeeBalances } from "@/lib/balances";
import { carriedFundKindLabels } from "@/lib/carriedFund";
import { exportPujaDataToExcel } from "@/lib/export";
import { paymentModeLabels, sortedBreakdown } from "@/lib/payment";
import { usePujaData } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";
import type { PaymentMode } from "@/lib/types";

export default function FundsPage() {
  const store = usePujaData();
  const {
    members,
    contributions,
    fundTransfers,
    sponsors,
    vendorExpenses,
    carriedFunds,
    houses,
    owners,
    ownerPrimaryHouse,
  } = store;
  const [managingMembers, setManagingMembers] = useState(false);
  const [managingCarriedFunds, setManagingCarriedFunds] = useState(false);
  const [managingTransfers, setManagingTransfers] = useState(false);
  const [expanded, setExpanded] = useState<{ memberId: string; mode: PaymentMode } | null>(null);
  const { submitting: exporting, error: exportError, run: runExport } = useAsyncAction();

  const balances = committeeBalances(
    members,
    contributions,
    fundTransfers,
    sponsors,
    vendorExpenses,
    carriedFunds,
  );

  /** Who a member's total for one payment mode is actually made up of — flat and amount, for tapping a Cash/GPay/… chip. */
  function contributorsFor(memberId: string, mode: PaymentMode) {
    return contributions
      .filter((c) => c.collectorId === memberId && c.paymentMode === mode)
      .map((c) => {
        if (c.houseId) {
          const house = houses.find((h) => h.id === c.houseId);
          return {
            key: c.id,
            name: house?.tenantNames.join(", ") || "Tenant",
            flatLabel: house ? `${house.block}-${house.flatNo}` : "—",
            amount: c.moneyAmount,
            mode: c.paymentMode,
            paymentDate: c.paymentDate,
          };
        }
        const owner = c.ownerId ? owners.find((o) => o.id === c.ownerId) : undefined;
        const primaryHouse = c.ownerId ? ownerPrimaryHouse(c.ownerId) : undefined;
        return {
          key: c.id,
          name: owner?.names.join(", ") ?? "Owner",
          flatLabel: primaryHouse ? `${primaryHouse.block}-${primaryHouse.flatNo}` : "—",
          amount: c.moneyAmount,
          mode: c.paymentMode,
          paymentDate: c.paymentDate,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="px-0.5 text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
          Who&rsquo;s holding the money
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setManagingTransfers(true)}
            className="text-[0.72rem] font-semibold text-brand"
          >
            Hand over
          </button>
          <button
            type="button"
            onClick={() => setManagingCarriedFunds(true)}
            className="text-[0.72rem] font-semibold text-brand"
          >
            Prev. year fund
          </button>
          <button
            type="button"
            onClick={() => setManagingMembers(true)}
            className="text-[0.72rem] font-semibold text-brand"
          >
            Manage
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]">
        {balances.map(
          (
            {
              member,
              collected,
              sponsorReceived,
              handedOver,
              received,
              vendorPaid,
              carriedCash,
              carriedFd,
              carriedBank,
              balanceInHand,
              collectedByMode,
            },
            i,
          ) => {
            const carried = carriedCash + carriedFd + carriedBank;
            const expandedMode = expanded?.memberId === member.id ? expanded.mode : null;
            return (
              <div key={member.id} className={i > 0 ? "border-t border-border" : ""}>
                <div className="flex items-start gap-3 p-3">
                  <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-ground-alt font-display text-[0.82rem] font-bold text-ink-soft">
                    {member.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[0.88rem] font-semibold text-ink">
                      {member.name}
                    </div>
                    <div className="mt-0.5 text-[0.75rem] text-ink-faint">
                      Collected {formatINR(collected)}
                      {sponsorReceived > 0 && ` · sponsors ${formatINR(sponsorReceived)}`}
                      {carried > 0 && ` · carried over ${formatINR(carried)}`}
                      {received > 0 && ` · received ${formatINR(received)}`}
                      {handedOver > 0 && ` · handed over ${formatINR(handedOver)}`}
                      {vendorPaid > 0 && ` · paid vendor ${formatINR(vendorPaid)}`}
                    </div>
                    {sortedBreakdown(collectedByMode).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {sortedBreakdown(collectedByMode).map(([mode, amount]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() =>
                              setExpanded(
                                expandedMode === mode ? null : { memberId: member.id, mode },
                              )
                            }
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.66rem] font-semibold tabular-nums whitespace-nowrap transition active:scale-95 ${paymentModeChipStyles[mode]} ${expandedMode === mode ? "ring-2 ring-offset-1 ring-ink/30" : ""}`}
                          >
                            {paymentModeLabels[mode]} {formatINR(amount)}
                          </button>
                        ))}
                      </div>
                    )}
                    {carried > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {carriedCash > 0 && (
                          <span className="rounded-full bg-ground-alt px-2 py-0.5 text-[0.66rem] font-semibold tabular-nums text-ink-soft">
                            {carriedFundKindLabels.cash} {formatINR(carriedCash)}
                          </span>
                        )}
                        {carriedFd > 0 && (
                          <span className="rounded-full bg-ground-alt px-2 py-0.5 text-[0.66rem] font-semibold tabular-nums text-ink-soft">
                            {carriedFundKindLabels.fd} {formatINR(carriedFd)}
                          </span>
                        )}
                        {carriedBank > 0 && (
                          <span className="rounded-full bg-ground-alt px-2 py-0.5 text-[0.66rem] font-semibold tabular-nums text-ink-soft">
                            {carriedFundKindLabels.bank} {formatINR(carriedBank)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-right text-[0.88rem] font-bold tabular-nums text-ink">
                    {formatINR(balanceInHand)}
                  </span>
                </div>

                {expandedMode && (
                  <div className="border-t border-border bg-surface-sunken">
                    {contributorsFor(member.id, expandedMode).map((c, ci) => (
                      <div
                        key={c.key}
                        className={`flex items-center gap-3 px-3 py-2 ${ci > 0 ? "border-t border-border" : ""}`}
                      >
                        <span className="w-14 shrink-0 text-[0.7rem] font-semibold text-ink-soft">
                          {c.flatLabel}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[0.78rem] text-ink">
                          {c.name}
                        </span>
                        {c.paymentDate && (
                          <span className="shrink-0 text-[0.66rem] text-ink-faint">
                            {formatShortDate(c.paymentDate)}
                          </span>
                        )}
                        <PaymentTag mode={c.mode} amount={c.amount} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => runExport(() => exportPujaDataToExcel(store))}
          disabled={exporting}
          className="flex w-full items-center gap-2.5 rounded-2xl border border-border bg-surface p-3.5 text-[0.82rem] font-semibold text-ink shadow-[var(--shadow-card)] transition active:scale-[0.98] disabled:opacity-60"
        >
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-brand-tint text-brand">
            <DownloadIcon className="h-[15px] w-[15px]" />
          </span>
          {exporting ? "Preparing export…" : "Export to Excel"}
        </button>
        {exportError && (
          <p className="mt-1.5 px-0.5 text-[0.75rem] text-critical">{exportError}</p>
        )}
      </div>

      <MembersSheet open={managingMembers} onClose={() => setManagingMembers(false)} />
      <CarriedFundSheet
        open={managingCarriedFunds}
        onClose={() => setManagingCarriedFunds(false)}
      />
      <FundTransferSheet open={managingTransfers} onClose={() => setManagingTransfers(false)} />
    </div>
  );
}
