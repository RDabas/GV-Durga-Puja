import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CarriedFund,
  CarriedFundKind,
  CommitteeMember,
  Contribution,
  ContributionKind,
  ContributionStatus,
  FundTransfer,
  House,
  Owner,
  PaymentMode,
  PujaYear,
  Sponsor,
  SponsorPayment,
  SponsorType,
  TransferMode,
  Vendor,
  VendorExpense,
  VendorPayment,
} from "@/lib/types";

/**
 * The database is the source of truth; this file is the only place that
 * knows both the snake_case row shapes from supabase/schema.sql and the
 * camelCase app types from src/lib/types.ts. Every read and write to
 * Supabase goes through here — src/lib/store.tsx never sees a raw row.
 */

// --- Row shapes (mirrors supabase/schema.sql) ------------------------------

interface YearRow {
  id: string;
  year: number;
  shashthi_date: string;
  dashami_date: string;
  status: "active" | "archived";
  collection_goal: number;
}

interface OwnerRow {
  id: string;
  names: string[];
  phone: string | null;
}

interface HouseRow {
  id: string;
  block: House["block"];
  floor: number;
  flat_no: string;
  owner_id: string | null;
  tenant_names: string[];
  tenant_phone: string | null;
}

interface MemberRow {
  id: string;
  auth_user_id: string | null;
  name: string;
  phone: string | null;
  role: CommitteeMember["role"];
}

interface ContributionRow {
  id: string;
  house_id: string | null;
  owner_id: string | null;
  year_id: string;
  collector_id: string | null;
  money_amount: number;
  bhog_grocery_amount: number;
  contribution_kind: ContributionKind;
  payment_mode: PaymentMode;
  status: ContributionStatus;
  payment_date: string | null;
  note: string | null;
  follow_up_note: string | null;
}

interface FundTransferRow {
  id: string;
  year_id: string;
  from_member_id: string | null;
  to_member_id: string | null;
  amount: number;
  mode: TransferMode;
  transfer_date: string;
  note: string | null;
}

interface CarriedFundRow {
  id: string;
  year_id: string;
  member_id: string;
  kind: CarriedFundKind;
  amount: number;
  note: string | null;
}

interface SponsorPaymentRow {
  id: string;
  sponsor_id: string;
  member_id: string;
  amount: number;
  payment_date: string;
  mode: PaymentMode;
  note: string | null;
}

interface SponsorRow {
  id: string;
  year_id: string;
  name: string;
  contact: string | null;
  type: SponsorType;
  stall_details: string | null;
  amount_pledged: number;
  notes: string | null;
  sponsor_payments: SponsorPaymentRow[];
}

interface VendorRow {
  id: string;
  name: string;
  service_type: string;
  phone: string | null;
  notes: string | null;
}

interface VendorPaymentRow {
  id: string;
  vendor_expense_id: string;
  member_id: string;
  amount: number;
  payment_date: string;
  mode: PaymentMode;
  note: string | null;
}

interface VendorExpenseRow {
  id: string;
  vendor_id: string;
  year_id: string;
  total_amount: number;
  notes: string | null;
  vendors: VendorRow;
  vendor_payments: VendorPaymentRow[];
}

// --- Row -> app type --------------------------------------------------------

const mapYear = (r: YearRow): PujaYear => ({
  id: r.id,
  year: r.year,
  shashthiDate: r.shashthi_date,
  dashamiDate: r.dashami_date,
  status: r.status,
  collectionGoal: r.collection_goal,
});

const mapOwner = (r: OwnerRow): Owner => ({
  id: r.id,
  names: r.names,
  phone: r.phone ?? undefined,
});

const mapHouse = (r: HouseRow): House => ({
  id: r.id,
  block: r.block,
  floor: r.floor,
  flatNo: r.flat_no,
  ownerId: r.owner_id ?? undefined,
  tenantNames: r.tenant_names,
  tenantPhone: r.tenant_phone ?? undefined,
});

const mapMember = (r: MemberRow): CommitteeMember => ({
  id: r.id,
  authUserId: r.auth_user_id ?? undefined,
  name: r.name,
  phone: r.phone ?? undefined,
  role: r.role,
});

const mapContribution = (r: ContributionRow): Contribution => ({
  id: r.id,
  yearId: r.year_id,
  houseId: r.house_id ?? undefined,
  ownerId: r.owner_id ?? undefined,
  collectorId: r.collector_id ?? undefined,
  moneyAmount: r.money_amount,
  bhogGroceryAmount: r.bhog_grocery_amount,
  contributionKind: r.contribution_kind,
  paymentMode: r.payment_mode,
  status: r.status,
  paymentDate: r.payment_date ?? undefined,
  note: r.note ?? undefined,
  followUpNote: r.follow_up_note ?? undefined,
});

const mapFundTransfer = (r: FundTransferRow): FundTransfer => ({
  id: r.id,
  yearId: r.year_id,
  fromMemberId: r.from_member_id ?? undefined,
  toMemberId: r.to_member_id ?? undefined,
  amount: r.amount,
  mode: r.mode,
  transferDate: r.transfer_date,
  note: r.note ?? undefined,
});

const mapCarriedFund = (r: CarriedFundRow): CarriedFund => ({
  id: r.id,
  yearId: r.year_id,
  memberId: r.member_id,
  kind: r.kind,
  amount: r.amount,
  note: r.note ?? undefined,
});

const mapSponsorPayment = (r: SponsorPaymentRow): SponsorPayment => ({
  id: r.id,
  sponsorId: r.sponsor_id,
  memberId: r.member_id,
  amount: r.amount,
  paymentDate: r.payment_date,
  mode: r.mode,
  note: r.note ?? undefined,
});

const mapSponsor = (r: SponsorRow): Sponsor => ({
  id: r.id,
  yearId: r.year_id,
  name: r.name,
  contact: r.contact ?? undefined,
  type: r.type,
  stallDetails: r.stall_details ?? undefined,
  amountPledged: r.amount_pledged,
  notes: r.notes ?? undefined,
  payments: (r.sponsor_payments ?? []).map(mapSponsorPayment),
});

const mapVendor = (r: VendorRow): Vendor => ({
  id: r.id,
  name: r.name,
  serviceType: r.service_type,
  phone: r.phone ?? undefined,
  notes: r.notes ?? undefined,
});

const mapVendorPayment = (r: VendorPaymentRow): VendorPayment => ({
  id: r.id,
  vendorExpenseId: r.vendor_expense_id,
  memberId: r.member_id,
  amount: r.amount,
  paymentDate: r.payment_date,
  mode: r.mode,
  note: r.note ?? undefined,
});

const mapVendorExpense = (r: VendorExpenseRow): VendorExpense => ({
  id: r.id,
  vendorId: r.vendor_id,
  yearId: r.year_id,
  totalAmount: r.total_amount,
  notes: r.notes ?? undefined,
  vendor: mapVendor(r.vendors),
  payments: (r.vendor_payments ?? []).map(mapVendorPayment),
});

// --- Fetch everything --------------------------------------------------------

export interface LiveData {
  years: PujaYear[];
  owners: Owner[];
  houses: House[];
  members: CommitteeMember[];
  contributions: Contribution[];
  fundTransfers: FundTransfer[];
  carriedFunds: CarriedFund[];
  sponsors: Sponsor[];
  vendorExpenses: VendorExpense[];
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data as T;
}

/**
 * All years' data is fetched at once (this is a small committee dataset —
 * dozens to low hundreds of rows even across several years) so switching
 * which year you're viewing, and comparing to last year, needs no round trip.
 */
export async function fetchAll(supabase: SupabaseClient): Promise<LiveData> {
  const [years, owners, houses, members, contributions, fundTransfers, carriedFunds, sponsors, vendorExpenses] =
    await Promise.all([
      supabase.from("puja_years").select("*").order("year", { ascending: true }),
      supabase.from("owners").select("*"),
      supabase.from("houses").select("*"),
      supabase.from("committee_members").select("*").order("name", { ascending: true }),
      supabase.from("contributions").select("*"),
      supabase.from("fund_transfers").select("*"),
      supabase.from("carried_funds").select("*"),
      supabase.from("sponsors").select("*, sponsor_payments(*)"),
      supabase.from("vendor_expenses").select("*, vendors(*), vendor_payments(*)"),
    ]);

  return {
    years: unwrap<YearRow[]>(years, "years").map(mapYear),
    owners: unwrap<OwnerRow[]>(owners, "owners").map(mapOwner),
    houses: unwrap<HouseRow[]>(houses, "houses").map(mapHouse),
    members: unwrap<MemberRow[]>(members, "members").map(mapMember),
    contributions: unwrap<ContributionRow[]>(contributions, "contributions").map(mapContribution),
    fundTransfers: unwrap<FundTransferRow[]>(fundTransfers, "fundTransfers").map(mapFundTransfer),
    carriedFunds: unwrap<CarriedFundRow[]>(carriedFunds, "carriedFunds").map(mapCarriedFund),
    sponsors: unwrap<SponsorRow[]>(sponsors, "sponsors").map(mapSponsor),
    vendorExpenses: unwrap<VendorExpenseRow[]>(vendorExpenses, "vendorExpenses").map(mapVendorExpense),
  };
}

// --- Mutations ---------------------------------------------------------------
// Each takes the Supabase client plus app-shaped input and writes snake_case
// rows. None of these touch local state — src/lib/store.tsx re-fetches (or
// patches) after a call resolves.

export async function dbSaveTenants(
  supabase: SupabaseClient,
  houseId: string,
  names: string[],
  phone?: string,
): Promise<void> {
  const { error } = await supabase
    .from("houses")
    .update({ tenant_names: names, tenant_phone: phone ?? null })
    .eq("id", houseId);
  if (error) throw new Error(error.message);
}

/** Renames an owner in place, or creates one and attaches it to the flat. Returns the owner id. */
export async function dbSaveOwner(
  supabase: SupabaseClient,
  houseId: string,
  existingOwnerId: string | undefined,
  names: string[],
  phone?: string,
): Promise<string> {
  if (existingOwnerId) {
    const { error } = await supabase
      .from("owners")
      .update({ names, phone: phone ?? null })
      .eq("id", existingOwnerId);
    if (error) throw new Error(error.message);
    return existingOwnerId;
  }

  const inserted = await supabase
    .from("owners")
    .insert({ names, phone: phone ?? null })
    .select()
    .single();
  const owner = unwrap<OwnerRow>(inserted, "insert owner");

  const { error } = await supabase.from("houses").update({ owner_id: owner.id }).eq("id", houseId);
  if (error) throw new Error(error.message);
  return owner.id;
}

export async function dbAddMember(
  supabase: SupabaseClient,
  input: { name: string; phone?: string; role: CommitteeMember["role"] },
): Promise<void> {
  const { error } = await supabase
    .from("committee_members")
    .insert({ name: input.name, phone: input.phone ?? null, role: input.role });
  if (error) throw new Error(error.message);
}

export async function dbUpdateMember(
  supabase: SupabaseClient,
  memberId: string,
  input: { name: string; phone?: string; role: CommitteeMember["role"] },
): Promise<void> {
  const { error } = await supabase
    .from("committee_members")
    .update({ name: input.name, phone: input.phone ?? null, role: input.role })
    .eq("id", memberId);
  if (error) throw new Error(error.message);
}

/** The DB's own foreign keys reject this if the member is still referenced anywhere. */
export async function dbRemoveMember(supabase: SupabaseClient, memberId: string): Promise<void> {
  const { error } = await supabase.from("committee_members").delete().eq("id", memberId);
  if (error) throw new Error(error.message);
}

export async function dbAddCarriedFund(
  supabase: SupabaseClient,
  yearId: string,
  input: { memberId: string; kind: CarriedFundKind; amount: number; note?: string },
): Promise<void> {
  const { error } = await supabase.from("carried_funds").insert({
    year_id: yearId,
    member_id: input.memberId,
    kind: input.kind,
    amount: input.amount,
    note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function dbRemoveCarriedFund(supabase: SupabaseClient, fundId: string): Promise<void> {
  const { error } = await supabase.from("carried_funds").delete().eq("id", fundId);
  if (error) throw new Error(error.message);
}

interface ContributionWrite {
  collectorId?: string;
  moneyAmount: number;
  bhogGroceryAmount: number;
  contributionKind: ContributionKind;
  paymentMode: PaymentMode;
  status: ContributionStatus;
  paymentDate?: string;
  note?: string;
  followUpNote?: string;
}

export async function dbSaveContribution(
  supabase: SupabaseClient,
  yearId: string,
  payer: { houseId: string } | { ownerId: string },
  existingId: string | undefined,
  input: ContributionWrite,
): Promise<void> {
  const row = {
    year_id: yearId,
    house_id: "houseId" in payer ? payer.houseId : null,
    owner_id: "ownerId" in payer ? payer.ownerId : null,
    collector_id: input.collectorId ?? null,
    money_amount: input.moneyAmount,
    bhog_grocery_amount: input.bhogGroceryAmount,
    contribution_kind: input.contributionKind,
    payment_mode: input.paymentMode,
    status: input.status,
    payment_date: input.paymentDate ?? null,
    note: input.note ?? null,
    follow_up_note: input.followUpNote ?? null,
  };

  const { error } = existingId
    ? await supabase.from("contributions").update(row).eq("id", existingId)
    : await supabase.from("contributions").insert(row);
  if (error) throw new Error(error.message);
}

export async function dbAddSponsor(
  supabase: SupabaseClient,
  yearId: string,
  input: {
    name: string;
    type: SponsorType;
    stallDetails?: string;
    contact?: string;
    amountPledged: number;
    notes?: string;
  },
): Promise<void> {
  const { error } = await supabase.from("sponsors").insert({
    year_id: yearId,
    name: input.name,
    type: input.type,
    stall_details: input.stallDetails ?? null,
    contact: input.contact ?? null,
    amount_pledged: input.amountPledged,
    notes: input.notes ?? null,
  });
  if (error) throw new Error(error.message);
}

interface PaymentWrite {
  memberId: string;
  amount: number;
  paymentDate: string;
  mode: PaymentMode;
  note?: string;
}

export async function dbAddSponsorPayment(
  supabase: SupabaseClient,
  sponsorId: string,
  input: PaymentWrite,
): Promise<void> {
  const { error } = await supabase.from("sponsor_payments").insert({
    sponsor_id: sponsorId,
    member_id: input.memberId,
    amount: input.amount,
    payment_date: input.paymentDate,
    mode: input.mode,
    note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function dbAddVendorExpense(
  supabase: SupabaseClient,
  yearId: string,
  input: { vendorName: string; serviceType: string; phone?: string; totalAmount: number; notes?: string },
): Promise<void> {
  const insertedVendor = await supabase
    .from("vendors")
    .insert({ name: input.vendorName, service_type: input.serviceType, phone: input.phone ?? null })
    .select()
    .single();
  const vendor = unwrap<VendorRow>(insertedVendor, "insert vendor");

  const { error } = await supabase.from("vendor_expenses").insert({
    vendor_id: vendor.id,
    year_id: yearId,
    total_amount: input.totalAmount,
    notes: input.notes ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function dbAddVendorPayment(
  supabase: SupabaseClient,
  expenseId: string,
  input: PaymentWrite,
): Promise<void> {
  const { error } = await supabase.from("vendor_payments").insert({
    vendor_expense_id: expenseId,
    member_id: input.memberId,
    amount: input.amount,
    payment_date: input.paymentDate,
    mode: input.mode,
    note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
}

/** Archives whatever year was active and starts a new one. Returns the new year's id. */
export async function dbStartYear(
  supabase: SupabaseClient,
  input: { year: number; shashthiDate: string; dashamiDate: string; collectionGoal: number },
): Promise<string> {
  const archived = await supabase
    .from("puja_years")
    .update({ status: "archived" })
    .eq("status", "active");
  if (archived.error) throw new Error(archived.error.message);

  const inserted = await supabase
    .from("puja_years")
    .insert({
      year: input.year,
      shashthi_date: input.shashthiDate,
      dashami_date: input.dashamiDate,
      collection_goal: input.collectionGoal,
      status: "active",
    })
    .select()
    .single();
  return unwrap<YearRow>(inserted, "insert year").id;
}

export async function dbUpdateYear(
  supabase: SupabaseClient,
  yearId: string,
  patch: { collectionGoal?: number; shashthiDate?: string; dashamiDate?: string },
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.collectionGoal !== undefined) row.collection_goal = patch.collectionGoal;
  if (patch.shashthiDate !== undefined) row.shashthi_date = patch.shashthiDate;
  if (patch.dashamiDate !== undefined) row.dashami_date = patch.dashamiDate;

  const { error } = await supabase.from("puja_years").update(row).eq("id", yearId);
  if (error) throw new Error(error.message);
}
