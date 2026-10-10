"use client";

import { useState } from "react";
import { ContributionSheet } from "@/components/ContributionSheet";
import { ExResidentCard } from "@/components/ExResidentCard";
import { ExResidentSheet } from "@/components/ExResidentSheet";
import { FlatCard } from "@/components/FlatCard";
import { PlusIcon, RefreshIcon } from "@/components/icons";
import { knownBlocks } from "@/lib/directory";
import { usePujaData } from "@/lib/store";
import type { Block, Contribution, ExResident, House } from "@/lib/types";
import type { PreviousYearInfo } from "@/lib/store";

const allBlocks: Block[] = ["A", "B", "C", "D", "E", "F", "G"];

type CollectTab = Block | "ex_resident";

type SortField = "flat" | "lastYear" | "thisYear";

type EditingTarget =
  | { kind: "flat"; house: House; role: "owner" | "tenant" }
  | { kind: "ex_resident"; exResident?: ExResident };

function assignedToLabel(
  contribution: Contribution | undefined,
  memberName: (memberId?: string) => string | undefined,
): string | undefined {
  return memberName(contribution?.assignedToMemberId) ?? contribution?.assignedToName;
}

function sumPreviousYear(entries: PreviousYearInfo[] | undefined): number {
  return entries?.reduce((sum, e) => sum + e.amount, 0) ?? 0;
}

/** Same paid/partial/promised + Bhog convention used on the dashboard and Outside Collection tab. */
function thisYearAmount(contribution: Contribution | undefined): number {
  if (!contribution) return 0;
  const money =
    contribution.status === "paid" ||
    contribution.status === "partial" ||
    contribution.status === "promised"
      ? contribution.moneyAmount
      : 0;
  return money + contribution.bhogGroceryAmount;
}

export default function CollectPage() {
  const {
    houses,
    exResidents,
    contributionFor,
    ownerOf,
    ownerFlatCount,
    ownerPrimaryHouse,
    previousYearInfo,
    memberName,
    setOwnerDisabled,
    setTenantDisabled,
    setExResidentDisabled,
    reload,
  } = usePujaData();
  const [selectedTab, setSelectedTab] = useState<CollectTab>(knownBlocks[0] ?? "A");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EditingTarget | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<{ field: SortField; dir: "asc" | "desc" }>({
    field: "flat",
    dir: "desc",
  });

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }

  function toggleSort(field: SortField) {
    setSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "desc" },
    );
  }

  // A flat's card shows both its owner and tenant rows, so the metric for
  // sorting combines both payers' figures into one number per flat.
  function houseLastYearAmount(house: House): number {
    const owner = ownerOf(house);
    return (
      sumPreviousYear(previousYearInfo[house.id]) +
      (owner ? sumPreviousYear(previousYearInfo[owner.id]) : 0)
    );
  }
  function houseThisYearAmount(house: House): number {
    const owner = ownerOf(house);
    return (
      thisYearAmount(contributionFor({ houseId: house.id })) +
      (owner ? thisYearAmount(contributionFor({ ownerId: owner.id })) : 0)
    );
  }
  function exResidentLastYearAmount(exResident: ExResident): number {
    return sumPreviousYear(previousYearInfo[exResident.id]);
  }
  function exResidentThisYearAmount(exResident: ExResident): number {
    return thisYearAmount(contributionFor({ exResidentId: exResident.id }));
  }

  const dir = sort.dir === "asc" ? 1 : -1;
  function sortHouses(list: House[]): House[] {
    if (sort.field === "lastYear" || sort.field === "thisYear") {
      const metric = sort.field === "lastYear" ? houseLastYearAmount : houseThisYearAmount;
      return [...list].sort((a, b) => dir * (metric(a) - metric(b)));
    }
    // Direction flips which block/floor comes first, but a flat's number
    // within its own floor always reads in its natural ascending order —
    // reversing that would scramble a floor's left-to-right unit layout for
    // no benefit.
    return [...list].sort(
      (a, b) =>
        dir * (a.block.localeCompare(b.block) || a.floor - b.floor) ||
        a.flatNo.localeCompare(b.flatNo),
    );
  }
  function sortExResidents(list: ExResident[]): ExResident[] {
    if (sort.field === "lastYear" || sort.field === "thisYear") {
      const metric = sort.field === "lastYear" ? exResidentLastYearAmount : exResidentThisYearAmount;
      return [...list].sort((a, b) => dir * (metric(a) - metric(b)));
    }
    return [...list].sort((a, b) => dir * a.names.join(", ").localeCompare(b.names.join(", ")));
  }

  // Sorting by an amount doesn't respect floor grouping, so the block view
  // flattens to one list in that case — floor headers only make sense for
  // the default flat-number order.
  const floors: [number, House[]][] = (() => {
    if (selectedTab === "ex_resident") return [];
    const inBlock = houses.filter((h) => h.block === selectedTab);
    if (sort.field !== "flat") return [[0, sortHouses(inBlock)]];
    const byFloor = new Map<number, House[]>();
    for (const house of inBlock) {
      const list = byFloor.get(house.floor) ?? [];
      list.push(house);
      byFloor.set(house.floor, list);
    }
    const floorEntries: [number, House[]][] = [...byFloor.entries()].map(([floor, floorHouses]) => [
      floor,
      sortHouses(floorHouses),
    ]);
    return floorEntries.sort((a, b) => dir * (a[0] - b[0]));
  })();

  const sortedExResidents = sortExResidents(exResidents);

  // Non-null only while the search box has text — searches every block, not
  // just the selected one, since the resident might be in a block you're not
  // currently looking at.
  const searchQuery = search.trim().toLowerCase();
  const searchResults = searchQuery
    ? sortHouses(
        houses.filter((h) => {
          const owner = ownerOf(h);
          return (
            h.flatNo.toLowerCase().includes(searchQuery) ||
            `${h.block}-${h.flatNo}`.toLowerCase().includes(searchQuery) ||
            h.tenantNames.some((n) => n.toLowerCase().includes(searchQuery)) ||
            (owner?.names.some((n) => n.toLowerCase().includes(searchQuery)) ?? false)
          );
        }),
      )
    : null;

  const exResidentSearchResults = searchQuery
    ? sortExResidents(
        exResidents.filter((r) => r.names.some((n) => n.toLowerCase().includes(searchQuery))),
      )
    : null;

  function renderExResidentCard(exResident: ExResident) {
    const contribution = contributionFor({ exResidentId: exResident.id });
    return (
      <ExResidentCard
        key={exResident.id}
        exResident={exResident}
        contribution={contribution}
        collectorName={memberName(contribution?.collectorId)}
        assignedToName={assignedToLabel(contribution, memberName)}
        previousYear={previousYearInfo[exResident.id]}
        onEdit={() => setEditing({ kind: "ex_resident", exResident })}
        onToggleDisabled={() => setExResidentDisabled(exResident.id, !exResident.disabled)}
      />
    );
  }

  function renderFlatCard(house: House) {
    const owner = ownerOf(house);
    const ownerContribution = owner ? contributionFor({ ownerId: owner.id }) : undefined;
    const tenantContribution = contributionFor({ houseId: house.id });
    const linkedHouse = house.paidViaHouseId
      ? houses.find((h) => h.id === house.paidViaHouseId)
      : undefined;
    const linkedOwner = linkedHouse ? ownerOf(linkedHouse) : undefined;
    const primaryHouse = owner ? ownerPrimaryHouse(owner.id) : undefined;
    const isPrimaryOwnerFlat = !owner || (!linkedHouse && (!primaryHouse || primaryHouse.id === house.id));
    const referenceHouse = linkedHouse ?? primaryHouse;
    // A manually linked flat's status should reflect the flat it's linked
    // to (a different Owner record entirely), not its own — which has no
    // contribution of its own by design.
    const displayedOwnerContribution = linkedHouse
      ? (linkedOwner ? contributionFor({ ownerId: linkedOwner.id }) : undefined)
      : ownerContribution;
    return (
      <FlatCard
        key={house.id}
        house={house}
        owner={owner}
        ownerFlatCount={owner ? ownerFlatCount(owner.id) : 0}
        isPrimaryOwnerFlat={isPrimaryOwnerFlat}
        primaryFlatLabel={referenceHouse ? `${referenceHouse.block}-${referenceHouse.flatNo}` : undefined}
        ownerContribution={displayedOwnerContribution}
        tenantContribution={tenantContribution}
        ownerCollector={memberName(displayedOwnerContribution?.collectorId)}
        tenantCollector={memberName(tenantContribution?.collectorId)}
        ownerAssignedTo={assignedToLabel(displayedOwnerContribution, memberName)}
        tenantAssignedTo={assignedToLabel(tenantContribution, memberName)}
        ownerPreviousYear={owner ? previousYearInfo[owner.id] : undefined}
        tenantPreviousYear={previousYearInfo[house.id]}
        onEditOwner={() => setEditing({ kind: "flat", house, role: "owner" })}
        onEditTenant={() => setEditing({ kind: "flat", house, role: "tenant" })}
        onToggleOwnerDisabled={owner ? () => setOwnerDisabled(owner.id, !owner.disabled) : undefined}
        onToggleTenantDisabled={() => setTenantDisabled(house.id, !house.tenantDisabled)}
      />
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or flat number"
          className="w-full rounded-xl border border-border bg-surface-sunken px-3 py-2.5 text-[0.9rem] text-ink outline-none focus:border-brand"
        />
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh — pick up updates from other collectors"
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-border bg-surface-sunken text-ink-soft transition active:scale-95 disabled:opacity-60"
        >
          <RefreshIcon className={`h-[18px] w-[18px] ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
        <span className="shrink-0 text-[0.68rem] font-semibold text-ink-faint">Sort</span>
        {(
          [
            { field: "flat" as const, label: selectedTab === "ex_resident" ? "Name" : "Flat" },
            { field: "lastYear" as const, label: "Last year" },
            { field: "thisYear" as const, label: "This year" },
          ]
        ).map(({ field, label }) => (
          <button
            key={field}
            type="button"
            onClick={() => toggleSort(field)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold transition active:scale-95 ${
              sort.field === field
                ? "bg-brand text-white"
                : "border border-border bg-surface text-ink-soft"
            }`}
          >
            {label}
            {sort.field === field && (sort.dir === "asc" ? " ↑" : " ↓")}
          </button>
        ))}
      </div>

      {searchResults ? (
        <div className="space-y-2.5">
          {searchResults.length === 0 && (exResidentSearchResults?.length ?? 0) === 0 && (
            <p className="rounded-2xl border border-border bg-surface p-3.5 text-[0.8rem] text-ink-faint">
              No matches for &ldquo;{search}&rdquo;.
            </p>
          )}
          {searchResults.map(renderFlatCard)}
          {exResidentSearchResults && exResidentSearchResults.length > 0 && (
            <>
              <p className="mb-2 px-0.5 text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
                Ex Residents
              </p>
              <div className="space-y-2.5">{exResidentSearchResults.map(renderExResidentCard)}</div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
            {allBlocks.map((block) => {
              const known = knownBlocks.includes(block);
              return (
                <button
                  key={block}
                  type="button"
                  disabled={!known}
                  onClick={() => setSelectedTab(block)}
                  title={known ? undefined : `${block} block directory not added yet`}
                  className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl font-display text-[0.85rem] font-bold ${
                    block === selectedTab
                      ? "bg-brand text-white"
                      : "border border-border bg-surface text-ink-soft"
                  } ${known ? "" : "opacity-35"}`}
                >
                  {block}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSelectedTab("ex_resident")}
              className={`flex h-[38px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-3 font-display text-[0.78rem] font-bold ${
                selectedTab === "ex_resident"
                  ? "bg-brand text-white"
                  : "border border-border bg-surface text-ink-soft"
              }`}
            >
              Ex Resident
            </button>
          </div>

          {selectedTab === "ex_resident" ? (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setEditing({ kind: "ex_resident" })}
                className="flex items-center gap-1 rounded-xl bg-brand px-3 py-1.5 text-[0.75rem] font-semibold text-white active:scale-[0.98]"
              >
                <PlusIcon className="h-[13px] w-[13px]" />
                Add ex-resident
              </button>
              {exResidents.length === 0 && (
                <p className="rounded-2xl border border-border bg-surface p-3.5 text-[0.8rem] text-ink-faint">
                  No ex-residents added yet.
                </p>
              )}
              {sortedExResidents.map(renderExResidentCard)}
            </div>
          ) : (
            floors.map(([floor, floorHouses]) => (
              <div key={floor}>
                {sort.field === "flat" && (
                  <p className="mb-2 px-0.5 text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
                    Block {selectedTab} · Floor {floor}
                  </p>
                )}
                <div className="space-y-2.5">{floorHouses.map(renderFlatCard)}</div>
              </div>
            ))
          )}
        </>
      )}

      {editing?.kind === "flat" && (
        <ContributionSheet
          key={`${editing.house.id}-${editing.role}`}
          open
          house={editing.house}
          role={editing.role}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === "ex_resident" && (
        <ExResidentSheet
          key={editing.exResident?.id ?? "new"}
          open
          exResident={editing.exResident}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
