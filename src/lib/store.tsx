"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { pillLabels } from "@/components/Pill";
import { formatINR, formatShortDate } from "@/lib/format";
import { paymentModeLabels } from "@/lib/payment";
import { createClient } from "@/lib/supabase/client";
import {
  dbAddCarriedFund,
  dbAddContributionPayment,
  dbAddFundTransfer,
  dbAddMember,
  dbAddVendorExpense,
  dbAddVendorPayment,
  dbDeleteOutsideCollection,
  dbDeleteVendorExpense,
  dbDeleteVendorPayment,
  dbLogActivity,
  dbRemoveCarriedFund,
  dbRemoveContributionPayment,
  dbRemoveFundTransfer,
  dbRemoveMember,
  dbSaveContribution,
  dbSaveExResident,
  dbSaveOutsideCollection,
  dbSaveOwner,
  dbSaveTenants,
  dbSetExResidentDisabled,
  dbSetOutsideCollectionDisabled,
  dbSetOwnerDisabled,
  dbSetPaidViaHouse,
  dbSetTenantDisabled,
  dbStartYear,
  dbUpdateContributionPaymentByVendorPayment,
  dbUpdateMember,
  dbUpdateVendorExpense,
  dbUpdateVendorPayment,
  dbUpdateYear,
  fetchAllWithRetry,
  type ContributionPaymentWrite,
  type LiveData,
} from "@/lib/supabase/queries";
import type {
  CarriedFundKind,
  CommitteeMember,
  Contribution,
  House,
  OutsideCollectionType,
  Owner,
  PaymentMode,
  PujaYear,
  TransferMode,
} from "@/lib/types";

/**
 * Everything the committee edits lives in Supabase (see supabase/schema.sql).
 * This provider fetches all of it once, keeps it in React state, and every
 * mutator writes through src/lib/supabase/queries.ts then reloads — simple
 * over clever, since this app's write volume is a handful of taps per
 * collector per day, not a place that needs optimistic-update complexity.
 *
 * Year-scoped collections are fetched whole (across every year) and filtered
 * on read, so switching which year you're viewing needs no round trip.
 */

/** A tenant entry belongs to a flat; an owner entry belongs to the owner; an ex-resident or outside-collection entry isn't tied to a flat at all. */
export type PayerRef =
  | { houseId: string }
  | { ownerId: string }
  | { exResidentId: string }
  | { outsideCollectionId: string };

export type ContributionInput = Omit<
  Contribution,
  "id" | "yearId" | "houseId" | "ownerId"
>;

export interface PaymentInput {
  /** Unset when a resident paid the vendor directly — see contributionId. */
  memberId?: string;
  amount: number;
  paymentDate: string;
  mode: PaymentMode;
  note?: string;
  /** Vendor payments only — paid from the member's own pocket, so it shouldn't reduce their balance in hand. */
  selfFunded?: boolean;
  /** Vendor payments only, instead of memberId — a resident paid the vendor directly, settling this pledge. */
  contributionId?: string;
}

export interface ContributionPaymentInput {
  amount: number;
  mode: PaymentMode;
  paymentDate: string;
  collectorId?: string;
  note?: string;
}

export interface VendorExpenseInput {
  vendorName: string;
  serviceType: string;
  totalAmount: number;
  notes?: string;
}

export interface YearInput {
  year: number;
  shashthiDate: string;
  dashamiDate: string;
}

export interface MemberInput {
  name: string;
  phone?: string;
  role: CommitteeMember["role"];
}

export interface CarriedFundInput {
  memberId: string;
  kind: CarriedFundKind;
  amount: number;
  note?: string;
}

export interface FundTransferInput {
  fromMemberId?: string;
  toMemberId?: string;
  amount: number;
  mode: TransferMode;
  transferDate: string;
  note?: string;
}

/**
 * One prior-year payment against a flat/owner. Usually there's exactly one,
 * but a flat can have several across the year (e.g. an outgoing and an
 * incoming tenant both paid) — see previousYearInfo, keyed by house/owner id
 * to an array of these rather than a single value, so they show as separate
 * lines instead of being summed into one misleading total.
 */
export interface PreviousYearInfo {
  amount: number;
  /** Who actually paid, when recorded — e.g. from an imported prior year's sheet, since the current owner/tenant on file may have changed since then. */
  payerName?: string;
}

/**
 * Schema enforces exactly one contribution row per house/owner per year (see
 * contributions_tenant_per_year / contributions_owner_per_year), so a flat
 * with several payers in one year (e.g. an outgoing and incoming tenant)
 * can't be split across multiple rows. Their breakdown is instead encoded as
 * JSON in that single row's note — `[{"amount":10000,"name":"..."}, ...]` —
 * and expanded back into separate lines here. A plain free-text note (the
 * normal case) just falls through to a single entry using the row's total.
 */
function isBreakdownEntry(p: unknown): p is { amount: number; name?: string } {
  return typeof p === "object" && p !== null && typeof (p as { amount: unknown }).amount === "number";
}

function previousYearEntries(c: Contribution): PreviousYearInfo[] {
  if (c.note) {
    try {
      const parsed: unknown = JSON.parse(c.note);
      if (Array.isArray(parsed) && parsed.every(isBreakdownEntry)) {
        return parsed.map((p) => ({ amount: p.amount, payerName: p.name }));
      }
    } catch {
      // Not a structured breakdown — an ordinary note, fall through below.
    }
  }
  return [{ amount: c.moneyAmount, payerName: c.note }];
}

function matchesPayer(c: Contribution, payer: PayerRef): boolean {
  if ("houseId" in payer) return c.houseId === payer.houseId;
  if ("ownerId" in payer) return c.ownerId === payer.ownerId;
  if ("exResidentId" in payer) return c.exResidentId === payer.exResidentId;
  return c.outsideCollectionId === payer.outsideCollectionId;
}

function memberIsReferenced(data: LiveData, memberId: string): boolean {
  return (
    data.contributions.some((c) => c.collectorId === memberId) ||
    data.contributionPayments.some((p) => p.collectorId === memberId) ||
    data.fundTransfers.some(
      (t) => t.fromMemberId === memberId || t.toMemberId === memberId,
    ) ||
    data.carriedFunds.some((f) => f.memberId === memberId) ||
    data.vendorExpenses.some((e) => e.payments.some((p) => p.memberId === memberId))
  );
}

/** Given an existing contribution, the PayerRef that originally created it — the inverse of matchesPayer. */
function payerRefFor(c: Contribution): PayerRef {
  if (c.houseId) return { houseId: c.houseId };
  if (c.ownerId) return { ownerId: c.ownerId };
  if (c.exResidentId) return { exResidentId: c.exResidentId };
  return { outsideCollectionId: c.outsideCollectionId! };
}

/** A human-readable "who this is" for an activity-log summary — a flat label, an owner/ex-resident's name(s), or an outside-collection entry's name. */
function payerLabel(data: LiveData, payer: PayerRef): string {
  if ("houseId" in payer) {
    const h = data.houses.find((x) => x.id === payer.houseId);
    return h ? `${h.block}-${h.flatNo}` : "a flat";
  }
  if ("ownerId" in payer) {
    return data.owners.find((o) => o.id === payer.ownerId)?.names.join(", ") ?? "an owner";
  }
  if ("exResidentId" in payer) {
    return (
      data.exResidents.find((r) => r.id === payer.exResidentId)?.names.join(", ") ?? "an ex-resident"
    );
  }
  return (
    data.outsideCollections.find((r) => r.id === payer.outsideCollectionId)?.name ??
    "an outside collection entry"
  );
}

/** The existing fields of a contribution, reshaped as a ContributionInput so a patch to just one or two fields can still pass the rest through unchanged. */
function contributionPatchFrom(c: Contribution): ContributionInput {
  return {
    exResidentId: c.exResidentId,
    outsideCollectionId: c.outsideCollectionId,
    collectorId: c.collectorId,
    assignedToMemberId: c.assignedToMemberId,
    assignedToName: c.assignedToName,
    moneyAmount: c.moneyAmount,
    originalPledgeAmount: c.originalPledgeAmount,
    bhogGroceryAmount: c.bhogGroceryAmount,
    contributionKind: c.contributionKind,
    paymentMode: c.paymentMode,
    status: c.status,
    paymentDate: c.paymentDate,
    note: c.note,
    followUpNote: c.followUpNote,
    passPeopleCount: c.passPeopleCount,
    passDay18: c.passDay18,
    passDay19: c.passDay19,
  };
}

export interface PujaStore extends Omit<LiveData, "years"> {
  years: PujaYear[];
  activeYear: PujaYear;
  /** The signed-in user's own committee_members row, once resolved — undefined until then. */
  me: CommitteeMember | undefined;
  /** Keyed by house id or owner id — the two id spaces never collide. */
  previousYearInfo: Record<string, PreviousYearInfo[]>;
  contributionFor: (payer: PayerRef) => Contribution | undefined;
  ownerOf: (house: House) => Owner | undefined;
  ownerFlatCount: (ownerId: string) => number;
  /** The flat an owner's contribution/block attribution is shown against — their persisted primary flat if it's still one of theirs, else the lowest-sorted one. */
  ownerPrimaryHouse: (ownerId: string) => House | undefined;
  memberName: (memberId?: string) => string | undefined;
  isMemberRemovable: (memberId: string) => boolean;
  setActiveYear: (yearId: string) => void;
  startYear: (input: YearInput) => Promise<void>;
  updateYear: (yearId: string, patch: Partial<YearInput>) => Promise<void>;
  saveTenants: (houseId: string, names: string[], phone?: string) => Promise<void>;
  /** Toggles whether a flat's tenant counts toward this year's money totals and follow-up lists — their record and history stay intact either way. */
  setTenantDisabled: (houseId: string, disabled: boolean) => Promise<void>;
  /** Links (targetHouseId set) or unlinks (null) this flat's owner accounting to another flat — see House.paidViaHouseId. */
  setPaidViaHouse: (houseId: string, targetHouseId: string | null) => Promise<void>;
  saveOwner: (houseId: string, names: string[], phone?: string) => Promise<string>;
  setOwnerDisabled: (ownerId: string, disabled: boolean) => Promise<void>;
  /** Creates (existingId omitted) or renames (existingId set) an ex-resident — not tied to any flat. Returns the ex-resident id. */
  saveExResident: (existingId: string | undefined, names: string[], phone?: string) => Promise<string>;
  setExResidentDisabled: (exResidentId: string, disabled: boolean) => Promise<void>;
  /** Creates (existingId omitted) or renames (existingId set) an outside-collection entry — not tied to any flat. Returns its id. */
  saveOutsideCollection: (
    existingId: string | undefined,
    name: string,
    type: OutsideCollectionType,
    stallDetails?: string,
  ) => Promise<string>;
  setOutsideCollectionDisabled: (outsideCollectionId: string, disabled: boolean) => Promise<void>;
  /** Permanently removes an outside-collection entry (and its linked contribution) — only offered once it's already disabled. */
  deleteOutsideCollection: (outsideCollectionId: string) => Promise<void>;
  addMember: (input: MemberInput) => Promise<void>;
  updateMember: (memberId: string, patch: MemberInput) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  addCarriedFund: (input: CarriedFundInput) => Promise<void>;
  removeCarriedFund: (fundId: string) => Promise<void>;
  addFundTransfer: (input: FundTransferInput) => Promise<void>;
  removeFundTransfer: (transferId: string) => Promise<void>;
  saveContribution: (payer: PayerRef, input: ContributionInput) => Promise<void>;
  /** An extra installment against a pledge beyond its primary payment — e.g. split across a second collector/mode. */
  addContributionPayment: (contributionId: string, input: ContributionPaymentInput) => Promise<void>;
  removeContributionPayment: (contributionId: string, paymentId: string) => Promise<void>;
  /**
   * Returns the new bill's id. Pass initialPayment when the bill is being
   * paid right away (fully or as the first installment) instead of a
   * separate "Record payment" step afterward.
   */
  addVendorExpense: (input: VendorExpenseInput, initialPayment?: PaymentInput) => Promise<string>;
  updateVendorExpense: (expenseId: string, input: VendorExpenseInput) => Promise<void>;
  addVendorPayment: (expenseId: string, input: PaymentInput) => Promise<void>;
  /** Corrects a vendor payment entered wrong — amount, mode, date, who paid, etc. */
  updateVendorPayment: (expenseId: string, paymentId: string, input: PaymentInput) => Promise<void>;
  deleteVendorPayment: (expenseId: string, paymentId: string) => Promise<void>;
  deleteVendorExpense: (expenseId: string) => Promise<void>;
  reload: () => Promise<void>;
}

const PujaDataContext = createContext<PujaStore | null>(null);

export function PujaDataProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingYearId, setViewingYearId] = useState<string | null>(null);
  // Resolved once per session — the join key for "who is currently signed
  // in," used to attribute every logged activity to an actual person.
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: authData }) => setAuthUserId(authData.user?.id ?? null));
  }, [supabase]);

  // Split so the mount effect below can attach these as .then/.catch handlers
  // at the call site — the shape react-hooks/set-state-in-effect wants —
  // rather than calling a pre-built async function that sets state internally.
  const applyFresh = useCallback((fresh: LiveData) => {
    setData(fresh);
    setError(null);
    setViewingYearId((current) => {
      if (current && fresh.years.some((y) => y.id === current)) return current;
      const active = fresh.years.find((y) => y.status === "active");
      return active?.id ?? fresh.years[fresh.years.length - 1]?.id ?? null;
    });
  }, []);

  const applyError = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : "Could not load data from Supabase.");
  }, []);

  const load = useCallback(async () => {
    try {
      applyFresh(await fetchAllWithRetry(supabase));
    } catch (e) {
      applyError(e);
    }
  }, [supabase, applyFresh, applyError]);

  useEffect(() => {
    fetchAllWithRetry(supabase).then(applyFresh).catch(applyError);
  }, [supabase, applyFresh, applyError]);

  // Multiple committee members edit the same flats at the same time during
  // live collection, and there's no realtime subscription — so without this,
  // one person's update only shows up for everyone else after a manual
  // refresh. Poll quietly while the tab is visible, and catch up immediately
  // the moment it's switched back to (covers phone screen lock/app-switch,
  // where the poll interval alone could leave a long gap).
  useEffect(() => {
    const POLL_MS = 15000;
    const tick = () => {
      if (document.visibilityState === "visible") load();
    };
    const interval = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  const value = useMemo<PujaStore | null>(() => {
    if (!data) return null;
    const activeYear =
      data.years.find((y) => y.id === viewingYearId) ?? data.years[data.years.length - 1];
    if (!activeYear) return null;

    const previousYear = data.years
      .filter((y) => y.year < activeYear.year)
      .sort((a, b) => b.year - a.year)[0];

    const previousYearInfo: Record<string, PreviousYearInfo[]> = {};
    if (previousYear) {
      for (const c of data.contributions) {
        const key = c.houseId ?? c.ownerId ?? c.exResidentId;
        if (key && c.yearId === previousYear.id && c.moneyAmount > 0) {
          (previousYearInfo[key] ??= []).push(...previousYearEntries(c));
        }
      }
    }

    function inYear<T extends { yearId: string }>(rows: T[]): T[] {
      return rows.filter((r) => r.yearId === activeYear.id);
    }

    const yearContributions = inYear(data.contributions);
    const yearContributionIds = new Set(yearContributions.map((c) => c.id));
    const yearContributionPayments = data.contributionPayments.filter((p) =>
      yearContributionIds.has(p.contributionId),
    );

    // Standalone (not just an object property below) so the mutators further
    // down — also defined in this same object literal — can call it while
    // building an activity summary.
    const memberName = (memberId?: string): string | undefined =>
      memberId ? data.members.find((m) => m.id === memberId)?.name : undefined;

    const me = authUserId ? data.members.find((m) => m.authUserId === authUserId) : undefined;

    // Fire-and-forget, deliberately: a failure here must never surface as a
    // failed save — the business mutation this is attached to already
    // succeeded by the time this runs, so losing one activity-log entry is
    // far better than making a real save look like it failed.
    async function logActivity(action: string, summary: string, yearId?: string) {
      if (!me) return;
      try {
        await dbLogActivity(supabase, { actorMemberId: me.id, yearId, action, summary });
      } catch {
        // Swallowed on purpose — see comment above.
      }
    }

    /**
     * Shared by addContributionPayment (a split-collector installment) and
     * the resident-direct vendor-settlement path in addVendorPayment/
     * addVendorExpense — inserts the installment, then recomputes the
     * pledge the same way ContributionSheet's own promised -> partial
     * transition already works by hand: moving off "promised" treats the
     * old moneyAmount as the pledge target (originalPledgeAmount) and
     * starts the received total fresh from this payment. Doesn't log
     * activity or reload — callers do that once, after their own write.
     */
    const applyContributionPayment = async (
      contributionId: string,
      input: ContributionPaymentWrite,
    ): Promise<Contribution> => {
      const contribution = data.contributions.find((c) => c.id === contributionId);
      if (!contribution) throw new Error("That pledge is no longer here.");
      await dbAddContributionPayment(supabase, contributionId, input);

      if (contribution.status === "promised") {
        const pledge = contribution.moneyAmount;
        const paidInFull = input.amount >= pledge;
        await dbSaveContribution(supabase, activeYear.id, payerRefFor(contribution), contribution.id, {
          ...contributionPatchFrom(contribution),
          // This payment is already fully captured by the contribution_payments
          // row just inserted above — leaving the primary slot at 0 (rather
          // than duplicating the same amount there) keeps "moneyAmount + sum
          // of extras" the single source of truth for the total received.
          moneyAmount: 0,
          // Kept even once paid in full (not dropped the way a manual
          // ContributionSheet save would) — recomputeAfterRemoval needs it
          // to revert correctly if this installment is later removed; the
          // card only ever shows the pledge-progress line for "partial".
          originalPledgeAmount: pledge,
          paymentMode: input.mode,
          paymentDate: input.paymentDate,
          status: paidInFull ? "paid" : "partial",
        });
      } else if (contribution.originalPledgeAmount && contribution.status !== "paid") {
        const existingExtras = data.contributionPayments
          .filter((p) => p.contributionId === contributionId)
          .reduce((sum, p) => sum + p.amount, 0);
        const total = contribution.moneyAmount + existingExtras + input.amount;
        if (total >= contribution.originalPledgeAmount) {
          // Unlike ContributionSheet's manual save (which always drops the
          // pledge once status leaves "partial"), originalPledgeAmount is
          // kept here even once "paid" — recomputeAfterRemoval needs it to
          // correctly revert the status if this installment is later
          // removed. FlatCard.tsx only ever shows the pledge-progress line
          // for an actual "partial" status, so this stays invisible to
          // anyone looking at a fully paid pledge.
          await dbSaveContribution(supabase, activeYear.id, payerRefFor(contribution), contribution.id, {
            ...contributionPatchFrom(contribution),
            status: "paid",
          });
        }
      }
      return contribution;
    };

    /**
     * The reverse of applyContributionPayment's "paid" transition — used
     * when an installment that had pushed a pledge to "paid" is removed or
     * its linked vendor payment is deleted, so the pledge doesn't stay
     * marked fully settled once the money backing that is gone.
     */
    const recomputeAfterRemoval = async (
      contributionId: string,
      removedPaymentId: string,
    ): Promise<void> => {
      const contribution = data.contributions.find((c) => c.id === contributionId);
      if (!contribution?.originalPledgeAmount || contribution.status !== "paid") return;
      const remainingExtras = data.contributionPayments
        .filter((p) => p.contributionId === contributionId && p.id !== removedPaymentId)
        .reduce((sum, p) => sum + p.amount, 0);
      const total = contribution.moneyAmount + remainingExtras;
      if (total < contribution.originalPledgeAmount) {
        await dbSaveContribution(supabase, activeYear.id, payerRefFor(contribution), contribution.id, {
          ...contributionPatchFrom(contribution),
          status: "partial",
        });
      }
    };

    return {
      years: data.years,
      activeYear,
      me,
      latestActivityAt: data.latestActivityAt,
      owners: data.owners,
      exResidents: data.exResidents,
      outsideCollections: data.outsideCollections,
      houses: data.houses,
      members: data.members,
      contributions: yearContributions,
      contributionPayments: yearContributionPayments,
      fundTransfers: inYear(data.fundTransfers),
      carriedFunds: inYear(data.carriedFunds),
      vendorExpenses: inYear(data.vendorExpenses),
      previousYearInfo,
      contributionFor: (payer) => yearContributions.find((c) => matchesPayer(c, payer)),
      ownerOf: (house) =>
        house.ownerId ? data.owners.find((o) => o.id === house.ownerId) : undefined,
      ownerFlatCount: (ownerId) => data.houses.filter((h) => h.ownerId === ownerId).length,
      ownerPrimaryHouse: (ownerId) => {
        const owner = data.owners.find((o) => o.id === ownerId);
        const ownerHouses = data.houses.filter((h) => h.ownerId === ownerId);
        if (ownerHouses.length === 0) return undefined;
        const pinned =
          owner?.primaryHouseId && ownerHouses.find((h) => h.id === owner.primaryHouseId);
        if (pinned) return pinned;
        return [...ownerHouses].sort(
          (a, b) => a.block.localeCompare(b.block) || a.floor - b.floor || a.flatNo.localeCompare(b.flatNo),
        )[0];
      },
      memberName,
      isMemberRemovable: (memberId) => !memberIsReferenced(data, memberId),

      reload: load,
      setActiveYear: (yearId) => setViewingYearId(yearId),

      startYear: async (input) => {
        const newId = await dbStartYear(supabase, input);
        await logActivity("year.start", `started Durga Puja ${input.year}`, newId);
        await load();
        setViewingYearId(newId);
      },
      updateYear: async (yearId, patch) => {
        const year = data.years.find((y) => y.id === yearId);
        await dbUpdateYear(supabase, yearId, patch);
        const changes: string[] = [];
        if (patch.shashthiDate && year && patch.shashthiDate !== year.shashthiDate) {
          changes.push(
            `Shashthi ${formatShortDate(year.shashthiDate)} → ${formatShortDate(patch.shashthiDate)}`,
          );
        }
        if (patch.dashamiDate && year && patch.dashamiDate !== year.dashamiDate) {
          changes.push(
            `Dashami ${formatShortDate(year.dashamiDate)} → ${formatShortDate(patch.dashamiDate)}`,
          );
        }
        await logActivity(
          "year.update",
          changes.length > 0 ? `updated puja dates (${changes.join(", ")})` : "updated puja year details",
          yearId,
        );
        await load();
      },
      saveTenants: async (houseId, names, phone) => {
        const house = data.houses.find((h) => h.id === houseId);
        await dbSaveTenants(supabase, houseId, names, phone);
        await logActivity(
          "house.update_tenants",
          `updated tenants for ${house ? `${house.block}-${house.flatNo}` : "a flat"}`,
        );
        await load();
      },
      setTenantDisabled: async (houseId, disabled) => {
        const house = data.houses.find((h) => h.id === houseId);
        await dbSetTenantDisabled(supabase, houseId, disabled);
        await logActivity(
          disabled ? "house.disable_tenant" : "house.enable_tenant",
          `${disabled ? "disabled" : "re-enabled"} tenant ${house?.tenantNames.join(", ") || "?"} for ${house ? `${house.block}-${house.flatNo}` : "a flat"}`,
        );
        await load();
      },
      setPaidViaHouse: async (houseId, targetHouseId) => {
        const house = data.houses.find((h) => h.id === houseId);
        const target = targetHouseId ? data.houses.find((h) => h.id === targetHouseId) : undefined;
        const houseLabel = house ? `${house.block}-${house.flatNo}` : "a flat";
        await dbSetPaidViaHouse(supabase, houseId, targetHouseId);
        await logActivity(
          targetHouseId ? "house.link_paid_via" : "house.unlink_paid_via",
          targetHouseId
            ? `marked ${houseLabel} as paid via ${target ? `${target.block}-${target.flatNo}` : "another flat"}`
            : `removed the "paid via another flat" link on ${houseLabel}`,
        );
        await load();
      },
      saveOwner: async (houseId, names, phone) => {
        const house = data.houses.find((h) => h.id === houseId);
        const ownerId = await dbSaveOwner(supabase, houseId, house?.ownerId, names, phone);
        const flatLabel = house ? `${house.block}-${house.flatNo}` : "a flat";
        await logActivity(
          "owner.save",
          house?.ownerId
            ? `updated owner details for ${flatLabel} (${names.join(", ")})`
            : `added owner ${names.join(", ")} for ${flatLabel}`,
        );
        await load();
        return ownerId;
      },
      setOwnerDisabled: async (ownerId, disabled) => {
        const owner = data.owners.find((o) => o.id === ownerId);
        await dbSetOwnerDisabled(supabase, ownerId, disabled);
        await logActivity(
          disabled ? "owner.disable" : "owner.enable",
          `${disabled ? "disabled" : "re-enabled"} owner ${owner?.names.join(", ") ?? "?"}`,
        );
        await load();
      },
      saveExResident: async (existingId, names, phone) => {
        const id = await dbSaveExResident(supabase, existingId, names, phone);
        await logActivity(
          "ex_resident.save",
          existingId
            ? `updated ex-resident details (${names.join(", ")})`
            : `added ex-resident ${names.join(", ")}`,
        );
        await load();
        return id;
      },
      setExResidentDisabled: async (exResidentId, disabled) => {
        const exResident = data.exResidents.find((r) => r.id === exResidentId);
        await dbSetExResidentDisabled(supabase, exResidentId, disabled);
        await logActivity(
          disabled ? "ex_resident.disable" : "ex_resident.enable",
          `${disabled ? "disabled" : "re-enabled"} ex-resident ${exResident?.names.join(", ") ?? "?"}`,
        );
        await load();
      },
      saveOutsideCollection: async (existingId, name, type, stallDetails) => {
        const id = await dbSaveOutsideCollection(supabase, existingId, name, type, stallDetails);
        await logActivity(
          "outside_collection.save",
          existingId ? `updated outside-collection details (${name})` : `added outside collection ${name}`,
        );
        await load();
        return id;
      },
      setOutsideCollectionDisabled: async (outsideCollectionId, disabled) => {
        const entry = data.outsideCollections.find((r) => r.id === outsideCollectionId);
        await dbSetOutsideCollectionDisabled(supabase, outsideCollectionId, disabled);
        await logActivity(
          disabled ? "outside_collection.disable" : "outside_collection.enable",
          `${disabled ? "disabled" : "re-enabled"} outside collection ${entry?.name ?? "?"}`,
        );
        await load();
      },
      deleteOutsideCollection: async (outsideCollectionId) => {
        const entry = data.outsideCollections.find((r) => r.id === outsideCollectionId);
        await dbDeleteOutsideCollection(supabase, outsideCollectionId);
        await logActivity(
          "outside_collection.delete",
          `deleted outside collection ${entry?.name ?? "?"}`,
        );
        await load();
      },
      addMember: async (input) => {
        await dbAddMember(supabase, input);
        await logActivity("member.add", `added ${input.name} as a ${input.role}`);
        await load();
      },
      updateMember: async (memberId, patch) => {
        const before = data.members.find((m) => m.id === memberId);
        await dbUpdateMember(supabase, memberId, patch);
        await logActivity(
          "member.update",
          before && before.role !== patch.role
            ? `changed ${patch.name}'s role from ${before.role} to ${patch.role}`
            : `updated ${patch.name}'s details`,
        );
        await load();
      },
      removeMember: async (memberId) => {
        const member = data.members.find((m) => m.id === memberId);
        await dbRemoveMember(supabase, memberId);
        await logActivity("member.remove", `removed committee member ${member?.name ?? "?"}`);
        await load();
      },
      addCarriedFund: async (input) => {
        await dbAddCarriedFund(supabase, activeYear.id, input);
        await logActivity(
          "carried_fund.add",
          `recorded a carried-forward ${input.kind} of ${formatINR(input.amount)} for ${memberName(input.memberId)}`,
          activeYear.id,
        );
        await load();
      },
      removeCarriedFund: async (fundId) => {
        const fund = data.carriedFunds.find((f) => f.id === fundId);
        await dbRemoveCarriedFund(supabase, fundId);
        await logActivity(
          "carried_fund.remove",
          `removed a carried-forward ${fund?.kind ?? "fund"} entry of ${formatINR(fund?.amount ?? 0)} for ${memberName(fund?.memberId) ?? "?"}`,
          fund?.yearId,
        );
        await load();
      },
      addFundTransfer: async (input) => {
        await dbAddFundTransfer(supabase, activeYear.id, input);
        await logActivity(
          "fund_transfer.add",
          `logged a transfer of ${formatINR(input.amount)} from ${memberName(input.fromMemberId) ?? "outside"} to ${memberName(input.toMemberId) ?? "outside"}`,
          activeYear.id,
        );
        await load();
      },
      removeFundTransfer: async (transferId) => {
        const transfer = data.fundTransfers.find((t) => t.id === transferId);
        await dbRemoveFundTransfer(supabase, transferId);
        await logActivity(
          "fund_transfer.remove",
          `removed a transfer of ${formatINR(transfer?.amount ?? 0)} from ${memberName(transfer?.fromMemberId) ?? "outside"} to ${memberName(transfer?.toMemberId) ?? "outside"}`,
          transfer?.yearId,
        );
        await load();
      },
      saveContribution: async (payer, input) => {
        const existing = yearContributions.find((c) => matchesPayer(c, payer));
        await dbSaveContribution(supabase, activeYear.id, payer, existing?.id, input);

        const label = payerLabel(data, payer);
        let summary: string;
        if (!existing) {
          summary =
            `marked ${label} as ${pillLabels[input.status]}` +
            (input.moneyAmount > 0 ? ` — ${formatINR(input.moneyAmount)}` : "");
        } else if (existing.status !== input.status || existing.moneyAmount !== input.moneyAmount) {
          const before = `${pillLabels[existing.status]}${existing.moneyAmount > 0 ? ` (${formatINR(existing.moneyAmount)})` : ""}`;
          const after = `${pillLabels[input.status]}${input.moneyAmount > 0 ? ` (${formatINR(input.moneyAmount)})` : ""}`;
          summary = `changed ${label} from ${before} to ${after}`;
        } else {
          summary = `updated details for ${label} (still ${pillLabels[input.status]})`;
        }
        await logActivity("contribution.save", summary, activeYear.id);
        await load();
      },
      addContributionPayment: async (contributionId, input) => {
        const contribution = await applyContributionPayment(contributionId, input);
        await logActivity(
          "contribution_payment.add",
          `added a ${formatINR(input.amount)} ${paymentModeLabels[input.mode]} installment for ${payerLabel(data, payerRefFor(contribution))}${input.collectorId ? ` (collected by ${memberName(input.collectorId)})` : ""}`,
          activeYear.id,
        );
        await load();
      },
      removeContributionPayment: async (contributionId, paymentId) => {
        const contribution = data.contributions.find((c) => c.id === contributionId);
        const payment = data.contributionPayments.find((p) => p.id === paymentId);
        await dbRemoveContributionPayment(supabase, paymentId);
        await recomputeAfterRemoval(contributionId, paymentId);
        await logActivity(
          "contribution_payment.remove",
          `removed a ${formatINR(payment?.amount ?? 0)} installment for ${contribution ? payerLabel(data, payerRefFor(contribution)) : "a pledge"}`,
          activeYear.id,
        );
        await load();
      },
      addVendorExpense: async (input, initialPayment) => {
        const expenseId = await dbAddVendorExpense(supabase, activeYear.id, input);
        await logActivity(
          "vendor_expense.add",
          `added a bill from ${input.vendorName} for ${formatINR(input.totalAmount)} (${input.serviceType})`,
          activeYear.id,
        );
        if (initialPayment) {
          const newPaymentId = await dbAddVendorPayment(supabase, expenseId, initialPayment);
          let settledLabel = "";
          if (initialPayment.contributionId) {
            const contribution = await applyContributionPayment(initialPayment.contributionId, {
              amount: initialPayment.amount,
              mode: initialPayment.mode,
              paymentDate: initialPayment.paymentDate,
              vendorPaymentId: newPaymentId,
            });
            settledLabel = ` — settles ${payerLabel(data, payerRefFor(contribution))}'s pledge directly`;
          }
          await logActivity(
            "vendor_payment.add",
            `paid ${formatINR(initialPayment.amount)} to vendor ${input.vendorName}${initialPayment.selfFunded ? " (self-funded)" : ""}${initialPayment.contributionId ? settledLabel : ` (by ${memberName(initialPayment.memberId)})`}`,
            activeYear.id,
          );
        }
        await load();
        return expenseId;
      },
      updateVendorExpense: async (expenseId, input) => {
        const expense = data.vendorExpenses.find((e) => e.id === expenseId);
        if (!expense) throw new Error("That vendor bill is no longer here.");
        await dbUpdateVendorExpense(supabase, expense.vendorId, expenseId, input);
        await logActivity(
          "vendor_expense.update",
          expense.totalAmount !== input.totalAmount
            ? `changed bill total for ${input.vendorName} from ${formatINR(expense.totalAmount)} to ${formatINR(input.totalAmount)}`
            : `updated bill details for ${input.vendorName}`,
          expense.yearId,
        );
        await load();
      },
      addVendorPayment: async (expenseId, input) => {
        const expense = data.vendorExpenses.find((e) => e.id === expenseId);
        const newPaymentId = await dbAddVendorPayment(supabase, expenseId, input);
        let settledLabel = "";
        if (input.contributionId) {
          const contribution = await applyContributionPayment(input.contributionId, {
            amount: input.amount,
            mode: input.mode,
            paymentDate: input.paymentDate,
            vendorPaymentId: newPaymentId,
          });
          settledLabel = ` — settles ${payerLabel(data, payerRefFor(contribution))}'s pledge directly`;
        }
        await logActivity(
          "vendor_payment.add",
          `paid ${formatINR(input.amount)} to vendor ${expense?.vendor.name ?? "?"}${input.selfFunded ? " (self-funded)" : ""}${input.contributionId ? settledLabel : ` (by ${memberName(input.memberId)})`}`,
          expense?.yearId,
        );
        await load();
      },
      updateVendorPayment: async (expenseId, paymentId, input) => {
        const expense = data.vendorExpenses.find((e) => e.id === expenseId);
        await dbUpdateVendorPayment(supabase, paymentId, input);
        const linked = data.contributionPayments.find((p) => p.vendorPaymentId === paymentId);
        if (linked) {
          await dbUpdateContributionPaymentByVendorPayment(supabase, paymentId, {
            amount: input.amount,
            mode: input.mode,
            paymentDate: input.paymentDate,
          });
        }
        await logActivity(
          "vendor_payment.update",
          `corrected a payment of ${formatINR(input.amount)} to vendor ${expense?.vendor.name ?? "?"}${linked ? "" : ` (by ${memberName(input.memberId)})`}`,
          expense?.yearId,
        );
        await load();
      },
      deleteVendorPayment: async (expenseId, paymentId) => {
        const expense = data.vendorExpenses.find((e) => e.id === expenseId);
        const payment = expense?.payments.find((p) => p.id === paymentId);
        const linked = data.contributionPayments.find((p) => p.vendorPaymentId === paymentId);
        await dbDeleteVendorPayment(supabase, paymentId);
        if (linked) await recomputeAfterRemoval(linked.contributionId, linked.id);
        await logActivity(
          "vendor_payment.delete",
          `removed a payment of ${formatINR(payment?.amount ?? 0)} to vendor ${expense?.vendor.name ?? "?"}`,
          expense?.yearId,
        );
        await load();
      },
      deleteVendorExpense: async (expenseId) => {
        const expense = data.vendorExpenses.find((e) => e.id === expenseId);
        if (!expense) throw new Error("That vendor bill is no longer here.");
        await dbDeleteVendorExpense(supabase, expense.vendorId);
        await logActivity(
          "vendor_expense.delete",
          `deleted the bill for ${expense.vendor.name} and its recorded payments`,
          expense.yearId,
        );
        await load();
      },
    } satisfies PujaStore;
  }, [data, viewingYearId, authUserId, supabase, load]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ground px-6 text-center">
        <p className="text-[0.9rem] font-semibold text-ink">Couldn&rsquo;t load the committee data</p>
        <p className="text-[0.78rem] text-ink-faint">{error}</p>
        <button
          type="button"
          onClick={() => load()}
          className="rounded-xl bg-brand px-4 py-2 text-[0.82rem] font-semibold text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ground">
        <p className="text-[0.82rem] text-ink-faint">Loading…</p>
      </div>
    );
  }

  return <PujaDataContext.Provider value={value}>{children}</PujaDataContext.Provider>;
}

export function usePujaData(): PujaStore {
  const store = useContext(PujaDataContext);
  if (!store) throw new Error("usePujaData must be used inside PujaDataProvider");
  return store;
}
