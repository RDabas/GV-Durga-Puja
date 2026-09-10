"use client";

import { useMemo, useState } from "react";
import { ContributionSheet } from "@/components/ContributionSheet";
import { FlatCard } from "@/components/FlatCard";
import { knownBlocks } from "@/lib/directory";
import { usePujaData } from "@/lib/store";
import type { Block, Contribution, House } from "@/lib/types";

const allBlocks: Block[] = ["A", "B", "C", "D", "E", "F", "G"];

function assignedToLabel(
  contribution: Contribution | undefined,
  memberName: (memberId?: string) => string | undefined,
): string | undefined {
  return memberName(contribution?.assignedToMemberId) ?? contribution?.assignedToName;
}

export default function CollectPage() {
  const {
    houses,
    contributionFor,
    ownerOf,
    ownerFlatCount,
    ownerPrimaryHouse,
    previousYearInfo,
    memberName,
    setOwnerDisabled,
  } = usePujaData();
  const [selectedBlock, setSelectedBlock] = useState<Block>(knownBlocks[0] ?? "A");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ house: House; role: "owner" | "tenant" } | null>(
    null,
  );

  const floors = useMemo(() => {
    const inBlock = houses.filter((h) => h.block === selectedBlock);
    const byFloor = new Map<number, House[]>();
    for (const house of inBlock) {
      const list = byFloor.get(house.floor) ?? [];
      list.push(house);
      byFloor.set(house.floor, list);
    }
    return [...byFloor.entries()].sort((a, b) => b[0] - a[0]);
  }, [houses, selectedBlock]);

  // Non-null only while the search box has text — searches every block, not
  // just the selected one, since the resident might be in a block you're not
  // currently looking at.
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return houses
      .filter((h) => {
        const owner = ownerOf(h);
        return (
          h.flatNo.toLowerCase().includes(q) ||
          `${h.block}-${h.flatNo}`.toLowerCase().includes(q) ||
          h.tenantNames.some((n) => n.toLowerCase().includes(q)) ||
          (owner?.names.some((n) => n.toLowerCase().includes(q)) ?? false)
        );
      })
      .sort(
        (a, b) =>
          a.block.localeCompare(b.block) || a.floor - b.floor || a.flatNo.localeCompare(b.flatNo),
      );
  }, [search, houses, ownerOf]);

  function renderFlatCard(house: House) {
    const owner = ownerOf(house);
    const ownerContribution = owner ? contributionFor({ ownerId: owner.id }) : undefined;
    const tenantContribution = contributionFor({ houseId: house.id });
    const primaryHouse = owner ? ownerPrimaryHouse(owner.id) : undefined;
    const isPrimaryOwnerFlat = !owner || !primaryHouse || primaryHouse.id === house.id;
    return (
      <FlatCard
        key={house.id}
        house={house}
        owner={owner}
        ownerFlatCount={owner ? ownerFlatCount(owner.id) : 0}
        isPrimaryOwnerFlat={isPrimaryOwnerFlat}
        primaryFlatLabel={primaryHouse ? `${primaryHouse.block}-${primaryHouse.flatNo}` : undefined}
        ownerContribution={ownerContribution}
        tenantContribution={tenantContribution}
        ownerCollector={memberName(ownerContribution?.collectorId)}
        tenantCollector={memberName(tenantContribution?.collectorId)}
        ownerAssignedTo={assignedToLabel(ownerContribution, memberName)}
        tenantAssignedTo={assignedToLabel(tenantContribution, memberName)}
        ownerPreviousYear={owner ? previousYearInfo[owner.id] : undefined}
        tenantPreviousYear={previousYearInfo[house.id]}
        onEditOwner={() => setEditing({ house, role: "owner" })}
        onEditTenant={() => setEditing({ house, role: "tenant" })}
        onToggleOwnerDisabled={owner ? () => setOwnerDisabled(owner.id, !owner.disabled) : undefined}
      />
    );
  }

  return (
    <>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or flat number"
        className="w-full rounded-xl border border-border bg-surface-sunken px-3 py-2.5 text-[0.9rem] text-ink outline-none focus:border-brand"
      />

      {searchResults ? (
        <div className="space-y-2.5">
          {searchResults.length === 0 && (
            <p className="rounded-2xl border border-border bg-surface p-3.5 text-[0.8rem] text-ink-faint">
              No matches for &ldquo;{search}&rdquo;.
            </p>
          )}
          {searchResults.map(renderFlatCard)}
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
                  onClick={() => setSelectedBlock(block)}
                  title={known ? undefined : `${block} block directory not added yet`}
                  className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl font-display text-[0.85rem] font-bold ${
                    block === selectedBlock
                      ? "bg-brand text-white"
                      : "border border-border bg-surface text-ink-soft"
                  } ${known ? "" : "opacity-35"}`}
                >
                  {block}
                </button>
              );
            })}
          </div>

          {floors.map(([floor, floorHouses]) => (
            <div key={floor}>
              <p className="mb-2 px-0.5 text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
                Block {selectedBlock} · Floor {floor}
              </p>
              <div className="space-y-2.5">{floorHouses.map(renderFlatCard)}</div>
            </div>
          ))}
        </>
      )}

      {editing && (
        <ContributionSheet
          key={`${editing.house.id}-${editing.role}`}
          open
          house={editing.house}
          role={editing.role}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
