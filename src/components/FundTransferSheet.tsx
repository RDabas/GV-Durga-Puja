"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "@/components/Sheet";
import {
  AmountInput,
  Field,
  FormError,
  OptionGroup,
  SubmitButton,
  TextInput,
} from "@/components/FormControls";
import { formatINR, formatShortDate, today } from "@/lib/format";
import { paymentModeLabels } from "@/lib/payment";
import { usePujaData } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";
import type { TransferMode } from "@/lib/types";

const modeOptions: { value: TransferMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "gpay", label: "GPay" },
  { value: "phonepe", label: "PhonePe" },
  { value: "other_upi", label: "Other UPI" },
];

export function FundTransferSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { members, fundTransfers, addFundTransfer, removeFundTransfer, memberName } =
    usePujaData();
  const [fromMemberId, setFromMemberId] = useState(members[0]?.id ?? "");
  const [toMemberId, setToMemberId] = useState(members[1]?.id ?? members[0]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<TransferMode>("cash");
  const [transferDate, setTransferDate] = useState(today());
  const [note, setNote] = useState("");
  const { submitting, error, run } = useAsyncAction();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const history = [...fundTransfers].sort((a, b) => b.transferDate.localeCompare(a.transferDate));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (amount <= 0 || !fromMemberId || !toMemberId || fromMemberId === toMemberId) return;
    run(
      () =>
        addFundTransfer({
          fromMemberId,
          toMemberId,
          amount,
          mode,
          transferDate,
          note: note.trim() || undefined,
        }),
      () => {
        setAmount(0);
        setNote("");
      },
    );
  }

  async function handleRemove(transferId: string) {
    setRemovingId(transferId);
    setRemoveError(null);
    try {
      await removeFundTransfer(transferId);
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : "Couldn't remove that entry.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Hand over money"
      subtitle="Move collected cash or UPI from one committee member to another"
    >
      <div className="space-y-2">
        {history.length === 0 && (
          <p className="text-[0.75rem] text-ink-faint">Nothing recorded yet.</p>
        )}
        {history.map((transfer) => (
          <div
            key={transfer.id}
            className="flex items-center gap-3 rounded-xl border border-border p-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.86rem] font-semibold text-ink">
                {memberName(transfer.fromMemberId) ?? "Outside"} →{" "}
                {memberName(transfer.toMemberId) ?? "Outside"}
              </span>
              <span className="mt-0.5 block truncate text-[0.7rem] text-ink-faint">
                {formatShortDate(transfer.transferDate)} · {paymentModeLabels[transfer.mode]}
                {transfer.note && ` · ${transfer.note}`}
              </span>
            </span>
            <span className="shrink-0 text-[0.86rem] font-bold tabular-nums text-ink">
              {formatINR(transfer.amount)}
            </span>
            <button
              type="button"
              onClick={() => handleRemove(transfer.id)}
              disabled={removingId === transfer.id}
              className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[0.72rem] font-semibold text-ink-soft disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
        <FormError message={removeError} />
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 border-t border-border pt-5">
        <Field label="From">
          <OptionGroup
            value={fromMemberId}
            onChange={setFromMemberId}
            options={members.map((m) => ({ value: m.id, label: m.name }))}
          />
        </Field>

        <Field label="To">
          <OptionGroup
            value={toMemberId}
            onChange={setToMemberId}
            options={members.map((m) => ({ value: m.id, label: m.name }))}
          />
        </Field>

        {fromMemberId && fromMemberId === toMemberId && (
          <p className="text-[0.75rem] text-critical">From and To must be different people.</p>
        )}

        <Field label="Amount">
          <AmountInput value={amount} onChange={setAmount} />
        </Field>

        <Field label="Mode">
          <OptionGroup value={mode} onChange={setMode} options={modeOptions} />
        </Field>

        <Field label="Date">
          <TextInput
            type="date"
            value={transferDate}
            onChange={(e) => setTransferDate(e.target.value)}
          />
        </Field>

        <Field label="Note">
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <FormError message={error} />
        <SubmitButton disabled={submitting} submitting={submitting}>
          Record hand-over
        </SubmitButton>
      </form>
    </Sheet>
  );
}
