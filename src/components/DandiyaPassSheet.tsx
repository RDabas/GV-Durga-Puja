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
import { modeOptions } from "@/lib/contributionForm";
import { today } from "@/lib/format";
import { usePujaData } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";
import type { OutsideCollection, PaymentMode } from "@/lib/types";

const PRICE_PER_PERSON_PER_NIGHT = 150;

function passAmount(peopleCount: number, day18: boolean, day19: boolean): number {
  const nights = (day18 ? 1 : 0) + (day19 ? 1 : 0);
  return PRICE_PER_PERSON_PER_NIGHT * peopleCount * nights;
}

/**
 * Sells one Dandiya Night pass — a buyer name, how many people it covers,
 * and which of the two nights (18/19 Oct) — at a flat Rs.150/person/night,
 * auto-totaled. Always a straight sale (no promised/pending lifecycle like a
 * resident contribution — a pass is paid for on the spot), so this is a much
 * simpler form than OutsideCollectionSheet rather than a branch of it.
 */
export function DandiyaPassSheet({
  pass,
  open,
  onClose,
}: {
  /** Present to edit an existing pass sale; absent to record a new one. */
  pass?: { outsideCollection: OutsideCollection; peopleCount: number; day18: boolean; day19: boolean };
  open: boolean;
  onClose: () => void;
}) {
  const { saveOutsideCollection, saveContribution, contributionFor, members } = usePujaData();

  const contribution = pass
    ? contributionFor({ outsideCollectionId: pass.outsideCollection.id })
    : undefined;

  const [buyerName, setBuyerName] = useState(pass?.outsideCollection.name ?? "");
  const [peopleCount, setPeopleCount] = useState(pass?.peopleCount ?? 1);
  const [day18, setDay18] = useState(pass?.day18 ?? true);
  const [day19, setDay19] = useState(pass?.day19 ?? true);
  const [mode, setMode] = useState<PaymentMode>(
    contribution && contribution.paymentMode !== "pending" ? contribution.paymentMode : "upi",
  );
  const [collectorId, setCollectorId] = useState(
    contribution?.collectorId ?? members.find((m) => m.name === "Hirdesh")?.id ?? members[0]?.id ?? "",
  );
  const [paymentDate, setPaymentDate] = useState(contribution?.paymentDate ?? today());
  const [note, setNote] = useState(contribution?.note ?? "");
  const { submitting, error, run } = useAsyncAction();

  const amount = passAmount(peopleCount, day18, day19);
  const noNightSelected = !day18 && !day19;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!buyerName.trim() || noNightSelected || peopleCount < 1) return;

    run(async () => {
      const outsideCollectionId = await saveOutsideCollection(
        pass?.outsideCollection.id,
        buyerName.trim(),
        "dandiya_pass",
      );
      await saveContribution(
        { outsideCollectionId },
        {
          collectorId,
          moneyAmount: amount,
          bhogGroceryAmount: 0,
          contributionKind: "money",
          paymentMode: mode,
          status: "paid",
          paymentDate,
          note: note.trim() || undefined,
          passPeopleCount: peopleCount,
          passDay18: day18,
          passDay19: day19,
        },
      );
    }, onClose);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={pass ? pass.outsideCollection.name : "New Dandiya Night pass"}
      subtitle={`Rs. ${PRICE_PER_PERSON_PER_NIGHT} per person, per night`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Buyer name">
          <TextInput
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="Who's buying the pass(es)"
            autoFocus
          />
        </Field>

        <Field label="Number of people">
          <AmountInput value={peopleCount} onChange={(v) => setPeopleCount(Math.max(1, v))} />
        </Field>

        <Field label="Which night(s)?">
          <div className="flex flex-wrap gap-1.5">
            <label
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[0.8rem] font-semibold ${day18 ? "border-brand bg-brand text-white" : "border-border bg-surface text-ink-soft"}`}
            >
              <input
                type="checkbox"
                checked={day18}
                onChange={(e) => setDay18(e.target.checked)}
                className="h-4 w-4 accent-brand"
              />
              18 Oct
            </label>
            <label
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[0.8rem] font-semibold ${day19 ? "border-brand bg-brand text-white" : "border-border bg-surface text-ink-soft"}`}
            >
              <input
                type="checkbox"
                checked={day19}
                onChange={(e) => setDay19(e.target.checked)}
                className="h-4 w-4 accent-brand"
              />
              19 Oct
            </label>
          </div>
          {noNightSelected && (
            <p className="mt-1.5 text-[0.72rem] text-critical">Pick at least one night.</p>
          )}
        </Field>

        <div className="rounded-xl border border-border bg-surface-sunken p-3">
          <span className="block text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
            Total
          </span>
          <span className="mt-0.5 block text-[1.1rem] font-bold tabular-nums text-ink">
            Rs. {amount.toLocaleString("en-IN")}
          </span>
          <span className="mt-0.5 block text-[0.7rem] text-ink-faint">
            {peopleCount} {peopleCount === 1 ? "person" : "people"} × {(day18 ? 1 : 0) + (day19 ? 1 : 0)}{" "}
            night(s) × Rs. {PRICE_PER_PERSON_PER_NIGHT}
          </span>
        </div>

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
          <TextInput type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        </Field>

        <Field label="Note">
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <FormError message={error} />
        <SubmitButton disabled={submitting || noNightSelected} submitting={submitting}>
          Save
        </SubmitButton>
      </form>
    </Sheet>
  );
}
