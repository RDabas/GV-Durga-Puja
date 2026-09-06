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
import { usePujaData } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";
import { today } from "@/lib/format";
import type { PaymentInput } from "@/lib/store";
import type { PaymentMode } from "@/lib/types";

const modeOptions: { value: PaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "gpay", label: "GPay" },
  { value: "phonepe", label: "PhonePe" },
  { value: "other_upi", label: "Other UPI" },
];

/**
 * Sponsor money in and vendor money out record the same fields — including
 * which committee member's hand it passed through, so it moves their balance
 * in hand the same way a resident contribution or fund transfer does.
 */
export function PaymentSheet({
  open,
  title,
  subtitle,
  memberLabel,
  allowSelfFunded,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  /** e.g. "Received by" for a sponsor, "Paid by" for a vendor. */
  memberLabel: string;
  /** Vendor payments only — a committee member who is also a resident can pay a bill straight out of their own pocket. */
  allowSelfFunded?: boolean;
  onSubmit: (input: PaymentInput) => Promise<void>;
  onClose: () => void;
}) {
  const { members } = usePujaData();
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [paymentDate, setPaymentDate] = useState(today());
  const [note, setNote] = useState("");
  const [selfFunded, setSelfFunded] = useState(false);
  const { submitting, error, run } = useAsyncAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (amount <= 0 || !memberId) return;
    run(
      () =>
        onSubmit({
          amount,
          mode,
          memberId,
          paymentDate,
          note: note.trim() || undefined,
          selfFunded: allowSelfFunded ? selfFunded : undefined,
        }),
      () => {
        setAmount(0);
        setNote("");
        setSelfFunded(false);
        onClose();
      },
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Amount">
          <AmountInput value={amount} onChange={setAmount} autoFocus />
        </Field>

        <Field label="Method">
          <OptionGroup value={mode} onChange={setMode} options={modeOptions} />
        </Field>

        <Field label={memberLabel}>
          <OptionGroup
            value={memberId}
            onChange={setMemberId}
            options={members.map((m) => ({ value: m.id, label: m.name }))}
          />
        </Field>

        <Field label="Date">
          <TextInput
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </Field>

        <Field label="Note">
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        {allowSelfFunded && (
          <label className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-sunken p-3">
            <input
              type="checkbox"
              checked={selfFunded}
              onChange={(e) => setSelfFunded(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
            />
            <span className="text-[0.8rem] text-ink-soft">
              Paid from their own pocket, not committee cash — won&rsquo;t count against their
              balance in hand.
            </span>
          </label>
        )}

        <FormError message={error} />
        <SubmitButton disabled={submitting} submitting={submitting}>Record payment</SubmitButton>
      </form>
    </Sheet>
  );
}
