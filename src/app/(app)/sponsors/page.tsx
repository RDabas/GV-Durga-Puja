"use client";

import { useState } from "react";
import { OutsideCollectionCard } from "@/components/OutsideCollectionCard";
import { OutsideCollectionSheet } from "@/components/OutsideCollectionSheet";
import { PlusIcon } from "@/components/icons";
import { usePujaData } from "@/lib/store";
import type { OutsideCollection } from "@/lib/types";

export default function OutsideCollectionPage() {
  const { outsideCollections, contributionFor, memberName, setOutsideCollectionDisabled } =
    usePujaData();
  const [editing, setEditing] = useState<{ outsideCollection?: OutsideCollection } | null>(null);

  const sorted = [...outsideCollections].sort((a, b) => a.name.localeCompare(b.name));

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

      {sorted.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-3.5 text-[0.8rem] text-ink-faint">
          Nothing added yet.
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
