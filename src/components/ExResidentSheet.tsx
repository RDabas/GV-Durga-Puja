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
import {
  amountFieldLabel,
  bhogOnlyHint,
  followUpNoteLabel,
  followUpNotePlaceholder,
  modeOptions,
  originalPledgeFieldLabel,
  originalPledgeHelpText,
  statusOptions,
} from "@/lib/contributionForm";
import type { ContributionStatus, ExResident, PaymentMode } from "@/lib/types";

/**
 * Add or edit an Ex Resident — someone not tied to any flat or block who
 * still contributes. Mirrors ContributionSheet's owner-role fields exactly
 * (status/amount/mode/collector/follow-up), minus flat-specific concerns
 * like "paid via another flat" linking or a flat-count hint.
 */
export function ExResidentSheet({
  exResident,
  open,
  onClose,
}: {
  /** Present to edit an existing ex-resident; absent to add a new one. */
  exResident?: ExResident;
  open: boolean;
  onClose: () => void;
}) {
  const { saveExResident, saveContribution, contributionFor, members } = usePujaData();

  const contribution = exResident ? contributionFor({ exResidentId: exResident.id }) : undefined;

  const [names, setNames] = useState((exResident?.names ?? []).join(", "));
  const [status, setStatus] = useState<ContributionStatus>(contribution?.status ?? "paid");
  const [mode, setMode] = useState<PaymentMode>(
    !contribution || contribution.paymentMode === "pending" ? "upi" : contribution.paymentMode,
  );
  const [moneyAmount, setMoneyAmount] = useState(contribution?.moneyAmount ?? 0);
  const [originalPledgeAmount, setOriginalPledgeAmount] = useState(
    contribution?.originalPledgeAmount ?? 0,
  );
  const [hasBhog, setHasBhog] = useState((contribution?.bhogGroceryAmount ?? 0) > 0);
  const [bhogAmount, setBhogAmount] = useState(contribution?.bhogGroceryAmount ?? 0);
  const [collectorId, setCollectorId] = useState(
    contribution?.collectorId ?? members.find((m) => m.name === "Hirdesh")?.id ?? members[0]?.id ?? "",
  );
  const [paymentDate, setPaymentDate] = useState(contribution?.paymentDate ?? today());
  const [note, setNote] = useState(contribution?.note ?? "");
  const [followUpNote, setFollowUpNote] = useState(contribution?.followUpNote ?? "");
  const [assignedTo, setAssignedTo] = useState(
    contribution?.assignedToMemberId ?? (contribution?.assignedToName ? "other" : ""),
  );
  const [assignedToName, setAssignedToName] = useState(contribution?.assignedToName ?? "");

  const received = status === "paid" || status === "partial";
  const promised = status === "promised";
  const partial = status === "partial";
  const needsFollowUp = status === "not_home" || status === "not_visited" || status === "pending";
  const { submitting, error, run } = useAsyncAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const parsed = names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);

    const finalMoneyAmount = received || promised ? moneyAmount : 0;
    const finalBhogAmount = hasBhog ? bhogAmount : 0;
    const handedOver = received || hasBhog;

    run(async () => {
      if (parsed.length === 0) throw new Error("Enter at least one name");
      const exResidentId = await saveExResident(exResident?.id, parsed);

      await saveContribution(
        { exResidentId },
        {
          collectorId: handedOver ? collectorId : undefined,
          assignedToMemberId:
            needsFollowUp && assignedTo && assignedTo !== "other" ? assignedTo : undefined,
          assignedToName:
            needsFollowUp && assignedTo === "other" ? assignedToName.trim() || undefined : undefined,
          moneyAmount: finalMoneyAmount,
          originalPledgeAmount:
            (promised || partial) && originalPledgeAmount > moneyAmount
              ? originalPledgeAmount
              : undefined,
          bhogGroceryAmount: finalBhogAmount,
          contributionKind:
            finalMoneyAmount > 0 && finalBhogAmount > 0
              ? "both"
              : finalBhogAmount > 0
                ? "bhog_grocery"
                : "money",
          paymentMode: received ? mode : "pending",
          status,
          paymentDate: handedOver ? paymentDate : undefined,
          note: note.trim() || undefined,
          followUpNote: followUpNote.trim() || undefined,
        },
      );
    }, onClose);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={exResident ? exResident.names.join(", ") : "New ex-resident"}
      subtitle="Ex Resident · not tied to any flat"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name(s)">
          <TextInput
            value={names}
            onChange={(e) => setNames(e.target.value)}
            placeholder="Separate several names with commas"
            autoFocus
          />
        </Field>

        <Field label="Status">
          <OptionGroup value={status} onChange={setStatus} options={statusOptions} />
        </Field>

        {(received || promised) && (
          <Field label={amountFieldLabel(status, originalPledgeAmount)}>
            <AmountInput value={moneyAmount} onChange={setMoneyAmount} autoFocus={received} />
            <p className="mt-1.5 text-[0.72rem] text-ink-faint">{bhogOnlyHint}</p>
          </Field>
        )}

        {(promised || partial) && (
          <Field label={originalPledgeFieldLabel(status)}>
            <AmountInput value={originalPledgeAmount} onChange={setOriginalPledgeAmount} />
            <p className="mt-1.5 text-[0.72rem] text-ink-faint">{originalPledgeHelpText(status)}</p>
          </Field>
        )}

        {status !== "not_visited" && (
          <>
            <label className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-sunken p-3">
              <input
                type="checkbox"
                checked={hasBhog}
                onChange={(e) => setHasBhog(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
              />
              <span className="text-[0.8rem] text-ink-soft">
                Also brought Bhog / groceries, on top of (or instead of) money — even if the
                money itself is still pending.
              </span>
            </label>

            {hasBhog && (
              <Field label="Bhog / groceries value">
                <AmountInput value={bhogAmount} onChange={setBhogAmount} />
              </Field>
            )}
          </>
        )}

        {(received || hasBhog) && (
          <>
            <Field label="Paid by">
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
          </>
        )}

        {(status === "promised" || status === "wont_pay" || needsFollowUp) && (
          <Field label={followUpNoteLabel(status)}>
            <TextInput
              value={followUpNote}
              onChange={(e) => setFollowUpNote(e.target.value)}
              placeholder={followUpNotePlaceholder(status)}
            />
          </Field>
        )}

        {needsFollowUp && (
          <>
            <Field label="Assign follow-up to">
              <OptionGroup
                value={assignedTo}
                onChange={setAssignedTo}
                options={[
                  { value: "", label: "Unassigned" },
                  ...members.map((m) => ({ value: m.id, label: m.name })),
                  { value: "other", label: "Someone else" },
                ]}
              />
            </Field>

            {assignedTo === "other" && (
              <Field label="Name">
                <TextInput
                  value={assignedToName}
                  onChange={(e) => setAssignedToName(e.target.value)}
                  placeholder="e.g. a family member or the guard"
                  autoFocus
                />
              </Field>
            )}
          </>
        )}

        <FormError message={error} />
        <SubmitButton disabled={submitting} submitting={submitting}>Save</SubmitButton>
      </form>
    </Sheet>
  );
}
