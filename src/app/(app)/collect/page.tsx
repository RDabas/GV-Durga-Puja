"use client";

import { useMemo, useState } from "react";
import { ContributionSheet } from "@/components/ContributionSheet";
import { FlatCard } from "@/components/FlatCard";
import { knownBlocks } from "@/lib/directory";
import { usePujaData } from "@/lib/store";
import type { Block, House } from "@/lib/types";

const allBlocks: Block[] = ["A", "B", "C", "D", "E", "F", "G"];

export default function CollectPage() {
  const {
    houses,
    contributionFor,
    ownerOf,
    ownerFlatCount,
    previousYearInfo,
    memberName,
  } = usePujaData();
  const [selectedBlock, setSelectedBlock] = useState<Block>(knownBlocks[0] ?? "A");
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

  return (
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
          <div className="space-y-2.5">
            {floorHouses.map((house) => {
              const owner = ownerOf(house);
              const ownerContribution = owner
                ? contributionFor({ ownerId: owner.id })
                : undefined;
              const tenantContribution = contributionFor({ houseId: house.id });
              return (
                <FlatCard
                  key={house.id}
                  house={house}
                  owner={owner}
                  ownerFlatCount={owner ? ownerFlatCount(owner.id) : 0}
                  ownerContribution={ownerContribution}
                  tenantContribution={tenantContribution}
                  ownerCollector={memberName(ownerContribution?.collectorId)}
                  tenantCollector={memberName(tenantContribution?.collectorId)}
                  ownerAssignedTo={
                    memberName(ownerContribution?.assignedToMemberId) ??
                    ownerContribution?.assignedToName
                  }
                  tenantAssignedTo={
                    memberName(tenantContribution?.assignedToMemberId) ??
                    tenantContribution?.assignedToName
                  }
                  ownerPreviousYear={owner ? previousYearInfo[owner.id] : undefined}
                  tenantPreviousYear={previousYearInfo[house.id]}
                  onEditOwner={() => setEditing({ house, role: "owner" })}
                  onEditTenant={() => setEditing({ house, role: "tenant" })}
                />
              );
            })}
          </div>
        </div>
      ))}

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
