"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "@/components/Sheet";
import { AmountInput, Field, FormError, OptionGroup, SubmitButton, TextInput } from "@/components/FormControls";
import { modeOptions } from "@/lib/contributionForm";
import { today } from "@/lib/format";
import { usePujaData, type ContributionPaymentInput } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";
import type { PaymentMode } from "@/lib/types";

/**
 * Records an extra installment against a pledge already partly/fully paid —
 * e.g. part cash to one collector, part UPI to another, for the same flat.
 * Kept separate from the primary payment recorded in ContributionSheet,
 * which still covers the common single-payment case unchanged.
 */
export function SplitPaymentSheet({
  open,
  payerName,
  onSubmit,
  onClose,
}: {
  open: boolean;
  payerName: string;
  onSubmit: (input: ContributionPaymentInput) => Promise<void>;
  onClose: () => void;
}) {
  const { members } = usePujaData();
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<PaymentMode>("upi");
  const [collectorId, setCollectorId] = useState(members[0]?.id ?? "");
  const [paymentDate, setPaymentDate] = useState(today());
  const [note, setNote] = useState("");
  const { submitting, error, run } = useAsyncAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (amount <= 0 || !collectorId) return;
    run(
      () => onSubmit({ amount, mode, collectorId, paymentDate, note: note.trim() || undefined }),
      () => {
        setAmount(0);
        setNote("");
        onClose();
      },
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title="Split payment" subtitle={payerName}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-[0.75rem] text-ink-faint">
          An extra installment on top of what&rsquo;s already recorded — e.g. part of this
          payment went to a different collector or came in a different way.
        </p>

        <Field label="Amount">
          <AmountInput value={amount} onChange={setAmount} autoFocus />
        </Field>

        <Field label="Method">
          <OptionGroup value={mode} onChange={setMode} options={modeOptions} />
        </Field>

        <Field label="Collected by">
          <OptionGroup
            value={collectorId}
            onChange={setCollectorId}
            options={members.map((m) => ({ value: m.id, label: m.name }))}
          />
        </Field>

        <Field label="Date">
          <TextInput type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        </Field>

        <Field label="Note">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </Field>

        <FormError message={error} />
        <SubmitButton disabled={submitting} submitting={submitting}>
          Add installment
        </SubmitButton>
      </form>
    </Sheet>
  );
}
