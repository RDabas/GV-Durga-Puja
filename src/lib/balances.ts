import { paymentModeBreakdown, type PaymentBreakdownTotals } from "@/lib/payment";
import type {
  CarriedFund,
  CommitteeMember,
  Contribution,
  ContributionPayment,
  FundTransfer,
  VendorExpense,
} from "@/lib/types";

/**
 * A contribution's own moneyAmount only ever tracks its primary payment —
 * add any split/vendor-settled installments (contribution_payments) for the
 * real total actually received. Safe to call for any status: "promised"
 * never has installments (a payment moves it off "promised" the moment one
 * comes in), so this is a no-op addition for anything that isn't actually
 * paid/partial.
 */
export function totalReceivedFor(
  contribution: Contribution | undefined,
  contributionPayments: ContributionPayment[],
): number {
  if (!contribution) return 0;
  const extras = contributionPayments
    .filter((p) => p.contributionId === contribution.id)
    .reduce((sum, p) => sum + p.amount, 0);
  return contribution.moneyAmount + extras;
}

export interface CommitteeBalance {
  member: CommitteeMember;
  collected: number;
  outsideCollectionReceived: number;
  handedOver: number;
  received: number;
  vendorPaid: number;
  carriedCash: number;
  carriedFd: number;
  carriedBank: number;
  balanceInHand: number;
  collectedByMode: PaymentBreakdownTotals;
  receivedByMode: PaymentBreakdownTotals;
  handedOverByMode: PaymentBreakdownTotals;
  vendorPaidByMode: PaymentBreakdownTotals;
  /** Physical cash currently in hand: cash collected/received/carried, minus cash handed over or paid out. */
  cashBalance: number;
  /** Digital balance currently in hand (UPI collected/received, plus any carried bank balance), minus UPI handed over or paid out. */
  upiBalance: number;
}

/**
 * How much cash/UPI each committee member is currently holding for the year:
 * what they collected door-to-door and from outside collection, plus what
 * other members transferred to them and whatever they were still holding
 * from a previous year, minus what they've since handed over or paid out to
 * a vendor themselves. collectedByMode splits collected + outside-collection
 * money together by how it actually came in (Cash/UPI) — just one Cash chip
 * and one UPI chip, not duplicated per source, per Rahul's explicit request
 * (door-to-door and outside-collection money sit in the same cash box/UPI
 * app once received, so there's no real reason to show them separately).
 */
export function committeeBalances(
  members: CommitteeMember[],
  contributions: Contribution[],
  transfers: FundTransfer[],
  vendorExpenses: VendorExpense[],
  carriedFunds: CarriedFund[] = [],
  contributionPayments: ContributionPayment[] = [],
): CommitteeBalance[] {
  const contributionById = new Map(contributions.map((c) => [c.id, c]));

  return members.map((member) => {
    const collectedFrom = contributions.filter(
      (c) =>
        c.collectorId === member.id && c.paymentMode !== "pending" && c.outsideCollectionId == null,
    );
    // Extra installments (split across a second collector, or a resident
    // settling part of their pledge by paying a vendor directly — those
    // have no collectorId at all, so they never attribute here) collected
    // by this member, split the same way by whether their parent pledge is
    // a house/owner/ex-resident or an outside-collection entry.
    const extraCollectedFrom = contributionPayments.filter((p) => {
      if (p.collectorId !== member.id) return false;
      return contributionById.get(p.contributionId)?.outsideCollectionId == null;
    });
    const collected =
      collectedFrom.reduce((sum, c) => sum + c.moneyAmount, 0) +
      extraCollectedFrom.reduce((sum, p) => sum + p.amount, 0);

    const outsideCollectionFrom = contributions.filter(
      (c) =>
        c.collectorId === member.id && c.paymentMode !== "pending" && c.outsideCollectionId != null,
    );
    const extraOutsideCollectionFrom = contributionPayments.filter((p) => {
      if (p.collectorId !== member.id) return false;
      return contributionById.get(p.contributionId)?.outsideCollectionId != null;
    });
    const outsideCollectionReceived =
      outsideCollectionFrom.reduce((sum, c) => sum + c.moneyAmount, 0) +
      extraOutsideCollectionFrom.reduce((sum, p) => sum + p.amount, 0);

    // A self-funded payment came out of the member's own pocket (typically
    // offsetting their own resident pledge), never out of committee cash
    // they were holding, so it shouldn't dock their balance in hand.
    const vendorPaymentsFrom = vendorExpenses
      .flatMap((e) => e.payments)
      .filter((p) => p.memberId === member.id && !p.selfFunded);
    const vendorPaid = vendorPaymentsFrom.reduce((sum, p) => sum + p.amount, 0);

    const handedOverFrom = transfers.filter((t) => t.fromMemberId === member.id);
    const handedOver = handedOverFrom.reduce((sum, t) => sum + t.amount, 0);
    const receivedFrom = transfers.filter((t) => t.toMemberId === member.id);
    const received = receivedFrom.reduce((sum, t) => sum + t.amount, 0);

    const ownCarried = carriedFunds.filter((f) => f.memberId === member.id);
    const carriedCash = ownCarried
      .filter((f) => f.kind === "cash")
      .reduce((sum, f) => sum + f.amount, 0);
    const carriedFd = ownCarried
      .filter((f) => f.kind === "fd")
      .reduce((sum, f) => sum + f.amount, 0);
    const carriedBank = ownCarried
      .filter((f) => f.kind === "bank")
      .reduce((sum, f) => sum + f.amount, 0);

    const collectedByMode = paymentModeBreakdown([
      ...[...collectedFrom, ...outsideCollectionFrom].map((c) => ({
        amount: c.moneyAmount,
        mode: c.paymentMode,
      })),
      ...[...extraCollectedFrom, ...extraOutsideCollectionFrom].map((p) => ({
        amount: p.amount,
        mode: p.mode,
      })),
    ]);
    const receivedByMode = paymentModeBreakdown(
      receivedFrom.map((t) => ({ amount: t.amount, mode: t.mode })),
    );
    const handedOverByMode = paymentModeBreakdown(
      handedOverFrom.map((t) => ({ amount: t.amount, mode: t.mode })),
    );
    const vendorPaidByMode = paymentModeBreakdown(
      vendorPaymentsFrom.map((p) => ({ amount: p.amount, mode: p.mode })),
    );

    // A carried bank balance isn't physical cash, so it joins the digital
    // (UPI) side of the split rather than the cash side; a carried FD is
    // neither — it's an illiquid asset, kept out of both and only folded
    // into the overall balanceInHand total below.
    const cashBalance =
      (collectedByMode.cash ?? 0) +
      (receivedByMode.cash ?? 0) +
      carriedCash -
      (handedOverByMode.cash ?? 0) -
      (vendorPaidByMode.cash ?? 0);
    const upiBalance =
      (collectedByMode.upi ?? 0) +
      (receivedByMode.upi ?? 0) +
      carriedBank -
      (handedOverByMode.upi ?? 0) -
      (vendorPaidByMode.upi ?? 0);

    return {
      member,
      collected,
      outsideCollectionReceived,
      handedOver,
      received,
      vendorPaid,
      carriedCash,
      carriedFd,
      carriedBank,
      balanceInHand: cashBalance + upiBalance + carriedFd,
      collectedByMode,
      receivedByMode,
      handedOverByMode,
      vendorPaidByMode,
      cashBalance,
      upiBalance,
    };
  });
}
