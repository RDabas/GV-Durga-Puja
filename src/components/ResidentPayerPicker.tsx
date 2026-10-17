"use client";

import { useState } from "react";
import { TextInput } from "@/components/FormControls";
import type { PujaStore } from "@/lib/store";
import { usePujaData } from "@/lib/store";
import type { Contribution } from "@/lib/types";

export interface ResidentPayerSelection {
  contributionId: string;
  label: string;
}

/** "B-204 — Tenant Name" / "Owner Name(s) (Owner)" / "Names (Ex Resident)" — same label format the search results below use, for pre-filling an already-linked payer when editing. */
export function residentPayerLabel(
  store: Pick<PujaStore, "houses" | "owners" | "exResidents">,
  contribution: Contribution,
): string {
  if (contribution.houseId) {
    const h = store.houses.find((x) => x.id === contribution.houseId);
    return h ? `${h.block}-${h.flatNo} — ${h.tenantNames.join(", ") || "Tenant"}` : "a flat";
  }
  if (contribution.ownerId) {
    const o = store.owners.find((x) => x.id === contribution.ownerId);
    return `${o?.names.join(", ") ?? "Owner"} (Owner)`;
  }
  if (contribution.exResidentId) {
    const r = store.exResidents.find((x) => x.id === contribution.exResidentId);
    return `${r?.names.join(", ") ?? "Ex Resident"} (Ex Resident)`;
  }
  return "a resident";
}

/**
 * Search-and-pick a resident (flat, owner, or ex-resident) to attribute a
 * vendor payment to directly — used when a resident pays a vendor out of
 * their own pocket instead of handing cash/UPI to a collector. Only payers
 * who already have a pledge on record (a Contribution row) can be picked,
 * since there's nothing to settle otherwise — unrecorded ones show as
 * unselectable with a hint to record their pledge on the Collect tab first.
 */
export function ResidentPayerPicker({
  value,
  onChange,
}: {
  value: ResidentPayerSelection | null;
  onChange: (selection: ResidentPayerSelection | null) => void;
}) {
  const { houses, owners, exResidents, contributionFor, ownerOf } = usePujaData();
  const [search, setSearch] = useState("");

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-sunken p-3">
        <span className="min-w-0 flex-1 truncate text-[0.82rem] font-semibold text-ink">
          {value.label}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 text-[0.72rem] font-semibold text-brand"
        >
          Change
        </button>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const results: { key: string; label: string; contribution: Contribution | undefined }[] = !q
    ? []
    : [
        // A flat's own contribution is only ever the tenant's — an
        // owner-occupied flat (or one where it's the owner, not the
        // tenant, who's settling this) has its pledge recorded against
        // the owner instead, so a flat match surfaces both rows whenever
        // they exist rather than only ever checking the tenant one.
        ...houses
          .filter(
            (h) =>
              h.flatNo.toLowerCase().includes(q) ||
              `${h.block}-${h.flatNo}`.toLowerCase().includes(q) ||
              h.tenantNames.some((n) => n.toLowerCase().includes(q)),
          )
          .slice(0, 8)
          .flatMap((h) => {
            const owner = ownerOf(h);
            const rows: { key: string; label: string; contribution: Contribution | undefined }[] = [];
            if (h.tenantNames.length > 0) {
              rows.push({
                key: `h-${h.id}-tenant`,
                label: `${h.block}-${h.flatNo} — ${h.tenantNames.join(", ")} (Tenant)`,
                contribution: contributionFor({ houseId: h.id }),
              });
            }
            if (owner) {
              rows.push({
                key: `h-${h.id}-owner`,
                label: `${h.block}-${h.flatNo} — ${owner.names.join(", ")} (Owner)`,
                contribution: contributionFor({ ownerId: owner.id }),
              });
            }
            if (rows.length === 0) {
              rows.push({ key: `h-${h.id}`, label: `${h.block}-${h.flatNo}`, contribution: undefined });
            }
            return rows;
          }),
        ...owners
          .filter((o) => o.names.some((n) => n.toLowerCase().includes(q)))
          .slice(0, 8)
          .map((o) => ({
            key: `o-${o.id}`,
            label: `${o.names.join(", ")} (Owner)`,
            contribution: contributionFor({ ownerId: o.id }),
          })),
        ...exResidents
          .filter((r) => r.names.some((n) => n.toLowerCase().includes(q)))
          .slice(0, 8)
          .map((r) => ({
            key: `e-${r.id}`,
            label: `${r.names.join(", ")} (Ex Resident)`,
            contribution: contributionFor({ exResidentId: r.id }),
          })),
      ];

  return (
    <div className="space-y-2">
      <TextInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or flat number"
        autoFocus
      />
      {results.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-xl border border-border">
          {results.map((r) => (
            <button
              key={r.key}
              type="button"
              disabled={!r.contribution}
              onClick={() =>
                r.contribution && onChange({ contributionId: r.contribution.id, label: r.label })
              }
              className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-[0.8rem] text-ink last:border-b-0 disabled:opacity-40"
            >
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              {!r.contribution && (
                <span className="shrink-0 text-[0.66rem] text-ink-faint">no pledge yet</span>
              )}
            </button>
          ))}
        </div>
      )}
      {q && results.length === 0 && (
        <p className="px-0.5 text-[0.75rem] text-ink-faint">No match found.</p>
      )}
    </div>
  );
}
