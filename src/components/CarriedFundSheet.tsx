"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "@/components/Sheet";
import { AmountInput, Field, OptionGroup, SubmitButton, TextInput } from "@/components/FormControls";
import { formatINR } from "@/lib/format";
import { carriedFundKindLabels } from "@/lib/carriedFund";
import { usePujaData } from "@/lib/store";
import type { CarriedFundKind } from "@/lib/types";

const kindOptions: { value: CarriedFundKind; label: string }[] = [
  { value: "cash", label: "Cash in hand" },
  { value: "fd", label: "Bank FD" },
  { value: "bank", label: "Bank account" },
];

export function CarriedFundSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { members, carriedFunds, addCarriedFund, removeCarriedFund, memberName } = usePujaData();
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [kind, setKind] = useState<CarriedFundKind>("cash");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (amount <= 0 || !memberId) return;
    addCarriedFund({ memberId, kind, amount, note: note.trim() || undefined });
    setAmount(0);
    setNote("");
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Previous year fund"
      subtitle="Cash, FD, or bank money a collector was still holding when this year opened"
    >
      <div className="space-y-2">
        {carriedFunds.length === 0 && (
          <p className="text-[0.75rem] text-ink-faint">Nothing recorded yet.</p>
        )}
        {carriedFunds.map((fund) => (
          <div
            key={fund.id}
            className="flex items-center gap-3 rounded-xl border border-border p-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.86rem] font-semibold text-ink">
                {memberName(fund.memberId)} · {carriedFundKindLabels[fund.kind]}
              </span>
              {fund.note && (
                <span className="mt-0.5 block truncate text-[0.7rem] text-ink-faint">
                  {fund.note}
                </span>
              )}
            </span>
            <span className="shrink-0 text-[0.86rem] font-bold tabular-nums text-ink">
              {formatINR(fund.amount)}
            </span>
            <button
              type="button"
              onClick={() => removeCarriedFund(fund.id)}
              className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[0.72rem] font-semibold text-ink-soft"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 border-t border-border pt-5">
        <Field label="Held by">
          <OptionGroup
            value={memberId}
            onChange={setMemberId}
            options={members.map((m) => ({ value: m.id, label: m.name }))}
          />
        </Field>
        <Field label="Where">
          <OptionGroup value={kind} onChange={setKind} options={kindOptions} />
        </Field>
        <Field label="Amount">
          <AmountInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="Note">
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. bank name, FD maturity date"
          />
        </Field>
        <SubmitButton>Add</SubmitButton>
      </form>
    </Sheet>
  );
}
