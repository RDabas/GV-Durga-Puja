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
import { createClient } from "@/lib/supabase/client";
import {
  dbAddCarriedFund,
  dbAddFundTransfer,
  dbAddMember,
  dbAddSponsor,
  dbAddSponsorPayment,
  dbAddVendorExpense,
  dbAddVendorPayment,
  dbDeleteSponsor,
  dbDeleteVendorExpense,
  dbLogActivity,
  dbRemoveCarriedFund,
  dbRemoveFundTransfer,
  dbRemoveMember,
  dbSaveContribution,
  dbSaveOwner,
  dbSaveTenants,
  dbSetOwnerDisabled,
  dbStartYear,
  dbUpdateMember,
  dbUpdateSponsor,
  dbUpdateVendorExpense,
  dbUpdateYear,
  fetchAllWithRetry,
  type LiveData,
} from "@/lib/supabase/queries";
import type {
  CarriedFundKind,
  CommitteeMember,
  Contribution,
  House,
  Owner,
  PaymentMode,
  PujaYear,
  SponsorType,
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

/** A tenant entry belongs to a flat; an owner entry belongs to the owner. */
export type PayerRef = { houseId: string } | { ownerId: string };

export type ContributionInput = Omit<
  Contribution,
  "id" | "yearId" | "houseId" | "ownerId"
>;

export interface PaymentInput {
  memberId: string;
  amount: number;
  paymentDate: string;
  mode: PaymentMode;
  note?: string;
  /** Vendor payments only — paid from the member's own pocket, so it shouldn't reduce their balance in hand. */
  selfFunded?: boolean;
}

export interface SponsorInput {
  name: string;
  type: SponsorType;
  stallDetails?: string;
  contact?: string;
  amountPledged: number;
  notes?: string;
}

export interface VendorExpenseInput {
  vendorName: string;
  serviceType: string;
  phone?: string;
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

export interface PreviousYearInfo {
  amount: number;
  /** Who actually paid, when recorded — e.g. from an imported prior year's sheet, since the current owner/tenant on file may have changed since then. */
  payerName?: string;
}

function matchesPayer(c: Contribution, payer: PayerRef): boolean {
  return "houseId" in payer ? c.houseId === payer.houseId : c.ownerId === payer.ownerId;
}

function memberIsReferenced(data: LiveData, memberId: string): boolean {
  return (
    data.contributions.some((c) => c.collectorId === memberId) ||
    data.fundTransfers.some(
      (t) => t.fromMemberId === memberId || t.toMemberId === memberId,
    ) ||
    data.carriedFunds.some((f) => f.memberId === memberId) ||
    data.sponsors.some((s) => s.payments.some((p) => p.memberId === memberId)) ||
    data.vendorExpenses.some((e) => e.payments.some((p) => p.memberId === memberId))
  );
}

export interface PujaStore extends Omit<LiveData, "years"> {
  years: PujaYear[];
  activeYear: PujaYear;
  /** The signed-in user's own committee_members row, once resolved — undefined until then. */
  me: CommitteeMember | undefined;
  /** Keyed by house id or owner id — the two id spaces never collide. */
  previousYearInfo: Record<string, PreviousYearInfo>;
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
  saveOwner: (houseId: string, names: string[], phone?: string) => Promise<string>;
  setOwnerDisabled: (ownerId: string, disabled: boolean) => Promise<void>;
  addMember: (input: MemberInput) => Promise<void>;
  updateMember: (memberId: string, patch: MemberInput) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  addCarriedFund: (input: CarriedFundInput) => Promise<void>;
  removeCarriedFund: (fundId: string) => Promise<void>;
  addFundTransfer: (input: FundTransferInput) => Promise<void>;
  removeFundTransfer: (transferId: string) => Promise<void>;
  saveContribution: (payer: PayerRef, input: ContributionInput) => Promise<void>;
  addSponsor: (input: SponsorInput) => Promise<void>;
  updateSponsor: (sponsorId: string, input: SponsorInput) => Promise<void>;
  addSponsorPayment: (sponsorId: string, input: PaymentInput) => Promise<void>;
  deleteSponsor: (sponsorId: string) => Promise<void>;
  addVendorExpense: (input: VendorExpenseInput) => Promise<void>;
  updateVendorExpense: (expenseId: string, input: VendorExpenseInput) => Promise<void>;
  addVendorPayment: (expenseId: string, input: PaymentInput) => Promise<void>;
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

  const value = useMemo<PujaStore | null>(() => {
    if (!data) return null;
    const activeYear =
      data.years.find((y) => y.id === viewingYearId) ?? data.years[data.years.length - 1];
    if (!activeYear) return null;

    const previousYear = data.years
      .filter((y) => y.year < activeYear.year)
      .sort((a, b) => b.year - a.year)[0];

    const previousYearInfo: Record<string, PreviousYearInfo> = {};
    if (previousYear) {
      for (const c of data.contributions) {
        const key = c.houseId ?? c.ownerId;
        if (key && c.yearId === previousYear.id && c.moneyAmount > 0) {
          previousYearInfo[key] = { amount: c.moneyAmount, payerName: c.note };
        }
      }
    }

    function inYear<T extends { yearId: string }>(rows: T[]): T[] {
      return rows.filter((r) => r.yearId === activeYear.id);
    }

    const yearContributions = inYear(data.contributions);

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

    return {
      years: data.years,
      activeYear,
      me,
      latestActivityAt: data.latestActivityAt,
      owners: data.owners,
      houses: data.houses,
      members: data.members,
      contributions: yearContributions,
      fundTransfers: inYear(data.fundTransfers),
      carriedFunds: inYear(data.carriedFunds),
      sponsors: inYear(data.sponsors),
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

        const label =
          "houseId" in payer
            ? (() => {
                const h = data.houses.find((x) => x.id === payer.houseId);
                return h ? `${h.block}-${h.flatNo}` : "a flat";
              })()
            : (data.owners.find((o) => o.id === payer.ownerId)?.names.join(", ") ?? "an owner");
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
      addSponsor: async (input) => {
        await dbAddSponsor(supabase, activeYear.id, input);
        await logActivity(
          "sponsor.add",
          `added sponsor ${input.name} (pledged ${formatINR(input.amountPledged)})`,
          activeYear.id,
        );
        await load();
      },
      updateSponsor: async (sponsorId, input) => {
        const before = data.sponsors.find((s) => s.id === sponsorId);
        await dbUpdateSponsor(supabase, sponsorId, input);
        await logActivity(
          "sponsor.update",
          before && before.amountPledged !== input.amountPledged
            ? `changed pledge for ${input.name} from ${formatINR(before.amountPledged)} to ${formatINR(input.amountPledged)}`
            : `updated details for sponsor ${input.name}`,
          before?.yearId,
        );
        await load();
      },
      addSponsorPayment: async (sponsorId, input) => {
        const sponsor = data.sponsors.find((s) => s.id === sponsorId);
        await dbAddSponsorPayment(supabase, sponsorId, input);
        await logActivity(
          "sponsor_payment.add",
          `recorded ${formatINR(input.amount)} from sponsor ${sponsor?.name ?? "?"} (received by ${memberName(input.memberId)})`,
          sponsor?.yearId,
        );
        await load();
      },
      deleteSponsor: async (sponsorId) => {
        const sponsor = data.sponsors.find((s) => s.id === sponsorId);
        await dbDeleteSponsor(supabase, sponsorId);
        await logActivity(
          "sponsor.delete",
          `deleted sponsor ${sponsor?.name ?? "?"} and its recorded payments`,
          sponsor?.yearId,
        );
        await load();
      },
      addVendorExpense: async (input) => {
        await dbAddVendorExpense(supabase, activeYear.id, input);
        await logActivity(
          "vendor_expense.add",
          `added a bill from ${input.vendorName} for ${formatINR(input.totalAmount)} (${input.serviceType})`,
          activeYear.id,
        );
        await load();
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
        await dbAddVendorPayment(supabase, expenseId, input);
        await logActivity(
          "vendor_payment.add",
          `paid ${formatINR(input.amount)} to vendor ${expense?.vendor.name ?? "?"}${input.selfFunded ? " (self-funded)" : ""} (by ${memberName(input.memberId)})`,
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
