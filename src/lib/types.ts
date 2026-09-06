export type Block = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type PaymentMode = "cash" | "gpay" | "phonepe" | "other_upi" | "pending";

export type ContributionStatus =
  | "paid"
  | "partial"
  | "promised"
  | "not_visited"
  | "not_home";

export type ContributionKind = "money" | "bhog_grocery" | "both";

export type SponsorType = "outside" | "stall" | "no_stall";

export type VendorPaymentStatus = "paid_full" | "installment" | "not_paid";

export type TransferMode = "cash" | "online";

export interface PujaYear {
  id: string;
  year: number;
  shashthiDate: string;
  dashamiDate: string;
  status: "active" | "archived";
}

/**
 * An owner may hold several flats. They contribute once for all of them —
 * the payment is against the owner, not any single flat — which is why
 * owners are their own entity rather than a field on House.
 */
export interface Owner {
  id: string;
  names: string[];
  phone?: string;
}

/** A flat in the society directory. */
export interface House {
  id: string;
  block: Block;
  floor: number;
  flatNo: string;
  ownerId?: string;
  /** Empty when the owner lives there. Tenants always pay per flat. */
  tenantNames: string[];
  tenantPhone?: string;
}

/**
 * Exactly one of houseId / ownerId is set. A tenant pays for their own flat;
 * an owner pays once for every flat they hold, so that entry hangs off the
 * owner instead of being duplicated across their flats.
 */
export interface Contribution {
  id: string;
  yearId: string;
  houseId?: string;
  ownerId?: string;
  collectorId?: string;
  /** Who should go back for a "nobody home"/"not visited" flat — separate from collectorId. */
  assignedToMemberId?: string;
  moneyAmount: number;
  bhogGroceryAmount: number;
  contributionKind: ContributionKind;
  paymentMode: PaymentMode;
  status: ContributionStatus;
  paymentDate?: string;
  note?: string;
  followUpNote?: string;
}

export interface Sponsor {
  id: string;
  yearId: string;
  name: string;
  contact?: string;
  type: SponsorType;
  stallDetails?: string;
  amountPledged: number;
  notes?: string;
  payments: SponsorPayment[];
}

export interface SponsorPayment {
  id: string;
  sponsorId: string;
  /** Which committee member physically took this money — it adds to their balance in hand. */
  memberId: string;
  amount: number;
  paymentDate: string;
  mode: PaymentMode;
  note?: string;
}

export interface Vendor {
  id: string;
  name: string;
  serviceType: string;
  phone?: string;
  notes?: string;
}

export interface VendorPayment {
  id: string;
  vendorExpenseId: string;
  /** Which committee member handed this over — it comes out of their balance in hand. */
  memberId: string;
  amount: number;
  paymentDate: string;
  mode: PaymentMode;
  note?: string;
}

export interface VendorExpense {
  id: string;
  vendorId: string;
  yearId: string;
  totalAmount: number;
  notes?: string;
  vendor: Vendor;
  payments: VendorPayment[];
}

export interface CommitteeMember {
  id: string;
  /** Linked when the member first signs in — they are added by name before that. */
  authUserId?: string;
  name: string;
  phone?: string;
  role: "admin" | "collector";
}

/**
 * A resident always pays a specific committee member (that member's cash box
 * or personal UPI) — Contribution.collectorId already records who first
 * received it. A FundTransfer records what happens afterward: members handing
 * cash to each other or transferring UPI to consolidate funds. Either party
 * can be omitted to represent money entering/leaving the committee entirely
 * (e.g. a final bank deposit), but not both.
 */
export interface FundTransfer {
  id: string;
  yearId: string;
  fromMemberId?: string;
  toMemberId?: string;
  amount: number;
  mode: TransferMode;
  transferDate: string;
  note?: string;
}

export type CarriedFundKind = "cash" | "fd" | "bank";

/**
 * Money a committee member is still holding from before this year started —
 * cash never handed over, a bank FD, or a balance sitting in an account.
 * Recorded against the year it opens into, so it adds to that member's
 * balance in hand without being confused for something collected this year.
 */
export interface CarriedFund {
  id: string;
  yearId: string;
  memberId: string;
  kind: CarriedFundKind;
  amount: number;
  note?: string;
}
