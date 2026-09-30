export type Block = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type PaymentMode = "cash" | "upi" | "pending";

export type ContributionStatus =
  | "paid"
  | "partial"
  | "promised"
  | "pending"
  | "not_visited"
  | "not_home"
  | "wont_pay";

export type ContributionKind = "money" | "bhog_grocery" | "both";

export type OutsideCollectionType =
  | "outsider"
  | "donation"
  | "donation_box"
  | "stall"
  | "dandiya_collection"
  | "promotion";

export type VendorPaymentStatus = "paid_full" | "installment" | "not_paid";

export type TransferMode = "cash" | "upi";

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
  /** Which of their flats their contribution/block attribution is shown against — see store.tsx's ownerPrimaryHouse. */
  primaryHouseId?: string;
  /** Excluded from this year's money totals and follow-up lists, but kept on record — see FlatCard's disable/enable owner action. */
  disabled: boolean;
}

/**
 * A voluntary contributor not tied to any flat or block — e.g. someone who
 * used to be a resident, moved out, and isn't a current owner or tenant of
 * any flat, but keeps contributing each year regardless.
 */
export interface ExResident {
  id: string;
  names: string[];
  phone?: string;
  /** Excluded from this year's money totals and follow-up lists, but kept on record — see the Disable/Enable toggle, shared with Owner. */
  disabled: boolean;
}

/**
 * A voluntary contributor from outside the society — a stall, a donation, a
 * one-off outsider gift, etc. — not tied to any flat or block, tracked the
 * same status-driven way as a resident (one status, one amount per year).
 */
export interface OutsideCollection {
  id: string;
  name: string;
  type: OutsideCollectionType;
  /** Only meaningful for type "stall" — where the stall was set up. */
  stallDetails?: string;
  /** Excluded from this year's money totals, but kept on record — see the Disable/Enable toggle, shared with Owner/ExResident. */
  disabled: boolean;
}

/** A flat in the society directory. */
export interface House {
  id: string;
  block: Block;
  floor: number;
  flatNo: string;
  ownerId?: string;
  /**
   * Set when this flat's owner is actually the same person as another
   * flat's owner but was entered as a separate Owner record (so the
   * automatic multi-flat detection can't tell) — redirects this flat's
   * owner accounting to the linked house: no independent money/follow-up
   * entry here, and it counts as visited once the linked flat is.
   */
  paidViaHouseId?: string;
  /** Empty when the owner lives there. Tenants always pay per flat. */
  tenantNames: string[];
  tenantPhone?: string;
}

/**
 * Exactly one of houseId / ownerId / exResidentId / outsideCollectionId is
 * set. A tenant pays for their own flat; an owner pays once for every flat
 * they hold, so that entry hangs off the owner instead of being duplicated
 * across their flats; an ex-resident or outside-collection entry isn't tied
 * to any flat at all.
 */
export interface Contribution {
  id: string;
  yearId: string;
  houseId?: string;
  ownerId?: string;
  exResidentId?: string;
  outsideCollectionId?: string;
  collectorId?: string;
  /**
   * Who should go back for a "nobody home"/"not visited" flat — separate
   * from collectorId. assignedToName covers someone not in the committee
   * (a family member, a guard); at most one of the two is set at a time.
   */
  assignedToMemberId?: string;
  assignedToName?: string;
  moneyAmount: number;
  /**
   * Set only when a "promised" moneyAmount has been reduced from a larger
   * original pledge (e.g. part of it was settled by paying a vendor bill
   * directly) — lets the UI show "X of Y pledged" instead of just X.
   */
  originalPledgeAmount?: number;
  bhogGroceryAmount: number;
  contributionKind: ContributionKind;
  paymentMode: PaymentMode;
  status: ContributionStatus;
  paymentDate?: string;
  note?: string;
  followUpNote?: string;
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
  /** Which committee member handed this over — it comes out of their balance in hand, unless selfFunded. */
  memberId: string;
  amount: number;
  paymentDate: string;
  mode: PaymentMode;
  note?: string;
  /** Paid from the member's own pocket (e.g. offsetting their own resident pledge), not committee cash. */
  selfFunded: boolean;
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

/** One row per business mutation made through the app — who did what, in plain language. */
export interface ActivityEntry {
  id: string;
  actorName: string;
  action: string;
  summary: string;
  createdAt: string;
}
