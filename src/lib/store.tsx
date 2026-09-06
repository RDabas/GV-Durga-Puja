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
import { createClient } from "@/lib/supabase/client";
import {
  dbAddCarriedFund,
  dbAddMember,
  dbAddSponsor,
  dbAddSponsorPayment,
  dbAddVendorExpense,
  dbAddVendorPayment,
  dbDeleteSponsor,
  dbDeleteVendorExpense,
  dbRemoveCarriedFund,
  dbRemoveMember,
  dbSaveContribution,
  dbSaveOwner,
  dbSaveTenants,
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
  ContributionStatus,
  House,
  Owner,
  PaymentMode,
  PujaYear,
  SponsorType,
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

export interface PreviousYearInfo {
  amount: number;
  status: ContributionStatus;
  mode: PaymentMode;
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
  /** Keyed by house id or owner id — the two id spaces never collide. */
  previousYearInfo: Record<string, PreviousYearInfo>;
  contributionFor: (payer: PayerRef) => Contribution | undefined;
  ownerOf: (house: House) => Owner | undefined;
  ownerFlatCount: (ownerId: string) => number;
  memberName: (memberId?: string) => string | undefined;
  isMemberRemovable: (memberId: string) => boolean;
  setActiveYear: (yearId: string) => void;
  startYear: (input: YearInput) => Promise<void>;
  updateYear: (yearId: string, patch: Partial<YearInput>) => Promise<void>;
  saveTenants: (houseId: string, names: string[], phone?: string) => Promise<void>;
  saveOwner: (houseId: string, names: string[], phone?: string) => Promise<string>;
  addMember: (input: MemberInput) => Promise<void>;
  updateMember: (memberId: string, patch: MemberInput) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  addCarriedFund: (input: CarriedFundInput) => Promise<void>;
  removeCarriedFund: (fundId: string) => Promise<void>;
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
          previousYearInfo[key] = { amount: c.moneyAmount, status: c.status, mode: c.paymentMode };
        }
      }
    }

    function inYear<T extends { yearId: string }>(rows: T[]): T[] {
      return rows.filter((r) => r.yearId === activeYear.id);
    }

    const yearContributions = inYear(data.contributions);

    return {
      years: data.years,
      activeYear,
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
      memberName: (memberId) =>
        memberId ? data.members.find((m) => m.id === memberId)?.name : undefined,
      isMemberRemovable: (memberId) => !memberIsReferenced(data, memberId),

      reload: load,
      setActiveYear: (yearId) => setViewingYearId(yearId),

      startYear: async (input) => {
        const newId = await dbStartYear(supabase, input);
        await load();
        setViewingYearId(newId);
      },
      updateYear: async (yearId, patch) => {
        await dbUpdateYear(supabase, yearId, patch);
        await load();
      },
      saveTenants: async (houseId, names, phone) => {
        await dbSaveTenants(supabase, houseId, names, phone);
        await load();
      },
      saveOwner: async (houseId, names, phone) => {
        const house = data.houses.find((h) => h.id === houseId);
        const ownerId = await dbSaveOwner(supabase, houseId, house?.ownerId, names, phone);
        await load();
        return ownerId;
      },
      addMember: async (input) => {
        await dbAddMember(supabase, input);
        await load();
      },
      updateMember: async (memberId, patch) => {
        await dbUpdateMember(supabase, memberId, patch);
        await load();
      },
      removeMember: async (memberId) => {
        await dbRemoveMember(supabase, memberId);
        await load();
      },
      addCarriedFund: async (input) => {
        await dbAddCarriedFund(supabase, activeYear.id, input);
        await load();
      },
      removeCarriedFund: async (fundId) => {
        await dbRemoveCarriedFund(supabase, fundId);
        await load();
      },
      saveContribution: async (payer, input) => {
        const existing = yearContributions.find((c) => matchesPayer(c, payer));
        await dbSaveContribution(supabase, activeYear.id, payer, existing?.id, input);
        await load();
      },
      addSponsor: async (input) => {
        await dbAddSponsor(supabase, activeYear.id, input);
        await load();
      },
      updateSponsor: async (sponsorId, input) => {
        await dbUpdateSponsor(supabase, sponsorId, input);
        await load();
      },
      addSponsorPayment: async (sponsorId, input) => {
        await dbAddSponsorPayment(supabase, sponsorId, input);
        await load();
      },
      deleteSponsor: async (sponsorId) => {
        await dbDeleteSponsor(supabase, sponsorId);
        await load();
      },
      addVendorExpense: async (input) => {
        await dbAddVendorExpense(supabase, activeYear.id, input);
        await load();
      },
      updateVendorExpense: async (expenseId, input) => {
        const expense = data.vendorExpenses.find((e) => e.id === expenseId);
        if (!expense) throw new Error("That vendor bill is no longer here.");
        await dbUpdateVendorExpense(supabase, expense.vendorId, expenseId, input);
        await load();
      },
      addVendorPayment: async (expenseId, input) => {
        await dbAddVendorPayment(supabase, expenseId, input);
        await load();
      },
      deleteVendorExpense: async (expenseId) => {
        const expense = data.vendorExpenses.find((e) => e.id === expenseId);
        if (!expense) throw new Error("That vendor bill is no longer here.");
        await dbDeleteVendorExpense(supabase, expense.vendorId);
        await load();
      },
    } satisfies PujaStore;
  }, [data, viewingYearId, supabase, load]);

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
