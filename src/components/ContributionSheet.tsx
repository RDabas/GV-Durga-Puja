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

/** A pseudo-status: redirects this flat's owner accounting to another flat instead of recording a contribution here — see House.paidViaHouseId. */
type StatusChoice = ContributionStatus | "paid_via";

/** Accepts "G-1128", "G1128", "g 1128" — whatever someone types without thinking about the dash. */
function parseFlatLabel(raw: string): { block: string; flatNo: string } | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");
  const match = cleaned.match(/^([A-Z]+)-?(.+)$/);
  if (!match) return null;
  return { block: match[1], flatNo: match[2] };
}

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
    setPaidViaHouse,
    contributionFor,
    ownerOf,
    ownerFlatCount,
    houses,
    members,
  } = usePujaData();

  const owner = ownerOf(house);
  const isOwner = role === "owner";
  const payer = isOwner && owner ? { ownerId: owner.id } : { houseId: house.id };
  const contribution = contributionFor(payer);
  const flatCount = owner ? ownerFlatCount(owner.id) : 0;
  // Only offered on an owner-occupied flat (no tenant of its own) — a flat
  // with a tenant already has its own independent thing to track.
  const eligibleForPaidVia =
    isOwner && house.tenantNames.length === 0 && contributionFor({ houseId: house.id }) === undefined;
  const linkedHouseLabel = house.paidViaHouseId
    ? (() => {
        const target = houses.find((h) => h.id === house.paidViaHouseId);
        return target ? `${target.block}-${target.flatNo}` : "";
      })()
    : "";
  const statusChoiceOptions: { value: StatusChoice; label: string }[] = eligibleForPaidVia
    ? [...statusOptions, { value: "paid_via", label: "Paid via another flat" }]
    : statusOptions;

  const [names, setNames] = useState(
    isOwner ? (owner?.names ?? []).join(", ") : house.tenantNames.join(", "),
  );
  const [statusChoice, setStatusChoice] = useState<StatusChoice>(
    house.paidViaHouseId ? "paid_via" : (contribution?.status ?? "paid"),
  );
  const [paidViaLabel, setPaidViaLabel] = useState(linkedHouseLabel);
  const status: ContributionStatus = statusChoice === "paid_via" ? "not_visited" : statusChoice;
  const [kind, setKind] = useState<ContributionKind>(contribution?.contributionKind ?? "money");
  const [mode, setMode] = useState<PaymentMode>(
    !contribution || contribution.paymentMode === "pending" ? "cash" : contribution.paymentMode,
  );
  const [moneyAmount, setMoneyAmount] = useState(contribution?.moneyAmount ?? 0);
  const [originalPledgeAmount, setOriginalPledgeAmount] = useState(
    contribution?.originalPledgeAmount ?? 0,
  );
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

  const isPaidVia = statusChoice === "paid_via";
  const received = status === "paid" || status === "partial";
  const promised = status === "promised";
  const needsFollowUp =
    !isPaidVia && (status === "not_home" || status === "not_visited" || status === "pending");
  const takesBhog = kind !== "money";
  const { submitting, error, run } = useAsyncAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (isPaidVia) {
      run(async () => {
        const parsedTarget = parseFlatLabel(paidViaLabel);
        if (!parsedTarget) throw new Error("Enter a flat like G-1128");
        const targetHouse = houses.find(
          (h) => h.block === parsedTarget.block && h.flatNo === parsedTarget.flatNo,
        );
        if (!targetHouse) throw new Error(`No flat "${paidViaLabel}" found`);
        if (targetHouse.id === house.id) throw new Error("Can't link a flat to itself");
        await setPaidViaHouse(house.id, targetHouse.id);
      }, onClose);
      return;
    }

    const parsed = names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);

    run(async () => {
      // Switching away from a previous "paid via" link back to a real
      // status un-redirects this flat's accounting before saving it.
      if (house.paidViaHouseId) await setPaidViaHouse(house.id, null);

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
        // Only meaningful when it's actually more than what's still pending —
        // otherwise there's nothing to track, so drop it rather than store a
        // number that no longer means anything.
        originalPledgeAmount:
          promised && originalPledgeAmount > moneyAmount ? originalPledgeAmount : undefined,
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
          <OptionGroup value={statusChoice} onChange={setStatusChoice} options={statusChoiceOptions} />
        </Field>

        {isPaidVia && (
          <Field label="Which flat do they actually pay through?">
            <TextInput
              value={paidViaLabel}
              onChange={(e) => setPaidViaLabel(e.target.value)}
              placeholder="e.g. G-1128"
              autoFocus
            />
            <p className="mt-1.5 text-[0.72rem] text-ink-faint">
              Their status/amount will show from that flat instead, and this one won&rsquo;t need
              its own follow-up.
            </p>
          </Field>
        )}

        {!isPaidVia && (
          <Field label="Contribution">
            <OptionGroup value={kind} onChange={setKind} options={kindOptions} />
          </Field>
        )}

        {(received || promised) && kind !== "bhog_grocery" && (
          <Field
            label={
              promised
                ? originalPledgeAmount > 0
                  ? "Amount remaining"
                  : "Amount promised"
                : "Amount received"
            }
          >
            <AmountInput value={moneyAmount} onChange={setMoneyAmount} autoFocus={received} />
          </Field>
        )}

        {promised && (
          <Field label="Originally promised, if higher (optional)">
            <AmountInput value={originalPledgeAmount} onChange={setOriginalPledgeAmount} />
            <p className="mt-1.5 text-[0.72rem] text-ink-faint">
              Fill this in only if part of the promise was already covered another way
              (e.g. they paid a vendor bill directly) — then &ldquo;Amount remaining&rdquo;
              above becomes what&rsquo;s still pending. Leave at 0 for a plain promise.
            </p>
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
