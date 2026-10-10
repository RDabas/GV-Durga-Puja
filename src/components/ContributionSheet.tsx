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
import type { ContributionStatus, House, PaymentMode } from "@/lib/types";

/** A pseudo-status: redirects this flat's owner accounting to another flat instead of recording a contribution here — see House.paidViaHouseId. */
type StatusChoice = ContributionStatus | "paid_via";

/** Accepts "G-1128", "G1128", "g 1128" — whatever someone types without thinking about the dash. */
function parseFlatLabel(raw: string): { block: string; flatNo: string } | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");
  const match = cleaned.match(/^([A-Z]+)-?(.+)$/);
  if (!match) return null;
  return { block: match[1], flatNo: match[2] };
}

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
    contribution?.collectorId ??
      members.find((m) => m.name === "Hirdesh")?.id ??
      members[0]?.id ??
      "",
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
  const partial = status === "partial";
  const needsFollowUp =
    !isPaidVia && (status === "not_home" || status === "not_visited" || status === "pending");
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

      const finalMoneyAmount = received || promised ? moneyAmount : 0;
      const finalBhogAmount = hasBhog ? bhogAmount : 0;
      const handedOver = received || hasBhog;
      await saveContribution(target, {
        collectorId: handedOver ? collectorId : undefined,
        assignedToMemberId:
          needsFollowUp && assignedTo && assignedTo !== "other" ? assignedTo : undefined,
        assignedToName:
          needsFollowUp && assignedTo === "other" ? assignedToName.trim() || undefined : undefined,
        moneyAmount: finalMoneyAmount,
        // Only meaningful when it's actually more than what's still pending —
        // otherwise there's nothing to track, so drop it rather than store a
        // number that no longer means anything.
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

        {!isPaidVia && status !== "not_visited" && (
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
