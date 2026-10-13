import { paymentModeBreakdown, type PaymentBreakdownTotals } from "@/lib/payment";
import type {
  CarriedFund,
  CommitteeMember,
  Contribution,
  FundTransfer,
  VendorExpense,
} from "@/lib/types";

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
): CommitteeBalance[] {
  return members.map((member) => {
    const collectedFrom = contributions.filter(
      (c) =>
        c.collectorId === member.id && c.paymentMode !== "pending" && c.outsideCollectionId == null,
    );
    const collected = collectedFrom.reduce((sum, c) => sum + c.moneyAmount, 0);

    const outsideCollectionFrom = contributions.filter(
      (c) =>
        c.collectorId === member.id && c.paymentMode !== "pending" && c.outsideCollectionId != null,
    );
    const outsideCollectionReceived = outsideCollectionFrom.reduce(
      (sum, c) => sum + c.moneyAmount,
      0,
    );

    // A self-funded payment came out of the member's own pocket (typically
    // offsetting their own resident pledge), never out of committee cash
    // they were holding, so it shouldn't dock their balance in hand.
    const vendorPaid = vendorExpenses
      .flatMap((e) => e.payments)
      .filter((p) => p.memberId === member.id && !p.selfFunded)
      .reduce((sum, p) => sum + p.amount, 0);

    const handedOver = transfers
      .filter((t) => t.fromMemberId === member.id)
      .reduce((sum, t) => sum + t.amount, 0);
    const received = transfers
      .filter((t) => t.toMemberId === member.id)
      .reduce((sum, t) => sum + t.amount, 0);

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
      balanceInHand:
        collected +
        outsideCollectionReceived +
        received +
        carriedCash +
        carriedFd +
        carriedBank -
        handedOver -
        vendorPaid,
      collectedByMode: paymentModeBreakdown(
        [...collectedFrom, ...outsideCollectionFrom].map((c) => ({
          amount: c.moneyAmount,
          mode: c.paymentMode,
        })),
      ),
    };
  });
}
