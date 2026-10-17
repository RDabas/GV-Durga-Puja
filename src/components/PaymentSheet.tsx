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
import {
  residentPayerLabel,
  ResidentPayerPicker,
  type ResidentPayerSelection,
} from "@/components/ResidentPayerPicker";
import { usePujaData } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";
import { today } from "@/lib/format";
import { modeOptions } from "@/lib/contributionForm";
import type { ScannedPayment } from "@/lib/scanPayment";
import type { PaymentInput } from "@/lib/store";
import type { PaymentMode } from "@/lib/types";

/**
 * Vendor money out (and, previously, sponsor money in) records the same
 * fields — including which committee member's hand it passed through, so it
 * moves their balance in hand the same way a resident contribution or fund
 * transfer does. Also used to correct a payment entered wrong: pass
 * `payment` to pre-fill and edit it in place instead of recording a new one.
 */
export function PaymentSheet({
  open,
  title,
  subtitle,
  memberLabel,
  allowSelfFunded,
  payment,
  initialScan,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  /** e.g. "Received by" for a sponsor, "Paid by" for a vendor. */
  memberLabel: string;
  /** Vendor payments only — a committee member who is also a resident can pay a bill straight out of their own pocket, or a resident can pay the vendor directly (see ResidentPayerPicker). */
  allowSelfFunded?: boolean;
  /** Present to edit an existing payment in place; absent to record a new one. An id lets a resident-direct payment resolve which pledge it's already linked to. */
  payment?: PaymentInput & { id?: string };
  /** Pre-fills amount/mode/date, from a payment screenshot scanned before this sheet opened (see the "Scan payment" button on the Vendors page). */
  initialScan?: ScannedPayment;
  onSubmit: (input: PaymentInput) => Promise<void>;
  onClose: () => void;
}) {
  const store = usePujaData();
  const { members, contributions, contributionPayments } = store;
  const [amount, setAmount] = useState(payment?.amount ?? initialScan?.amount ?? 0);
  const [mode, setMode] = useState<PaymentMode>(payment?.mode ?? initialScan?.mode ?? "upi");
  const [memberId, setMemberId] = useState(payment?.memberId ?? members[0]?.id ?? "");
  const [paymentDate, setPaymentDate] = useState(
    payment?.paymentDate ?? initialScan?.paymentDate ?? today(),
  );
  const [note, setNote] = useState(payment?.note ?? "");
  const [selfFunded, setSelfFunded] = useState(payment?.selfFunded ?? false);

  // A payment being edited with no memberId was paid by a resident directly
  // — resolve which pledge it's already linked to, via the matching
  // contribution_payments row, so the picker opens pre-filled instead of
  // forcing the correction to start the search over.
  const existingLink = payment?.id
    ? contributionPayments.find((p) => p.vendorPaymentId === payment.id)
    : undefined;
  const existingLinkedContribution = existingLink
    ? contributions.find((c) => c.id === existingLink.contributionId)
    : undefined;
  const [payerKind, setPayerKind] = useState<"member" | "resident">(
    payment && !payment.memberId ? "resident" : "member",
  );
  const existingLinkedSelection: ResidentPayerSelection | null = existingLinkedContribution
    ? { contributionId: existingLinkedContribution.id, label: residentPayerLabel(store, existingLinkedContribution) }
    : null;
  const [residentPayer, setResidentPayer] = useState<ResidentPayerSelection | null>(
    payment && !payment.memberId ? existingLinkedSelection : null,
  );
  // A committee member can self-fund a vendor payment that settles their own
  // (or anyone else's) pledge directly — distinct from the "resident
  // directly" toggle above, since here a committee member still physically
  // handed the money to the vendor, it just didn't come out of committee cash.
  const [settledPledge, setSettledPledge] = useState<ResidentPayerSelection | null>(
    payment && payment.memberId ? existingLinkedSelection : null,
  );
  const { submitting, error, run } = useAsyncAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (amount <= 0) return;
    if (payerKind === "resident" ? !residentPayer : !memberId) return;
    const contributionId =
      payerKind === "resident"
        ? residentPayer?.contributionId
        : selfFunded
          ? settledPledge?.contributionId
          : undefined;
    run(
      () =>
        onSubmit({
          amount,
          mode,
          memberId: payerKind === "resident" ? undefined : memberId,
          contributionId,
          paymentDate,
          note: note.trim() || undefined,
          selfFunded: allowSelfFunded && payerKind === "member" ? selfFunded : undefined,
        }),
      () => {
        setAmount(0);
        setNote("");
        setSelfFunded(false);
        setSettledPledge(null);
        onClose();
      },
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {initialScan && (
          <p className="text-[0.75rem] text-ink-faint">Scanned — check the details below.</p>
        )}

        <Field label="Amount">
          <AmountInput value={amount} onChange={setAmount} autoFocus />
        </Field>

        <Field label="Method">
          <OptionGroup value={mode} onChange={setMode} options={modeOptions} />
        </Field>

        {allowSelfFunded && (
          <Field label="Paid by">
            <OptionGroup
              value={payerKind}
              onChange={setPayerKind}
              options={[
                { value: "member", label: "A committee member" },
                { value: "resident", label: "A resident directly" },
              ]}
            />
          </Field>
        )}

        {payerKind === "resident" ? (
          <Field label="Which resident">
            <ResidentPayerPicker value={residentPayer} onChange={setResidentPayer} />
          </Field>
        ) : (
          <Field label={memberLabel}>
            <OptionGroup
              value={memberId}
              onChange={setMemberId}
              options={members.map((m) => ({ value: m.id, label: m.name }))}
            />
          </Field>
        )}

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

        {allowSelfFunded && payerKind === "member" && (
          <>
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
            {selfFunded && (
              <Field label="Settles a resident's pledge? (optional)">
                <ResidentPayerPicker value={settledPledge} onChange={setSettledPledge} />
              </Field>
            )}
          </>
        )}

        {payerKind === "resident" && (
          <p className="text-[0.75rem] text-ink-faint">
            Settles part of their pledge directly — won&rsquo;t count against any committee
            member&rsquo;s balance in hand.
          </p>
        )}

        <FormError message={error} />
        <SubmitButton disabled={submitting} submitting={submitting}>
          {payment ? "Save" : "Record payment"}
        </SubmitButton>
      </form>
    </Sheet>
  );
}
