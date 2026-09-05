import { paymentModeBreakdown, type PaymentBreakdownTotals } from "@/lib/payment";
import type {
  CarriedFund,
  CommitteeMember,
  Contribution,
  FundTransfer,
  Sponsor,
  VendorExpense,
} from "@/lib/types";

export interface CommitteeBalance {
  member: CommitteeMember;
  collected: number;
  sponsorReceived: number;
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
 * what they collected door-to-door and from sponsors, plus what other members
 * transferred to them and whatever they were still holding from a previous
 * year, minus what they've since handed over or paid out to a vendor
 * themselves. collectedByMode splits the door-to-door figure by how residents
 * actually paid, so a member can be asked for the cash in their box
 * separately from what sits in their UPI apps.
 */
export function committeeBalances(
  members: CommitteeMember[],
  contributions: Contribution[],
  transfers: FundTransfer[],
  sponsors: Sponsor[],
  vendorExpenses: VendorExpense[],
  carriedFunds: CarriedFund[] = [],
): CommitteeBalance[] {
  return members.map((member) => {
    const collectedFrom = contributions.filter(
      (c) => c.collectorId === member.id && c.paymentMode !== "pending",
    );
    const collected = collectedFrom.reduce((sum, c) => sum + c.moneyAmount, 0);

    const sponsorReceived = sponsors
      .flatMap((s) => s.payments)
      .filter((p) => p.memberId === member.id)
      .reduce((sum, p) => sum + p.amount, 0);

    const vendorPaid = vendorExpenses
      .flatMap((e) => e.payments)
      .filter((p) => p.memberId === member.id)
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
      sponsorReceived,
      handedOver,
      received,
      vendorPaid,
      carriedCash,
      carriedFd,
      carriedBank,
      balanceInHand:
        collected +
        sponsorReceived +
        received +
        carriedCash +
        carriedFd +
        carriedBank -
        handedOver -
        vendorPaid,
      collectedByMode: paymentModeBreakdown(
        collectedFrom.map((c) => ({ amount: c.moneyAmount, mode: c.paymentMode })),
      ),
    };
  });
}
