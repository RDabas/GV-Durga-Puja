"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { houses as seedHouses, owners as seedOwners } from "@/lib/directory";
import {
  activeYear as seedActiveYear,
  carriedFunds as seedCarriedFunds,
  committeeMembers as seedMembers,
  contributions as seedContributions,
  fundTransfers as seedTransfers,
  sponsors as seedSponsors,
  vendorExpenses as seedVendorExpenses,
  years as seedYears,
} from "@/lib/sample-data";
import type {
  CarriedFund,
  CarriedFundKind,
  CommitteeMember,
  Contribution,
  ContributionStatus,
  FundTransfer,
  House,
  Owner,
  PaymentMode,
  PujaYear,
  Sponsor,
  SponsorType,
  VendorExpense,
} from "@/lib/types";

/**
 * Everything the committee edits lives here. It is seeded from sample-data and
 * kept in the browser so the app is usable before Supabase is connected —
 * swapping these mutators for queries against supabase/schema.sql is the only
 * change needed to go live, since the shapes already match the tables.
 *
 * Year-scoped collections are stored whole and filtered on read, so switching
 * years is a local operation and history stays intact.
 */

const STORAGE_KEY = "gv-puja-data-v4";

interface PujaData {
  years: PujaYear[];
  activeYearId: string;
  owners: Owner[];
  houses: House[];
  members: CommitteeMember[];
  contributions: Contribution[];
  fundTransfers: FundTransfer[];
  carriedFunds: CarriedFund[];
  sponsors: Sponsor[];
  vendorExpenses: VendorExpense[];
}

export type ContributionInput = Omit<
  Contribution,
  "id" | "yearId" | "houseId" | "ownerId"
>;

/** A tenant entry belongs to a flat; an owner entry belongs to the owner. */
export type PayerRef = { houseId: string } | { ownerId: string };

export interface PaymentInput {
  memberId: string;
  amount: number;
  paymentDate: string;
  mode: PaymentMode;
  note?: string;
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
  collectionGoal: number;
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

const seed: PujaData = {
  years: seedYears,
  activeYearId: seedActiveYear.id,
  owners: seedOwners,
  houses: seedHouses,
  members: seedMembers,
  contributions: seedContributions,
  fundTransfers: seedTransfers,
  carriedFunds: seedCarriedFunds,
  sponsors: seedSponsors,
  vendorExpenses: seedVendorExpenses,
};

// localStorage is the source of truth on the client; this cache keeps
// getSnapshot returning a referentially stable object between writes.
let cache: { raw: string | null; data: PujaData } = { raw: null, data: seed };
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): PujaData {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cache.raw) return cache.data;
  let data = seed;
  if (raw) {
    try {
      data = JSON.parse(raw) as PujaData;
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
  cache = { raw, data };
  return data;
}

function getServerSnapshot(): PujaData {
  return seed;
}

function update(change: (current: PujaData) => PujaData): void {
  const next = change(getSnapshot());
  const raw = JSON.stringify(next);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cache = { raw, data: next };
  for (const listener of listeners) listener();
}

function setActiveYear(yearId: string): void {
  update((prev) => ({ ...prev, activeYearId: yearId }));
}

/** Starts a fresh year and switches to it; the outgoing year becomes history. */
function startYear(input: YearInput): void {
  update((prev) => {
    const id = crypto.randomUUID();
    return {
      ...prev,
      years: [
        ...prev.years.map((y) => ({ ...y, status: "archived" as const })),
        { ...input, id, status: "active" as const },
      ],
      activeYearId: id,
    };
  });
}

function updateYear(yearId: string, patch: Partial<YearInput>): void {
  update((prev) => ({
    ...prev,
    years: prev.years.map((y) => (y.id === yearId ? { ...y, ...patch } : y)),
  }));
}

function saveTenants(houseId: string, names: string[], phone?: string): void {
  update((prev) => ({
    ...prev,
    houses: prev.houses.map((h) =>
      h.id === houseId ? { ...h, tenantNames: names, tenantPhone: phone } : h,
    ),
  }));
}

/**
 * Renaming an owner, or attaching one to a flat that had none. A new owner is
 * created only when the flat had no owner, so multi-flat owners stay shared.
 */
function saveOwner(houseId: string, names: string[], phone?: string): string {
  let ownerId = "";
  update((prev) => {
    const house = prev.houses.find((h) => h.id === houseId);
    if (!house) return prev;

    if (house.ownerId) {
      ownerId = house.ownerId;
      return {
        ...prev,
        owners: prev.owners.map((o) =>
          o.id === house.ownerId ? { ...o, names, phone } : o,
        ),
      };
    }

    ownerId = crypto.randomUUID();
    return {
      ...prev,
      owners: [...prev.owners, { id: ownerId, names, phone }],
      houses: prev.houses.map((h) => (h.id === houseId ? { ...h, ownerId } : h)),
    };
  });
  return ownerId;
}

function addMember(input: MemberInput): void {
  update((prev) => ({
    ...prev,
    members: [...prev.members, { ...input, id: crypto.randomUUID() }],
  }));
}

function updateMember(memberId: string, patch: MemberInput): void {
  update((prev) => ({
    ...prev,
    members: prev.members.map((m) => (m.id === memberId ? { ...m, ...patch } : m)),
  }));
}

function memberIsReferenced(data: PujaData, memberId: string): boolean {
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

/**
 * Refuses while the member still owns money movements in any year — removing
 * them would leave those entries pointing at nobody, losing the audit trail of
 * who took or paid out the money. Hand the entries over first.
 */
function removeMember(memberId: string): void {
  update((prev) => {
    if (memberIsReferenced(prev, memberId)) return prev;
    return { ...prev, members: prev.members.filter((m) => m.id !== memberId) };
  });
}

function addCarriedFund(input: CarriedFundInput): void {
  update((prev) => ({
    ...prev,
    carriedFunds: [
      ...prev.carriedFunds,
      { ...input, id: crypto.randomUUID(), yearId: prev.activeYearId },
    ],
  }));
}

function removeCarriedFund(fundId: string): void {
  update((prev) => ({
    ...prev,
    carriedFunds: prev.carriedFunds.filter((f) => f.id !== fundId),
  }));
}

function matchesPayer(c: Contribution, payer: PayerRef): boolean {
  return "houseId" in payer ? c.houseId === payer.houseId : c.ownerId === payer.ownerId;
}

function saveContribution(payer: PayerRef, input: ContributionInput): void {
  update((prev) => {
    const existing = prev.contributions.find(
      (c) => c.yearId === prev.activeYearId && matchesPayer(c, payer),
    );
    const next: Contribution = {
      ...input,
      ...payer,
      id: existing?.id ?? crypto.randomUUID(),
      yearId: prev.activeYearId,
    };
    return {
      ...prev,
      contributions: existing
        ? prev.contributions.map((c) => (c.id === existing.id ? next : c))
        : [...prev.contributions, next],
    };
  });
}

function addSponsor(input: SponsorInput): void {
  update((prev) => ({
    ...prev,
    sponsors: [
      ...prev.sponsors,
      { ...input, id: crypto.randomUUID(), yearId: prev.activeYearId, payments: [] },
    ],
  }));
}

function addSponsorPayment(sponsorId: string, input: PaymentInput): void {
  update((prev) => ({
    ...prev,
    sponsors: prev.sponsors.map((s) =>
      s.id === sponsorId
        ? { ...s, payments: [...s.payments, { ...input, id: crypto.randomUUID(), sponsorId }] }
        : s,
    ),
  }));
}

function addVendorExpense(input: VendorExpenseInput): void {
  update((prev) => {
    const vendorId = crypto.randomUUID();
    return {
      ...prev,
      vendorExpenses: [
        ...prev.vendorExpenses,
        {
          id: crypto.randomUUID(),
          vendorId,
          yearId: prev.activeYearId,
          totalAmount: input.totalAmount,
          notes: input.notes,
          vendor: {
            id: vendorId,
            name: input.vendorName,
            serviceType: input.serviceType,
            phone: input.phone,
          },
          payments: [],
        },
      ],
    };
  });
}

function addVendorPayment(expenseId: string, input: PaymentInput): void {
  update((prev) => ({
    ...prev,
    vendorExpenses: prev.vendorExpenses.map((e) =>
      e.id === expenseId
        ? {
            ...e,
            payments: [
              ...e.payments,
              { ...input, id: crypto.randomUUID(), vendorExpenseId: expenseId },
            ],
          }
        : e,
    ),
  }));
}

const mutators = {
  setActiveYear,
  startYear,
  updateYear,
  saveTenants,
  saveOwner,
  addMember,
  updateMember,
  removeMember,
  addCarriedFund,
  removeCarriedFund,
  saveContribution,
  addSponsor,
  addSponsorPayment,
  addVendorExpense,
  addVendorPayment,
};

export interface PreviousYearInfo {
  amount: number;
  status: ContributionStatus;
  mode: PaymentMode;
}

type PujaStore = Omit<PujaData, "activeYearId"> &
  typeof mutators & {
    activeYear: PujaYear;
    /** Keyed by house id or owner id — the two id spaces never collide. */
    previousYearInfo: Record<string, PreviousYearInfo>;
    contributionFor: (payer: PayerRef) => Contribution | undefined;
    ownerOf: (house: House) => Owner | undefined;
    ownerFlatCount: (ownerId: string) => number;
    memberName: (memberId?: string) => string | undefined;
    isMemberRemovable: (memberId: string) => boolean;
  };

const PujaDataContext = createContext<PujaStore | null>(null);

export function PujaDataProvider({ children }: { children: ReactNode }) {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const value = useMemo<PujaStore>(() => {
    const activeYear =
      data.years.find((y) => y.id === data.activeYearId) ?? data.years[data.years.length - 1];

    const previousYear = data.years
      .filter((y) => y.year < activeYear.year)
      .sort((a, b) => b.year - a.year)[0];

    const previousYearInfo: Record<string, PreviousYearInfo> = {};
    if (previousYear) {
      for (const c of data.contributions) {
        const key = c.houseId ?? c.ownerId;
        if (key && c.yearId === previousYear.id && c.moneyAmount > 0) {
          previousYearInfo[key] = {
            amount: c.moneyAmount,
            status: c.status,
            mode: c.paymentMode,
          };
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
      ownerFlatCount: (ownerId) =>
        data.houses.filter((h) => h.ownerId === ownerId).length,
      memberName: (memberId) =>
        memberId ? data.members.find((m) => m.id === memberId)?.name : undefined,
      isMemberRemovable: (memberId) => !memberIsReferenced(data, memberId),
      ...mutators,
    };
  }, [data]);

  return <PujaDataContext.Provider value={value}>{children}</PujaDataContext.Provider>;
}

export function usePujaData(): PujaStore {
  const store = useContext(PujaDataContext);
  if (!store) throw new Error("usePujaData must be used inside PujaDataProvider");
  return store;
}
