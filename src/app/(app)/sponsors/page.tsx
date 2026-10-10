"use client";

import { useState } from "react";
import { OutsideCollectionCard } from "@/components/OutsideCollectionCard";
import { OutsideCollectionSheet } from "@/components/OutsideCollectionSheet";
import { PlusIcon } from "@/components/icons";
import { statusRank } from "@/components/FlatCard";
import { usePujaData } from "@/lib/store";
import type { Contribution, OutsideCollection } from "@/lib/types";

/** Current-year figure for an entry — same paid/partial/promised convention used elsewhere, plus any Bhog/groceries value regardless of money status. */
function amountFor(contribution: Contribution | undefined): number {
  if (!contribution) return 0;
  const money =
    contribution.status === "paid" ||
    contribution.status === "partial" ||
    contribution.status === "promised"
      ? contribution.moneyAmount
      : 0;
  return money + contribution.bhogGroceryAmount;
}

export default function OutsideCollectionPage() {
  const { outsideCollections, contributionFor, memberName, setOutsideCollectionDisabled } =
    usePujaData();
  const [editing, setEditing] = useState<{ outsideCollection?: OutsideCollection } | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ field: "name" | "amount" | "status"; dir: "asc" | "desc" }>({
    field: "name",
    dir: "asc",
  });

  function toggleSort(field: "name" | "amount" | "status") {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: field === "name" ? "asc" : "desc" },
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? outsideCollections.filter((entry) => entry.name.toLowerCase().includes(q))
    : outsideCollections;

  const dir = sort.dir === "asc" ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    if (sort.field === "amount") {
      return (
        dir *
        (amountFor(contributionFor({ outsideCollectionId: a.id })) -
          amountFor(contributionFor({ outsideCollectionId: b.id })))
      );
    }
    if (sort.field === "status") {
      const aRank = statusRank.indexOf(contributionFor({ outsideCollectionId: a.id })?.status ?? "not_visited");
      const bRank = statusRank.indexOf(contributionFor({ outsideCollectionId: b.id })?.status ?? "not_visited");
      return dir * (aRank - bRank);
    }
    return dir * a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="px-0.5 text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
          Outside Collection
        </p>
        <button
          type="button"
          onClick={() => setEditing({})}
          className="flex items-center gap-1 rounded-xl bg-brand px-3 py-1.5 text-[0.75rem] font-semibold text-white active:scale-[0.98]"
        >
          <PlusIcon className="h-[13px] w-[13px]" />
          Add
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name"
        className="w-full rounded-xl border border-border bg-surface-sunken px-3 py-2.5 text-[0.9rem] text-ink outline-none focus:border-brand"
      />

      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
        <span className="shrink-0 text-[0.68rem] font-semibold text-ink-faint">Sort</span>
        {(
          [
            { field: "name" as const, label: "Name" },
            { field: "amount" as const, label: "Amount" },
            { field: "status" as const, label: "Status" },
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

      {sorted.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-3.5 text-[0.8rem] text-ink-faint">
          {q ? `No matches for "${search}".` : "Nothing added yet."}
        </p>
      )}

      {sorted.map((entry) => {
        const contribution = contributionFor({ outsideCollectionId: entry.id });
        return (
          <OutsideCollectionCard
            key={entry.id}
            outsideCollection={entry}
            contribution={contribution}
            collectorName={memberName(contribution?.collectorId)}
            assignedToName={
              memberName(contribution?.assignedToMemberId) ?? contribution?.assignedToName
            }
            onEdit={() => setEditing({ outsideCollection: entry })}
            onToggleDisabled={() => setOutsideCollectionDisabled(entry.id, !entry.disabled)}
          />
        );
      })}

      {editing && (
        <OutsideCollectionSheet
          key={editing.outsideCollection?.id ?? "new"}
          open
          outsideCollection={editing.outsideCollection}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
