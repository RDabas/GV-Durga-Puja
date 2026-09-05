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
import type { SponsorType } from "@/lib/types";

const typeOptions: { value: SponsorType; label: string }[] = [
  { value: "outside", label: "Outside" },
  { value: "stall", label: "Stall" },
  { value: "no_stall", label: "No stall" },
];

export function SponsorSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addSponsor } = usePujaData();
  const [name, setName] = useState("");
  const [type, setType] = useState<SponsorType>("outside");
  const [stallDetails, setStallDetails] = useState("");
  const [contact, setContact] = useState("");
  const [amountPledged, setAmountPledged] = useState(0);
  const { submitting, error, run } = useAsyncAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    run(
      () =>
        addSponsor({
          name: name.trim(),
          type,
          stallDetails: type === "stall" ? stallDetails.trim() || undefined : undefined,
          contact: contact.trim() || undefined,
          amountPledged,
        }),
      () => {
        setName("");
        setStallDetails("");
        setContact("");
        setAmountPledged(0);
        onClose();
      },
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add sponsor">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Business or family name"
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

        <Field label="Amount pledged">
          <AmountInput value={amountPledged} onChange={setAmountPledged} />
        </Field>

        <Field label="Contact">
          <TextInput
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <FormError message={error} />
        <SubmitButton disabled={submitting}>Add sponsor</SubmitButton>
      </form>
    </Sheet>
  );
}
