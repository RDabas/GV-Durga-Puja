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
import type {
  ContributionStatus,
  OutsideCollection,
  OutsideCollectionType,
  PaymentMode,
} from "@/lib/types";

const typeOptions: { value: OutsideCollectionType; label: string }[] = [
  { value: "outsider", label: "Outsider" },
  { value: "donation", label: "Donation" },
  { value: "donation_box", label: "Donation Box Collection" },
  { value: "stall", label: "Stall" },
  { value: "dandiya_collection", label: "Dandiya Night Collection" },
  { value: "promotion", label: "Promotion" },
];

/**
 * Add or edit an Outside Collection entry — money from outside the society
 * (a stall, a donation, an outsider gift) not tied to any flat. Mirrors
 * ExResidentSheet's fields exactly (status/amount/mode/collector/follow-up),
 * plus a type picker and a stall-location field shown only for type "stall".
 */
export function OutsideCollectionSheet({
  outsideCollection,
  open,
  onClose,
}: {
  /** Present to edit an existing entry; absent to add a new one. */
  outsideCollection?: OutsideCollection;
  open: boolean;
  onClose: () => void;
}) {
  const { saveOutsideCollection, saveContribution, contributionFor, members } = usePujaData();

  const contribution = outsideCollection
    ? contributionFor({ outsideCollectionId: outsideCollection.id })
    : undefined;

  const [name, setName] = useState(outsideCollection?.name ?? "");
  const [type, setType] = useState<OutsideCollectionType>(outsideCollection?.type ?? "outsider");
  const [stallDetails, setStallDetails] = useState(outsideCollection?.stallDetails ?? "");
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
  const bhogOnlyStatus = status === "bhog_only";
  const bhogChecked = bhogOnlyStatus || hasBhog;
  const needsFollowUp = status === "not_home" || status === "not_visited" || status === "pending";
  const { submitting, error, run } = useAsyncAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const finalMoneyAmount = received || promised ? moneyAmount : 0;
    const finalBhogAmount = bhogChecked ? bhogAmount : 0;
    const handedOver = received || bhogChecked;

    run(async () => {
      const outsideCollectionId = await saveOutsideCollection(
        outsideCollection?.id,
        name.trim(),
        type,
        type === "stall" ? stallDetails.trim() || undefined : undefined,
      );

      await saveContribution(
        { outsideCollectionId },
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
      title={outsideCollection ? outsideCollection.name : "New outside collection"}
      subtitle="Outside Collection · not tied to any flat"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Business or contributor name"
            autoFocus
          />
        </Field>

        <Field label="Type">
          <OptionGroup value={type} onChange={setType} options={typeOptions} />
        </Field>

        {type === "stall" && (
          <Field label="Stall location">
            <TextInput
              value={stallDetails}
              onChange={(e) => setStallDetails(e.target.value)}
              placeholder="e.g. Gate 2"
            />
          </Field>
        )}

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

        {bhogOnlyStatus && (
          <Field label="Bhog / groceries value">
            <AmountInput value={bhogAmount} onChange={setBhogAmount} autoFocus />
          </Field>
        )}

        {!bhogOnlyStatus && status !== "not_visited" && (
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

        {(received || bhogChecked) && (
          <>
            {received && (
              <Field label="Paid by">
                <OptionGroup value={mode} onChange={setMode} options={modeOptions} />
              </Field>
            )}

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
