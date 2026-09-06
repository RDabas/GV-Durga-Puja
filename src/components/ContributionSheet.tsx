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
import type {
  ContributionKind,
  ContributionStatus,
  House,
  PaymentMode,
} from "@/lib/types";

const statusOptions: { value: ContributionStatus; label: string }[] = [
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "promised", label: "Promised" },
  { value: "pending", label: "Pending" },
  { value: "not_home", label: "Nobody home" },
  { value: "not_visited", label: "Not visited" },
];

function followUpNoteLabel(status: ContributionStatus): string {
  switch (status) {
    case "promised":
      return "Follow-up note";
    case "pending":
      return "Note — what did they say?";
    default:
      return "Note for next visit";
  }
}

const kindOptions: { value: ContributionKind; label: string }[] = [
  { value: "money", label: "Money" },
  { value: "bhog_grocery", label: "Bhog / grocery" },
  { value: "both", label: "Both" },
];

const modeOptions: { value: PaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "gpay", label: "GPay" },
  { value: "phonepe", label: "PhonePe" },
  { value: "other_upi", label: "Other UPI" },
];

export function ContributionSheet({
  house,
  role,
  open,
  onClose,
}: {
  house: House;
  role: "owner" | "tenant";
  open: boolean;
  onClose: () => void;
}) {
  const {
    saveContribution,
    saveOwner,
    saveTenants,
    contributionFor,
    ownerOf,
    ownerFlatCount,
    members,
  } = usePujaData();

  const owner = ownerOf(house);
  const isOwner = role === "owner";
  const payer = isOwner && owner ? { ownerId: owner.id } : { houseId: house.id };
  const contribution = contributionFor(payer);
  const flatCount = owner ? ownerFlatCount(owner.id) : 0;

  const [names, setNames] = useState(
    isOwner ? (owner?.names ?? []).join(", ") : house.tenantNames.join(", "),
  );
  const [status, setStatus] = useState<ContributionStatus>(contribution?.status ?? "paid");
  const [kind, setKind] = useState<ContributionKind>(contribution?.contributionKind ?? "money");
  const [mode, setMode] = useState<PaymentMode>(
    !contribution || contribution.paymentMode === "pending" ? "cash" : contribution.paymentMode,
  );
  const [moneyAmount, setMoneyAmount] = useState(contribution?.moneyAmount ?? 0);
  const [bhogAmount, setBhogAmount] = useState(contribution?.bhogGroceryAmount ?? 0);
  const [collectorId, setCollectorId] = useState(
    contribution?.collectorId ?? members[0]?.id ?? "",
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
  const needsFollowUp =
    status === "not_home" || status === "not_visited" || status === "pending";
  const takesBhog = kind !== "money";
  const { submitting, error, run } = useAsyncAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);

    run(async () => {
      // saveOwner returns the id so a flat that had no owner still gets its
      // contribution attached to the owner it just created.
      const target = isOwner
        ? { ownerId: await saveOwner(house.id, parsed) }
        : { houseId: house.id };
      if (!isOwner) await saveTenants(house.id, parsed);

      await saveContribution(target, {
        collectorId: received ? collectorId : undefined,
        assignedToMemberId:
          needsFollowUp && assignedTo && assignedTo !== "other" ? assignedTo : undefined,
        assignedToName:
          needsFollowUp && assignedTo === "other" ? assignedToName.trim() || undefined : undefined,
        moneyAmount: received || promised ? moneyAmount : 0,
        bhogGroceryAmount: received && takesBhog ? bhogAmount : 0,
        contributionKind: kind,
        paymentMode: received ? mode : "pending",
        status,
        paymentDate: received ? paymentDate : undefined,
        note: note.trim() || undefined,
        followUpNote: followUpNote.trim() || undefined,
      });
    }, onClose);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${house.block}-${house.flatNo} · ${isOwner ? "Owner" : "Tenant"}`}
      subtitle={
        isOwner && flatCount > 1
          ? `Owns ${flatCount} flats — one payment covers all of them`
          : `Floor ${house.floor}`
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={isOwner ? "Owner name(s)" : "Tenant name(s)"}>
          <TextInput
            value={names}
            onChange={(e) => setNames(e.target.value)}
            placeholder="Separate several names with commas"
          />
        </Field>

        <Field label="Status">
          <OptionGroup value={status} onChange={setStatus} options={statusOptions} />
        </Field>

        <Field label="Contribution">
          <OptionGroup value={kind} onChange={setKind} options={kindOptions} />
        </Field>

        {(received || promised) && kind !== "bhog_grocery" && (
          <Field label={promised ? "Amount promised" : "Amount received"}>
            <AmountInput value={moneyAmount} onChange={setMoneyAmount} autoFocus={received} />
          </Field>
        )}

        {received && (
          <>
            {takesBhog && (
              <Field label="Bhog / grocery value">
                <AmountInput value={bhogAmount} onChange={setBhogAmount} />
              </Field>
            )}

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

        {(status === "promised" || needsFollowUp) && (
          <Field label={followUpNoteLabel(status)}>
            <TextInput
              value={followUpNote}
              onChange={(e) => setFollowUpNote(e.target.value)}
              placeholder={
                status === "promised"
                  ? "e.g. said after the 12th"
                  : status === "pending"
                    ? "e.g. checking with spouse, will confirm"
                    : "e.g. try again evening"
              }
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
