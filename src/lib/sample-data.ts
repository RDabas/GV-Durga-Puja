import { flat, ownerNamed } from "@/lib/directory";
import type {
  CarriedFund,
  CommitteeMember,
  Contribution,
  FundTransfer,
  PujaYear,
  Sponsor,
  Vendor,
  VendorExpense,
} from "@/lib/types";

/**
 * Placeholder data so the app is browsable before the real house directory
 * and Supabase project are connected. Shapes match the DB schema in
 * supabase/schema.sql so swapping in live queries later is a drop-in.
 */

export const years: PujaYear[] = [
  {
    id: "year-2025",
    year: 2025,
    shashthiDate: "2025-09-28",
    dashamiDate: "2025-10-02",
    status: "archived",
    collectionGoal: 550000,
  },
  {
    id: "year-2026",
    year: 2026,
    shashthiDate: "2026-10-16",
    dashamiDate: "2026-10-20",
    status: "active",
    collectionGoal: 650000,
  },
];

export const activeYear: PujaYear = years[1];

export const committeeMembers: CommitteeMember[] = [
  { id: "member-priya", authUserId: "auth-priya", name: "Priya (Treasurer)", role: "admin" },
  { id: "member-arjun", authUserId: "auth-arjun", name: "Arjun", role: "collector" },
  { id: "member-meera", authUserId: "auth-meera", name: "Meera", role: "collector" },
];

export const contributions: Contribution[] = [
  // --- 2025, kept so the app has a year of history to compare against ---
  {
    id: "contrib-2025-1",
    houseId: flat("A", "1113").id,
    yearId: "year-2025",
    collectorId: "member-arjun",
    moneyAmount: 1200,
    bhogGroceryAmount: 0,
    contributionKind: "money",
    paymentMode: "cash",
    status: "paid",
    paymentDate: "2025-09-24",
  },
  {
    id: "contrib-2025-2",
    houseId: flat("A", "112").id,
    yearId: "year-2025",
    collectorId: "member-meera",
    moneyAmount: 1100,
    bhogGroceryAmount: 0,
    contributionKind: "money",
    paymentMode: "cash",
    status: "paid",
    paymentDate: "2025-09-24",
  },
  {
    id: "contrib-2025-3",
    ownerId: ownerNamed("Sumal Vasudev").id,
    yearId: "year-2025",
    collectorId: "member-priya",
    moneyAmount: 5000,
    bhogGroceryAmount: 0,
    contributionKind: "money",
    paymentMode: "gpay",
    status: "paid",
    paymentDate: "2025-09-20",
    note: "One payment for all his flats",
  },

  // --- 2026, the year in progress ---
  {
    id: "contrib-1",
    houseId: flat("A", "1113").id,
    yearId: activeYear.id,
    collectorId: "member-arjun",
    moneyAmount: 1500,
    bhogGroceryAmount: 0,
    contributionKind: "money",
    paymentMode: "gpay",
    status: "paid",
    paymentDate: "2026-10-05",
    note: "Paid to Arjun's GPay",
  },
  {
    id: "contrib-2",
    houseId: flat("A", "112").id,
    yearId: activeYear.id,
    collectorId: "member-meera",
    moneyAmount: 1100,
    bhogGroceryAmount: 500,
    contributionKind: "both",
    paymentMode: "cash",
    status: "paid",
    paymentDate: "2026-10-06",
  },
  {
    id: "contrib-3",
    houseId: flat("A", "911").id,
    yearId: activeYear.id,
    collectorId: "member-meera",
    moneyAmount: 0,
    bhogGroceryAmount: 0,
    contributionKind: "money",
    paymentMode: "pending",
    status: "promised",
    followUpNote: "Said after the 12th",
  },
  {
    id: "contrib-4",
    houseId: flat("A", "1111").id,
    yearId: activeYear.id,
    collectorId: "member-arjun",
    moneyAmount: 500,
    bhogGroceryAmount: 0,
    contributionKind: "money",
    paymentMode: "cash",
    status: "partial",
    paymentDate: "2026-10-04",
    note: "Owes ₹600 more",
  },
  {
    id: "contrib-5",
    ownerId: ownerNamed("Sumal Vasudev").id,
    yearId: activeYear.id,
    collectorId: "member-priya",
    moneyAmount: 6000,
    bhogGroceryAmount: 0,
    contributionKind: "money",
    paymentMode: "gpay",
    status: "paid",
    paymentDate: "2026-10-03",
    note: "Covers all 5 flats he owns",
  },
  {
    id: "contrib-6",
    ownerId: ownerNamed("B R Vasudev").id,
    yearId: activeYear.id,
    collectorId: "member-arjun",
    moneyAmount: 4000,
    bhogGroceryAmount: 0,
    contributionKind: "money",
    paymentMode: "phonepe",
    status: "paid",
    paymentDate: "2026-10-07",
  },
  {
    id: "contrib-7",
    houseId: flat("A", "1114").id,
    yearId: activeYear.id,
    collectorId: "member-meera",
    moneyAmount: 900,
    bhogGroceryAmount: 0,
    contributionKind: "money",
    paymentMode: "other_upi",
    status: "paid",
    paymentDate: "2026-10-07",
    note: "Paytm UPI to Meera",
  },
];

// Money moving between committee members after collection — e.g. Arjun
// handing over the cash he collected door-to-door to the treasurer, Meera
// transferring UPI collections into the shared account. See FundTransfer.
export const fundTransfers: FundTransfer[] = [
  {
    id: "transfer-1",
    yearId: activeYear.id,
    fromMemberId: "member-arjun",
    toMemberId: "member-priya",
    amount: 500,
    mode: "cash",
    transferDate: "2026-10-04",
    note: "Handed over cash from Block A round",
  },
  {
    id: "transfer-2",
    yearId: activeYear.id,
    fromMemberId: "member-meera",
    toMemberId: "member-priya",
    amount: 1100,
    mode: "online",
    transferDate: "2026-10-06",
    note: "UPI transfer of collected cash equivalent",
  },
];

// Money members were still holding when 2026 opened — leftover cash never
// handed over, an FD from 2025's surplus, or a bank balance from last year.
export const carriedFunds: CarriedFund[] = [
  {
    id: "carry-1",
    yearId: activeYear.id,
    memberId: "member-priya",
    kind: "bank",
    amount: 18000,
    note: "2025 surplus, committee savings account",
  },
  {
    id: "carry-2",
    yearId: activeYear.id,
    memberId: "member-priya",
    kind: "fd",
    amount: 50000,
    note: "1-year FD, matures March 2027",
  },
  {
    id: "carry-3",
    yearId: activeYear.id,
    memberId: "member-arjun",
    kind: "cash",
    amount: 1200,
    note: "Never handed over after 2025 Dashami",
  },
];

export const sponsors: Sponsor[] = [
  {
    id: "sponsor-1",
    yearId: activeYear.id,
    name: "Ganguly Electronics",
    type: "outside",
    amountPledged: 75000,
    payments: [
      { id: "sp-1", sponsorId: "sponsor-1", memberId: "member-priya", amount: 50000, paymentDate: "2026-09-15", mode: "other_upi", note: "Bank UPI transfer" },
      { id: "sp-2", sponsorId: "sponsor-1", memberId: "member-priya", amount: 25000, paymentDate: "2026-10-01", mode: "gpay" },
    ],
  },
  {
    id: "sponsor-2",
    yearId: activeYear.id,
    name: "Shree Sweets",
    type: "stall",
    stallDetails: "Gate 2",
    amountPledged: 40000,
    payments: [
      { id: "sp-3", sponsorId: "sponsor-2", memberId: "member-arjun", amount: 20000, paymentDate: "2026-09-25", mode: "cash" },
      { id: "sp-4", sponsorId: "sponsor-2", memberId: "member-meera", amount: 10000, paymentDate: "2026-10-05", mode: "phonepe" },
    ],
  },
  {
    id: "sponsor-3",
    yearId: activeYear.id,
    name: "Roy family (Block D)",
    type: "no_stall",
    amountPledged: 15000,
    payments: [
      { id: "sp-5", sponsorId: "sponsor-3", memberId: "member-priya", amount: 15000, paymentDate: "2026-09-10", mode: "gpay" },
    ],
  },
];

const vendors: Vendor[] = [
  { id: "vendor-1", name: "Maa Tara Decorators", serviceType: "Pandal & lighting" },
  { id: "vendor-2", name: "Annapurna Catering", serviceType: "Bhog · all 5 days" },
  { id: "vendor-3", name: "Dhaak & Dhunuchi Troupe", serviceType: "Drummers, Ashtami" },
];

export const vendorExpenses: VendorExpense[] = [
  {
    id: "expense-1",
    vendorId: vendors[0].id,
    yearId: activeYear.id,
    totalAmount: 180000,
    vendor: vendors[0],
    payments: [
      { id: "vp-1", vendorExpenseId: "expense-1", memberId: "member-priya", amount: 80000, paymentDate: "2026-09-20", mode: "other_upi" },
      { id: "vp-2", vendorExpenseId: "expense-1", memberId: "member-priya", amount: 40000, paymentDate: "2026-10-08", mode: "gpay" },
    ],
  },
  {
    id: "expense-2",
    vendorId: vendors[1].id,
    yearId: activeYear.id,
    totalAmount: 95000,
    vendor: vendors[1],
    payments: [
      { id: "vp-3", vendorExpenseId: "expense-2", memberId: "member-priya", amount: 95000, paymentDate: "2026-10-01", mode: "phonepe" },
    ],
  },
  {
    id: "expense-3",
    vendorId: vendors[2].id,
    yearId: activeYear.id,
    totalAmount: 25000,
    vendor: vendors[2],
    payments: [],
  },
];
