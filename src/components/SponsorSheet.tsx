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
import type { Sponsor, SponsorType } from "@/lib/types";

const typeOptions: { value: SponsorType; label: string }[] = [
  { value: "non_resident", label: "Non Resident" },
  { value: "outsider", label: "Outsider" },
  { value: "stall_vendor", label: "Stall Vendor" },
  { value: "non_stall_vendor", label: "Non Stall Vendor" },
  { value: "dandiya_collection", label: "Dandiya Night Collection" },
  { value: "counter_collection", label: "Counter Collection" },
  { value: "donation_box", label: "Donation Box Collection" },
];

export function SponsorSheet({
  open,
  sponsor,
  onClose,
}: {
  open: boolean;
  /** Present to edit an existing sponsor (fixing a typo'd name or amount); absent to add a new one. */
  sponsor?: Sponsor;
  onClose: () => void;
}) {
  const { addSponsor, updateSponsor } = usePujaData();
  const [name, setName] = useState(sponsor?.name ?? "");
  const [type, setType] = useState<SponsorType>(sponsor?.type ?? "outsider");
  const [stallDetails, setStallDetails] = useState(sponsor?.stallDetails ?? "");
  const [contact, setContact] = useState(sponsor?.contact ?? "");
  const [amountPledged, setAmountPledged] = useState(sponsor?.amountPledged ?? 0);
  const { submitting, error, run } = useAsyncAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const input = {
      name: name.trim(),
      type,
      stallDetails: type === "stall_vendor" ? stallDetails.trim() || undefined : undefined,
      contact: contact.trim() || undefined,
      amountPledged,
    };
    run(
      () => (sponsor ? updateSponsor(sponsor.id, input) : addSponsor(input)),
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
    <Sheet open={open} onClose={onClose} title={sponsor ? "Edit sponsor" : "Add sponsor"}>
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

        {type === "stall_vendor" && (
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
        <SubmitButton disabled={submitting} submitting={submitting}>
          {sponsor ? "Save" : "Add sponsor"}
        </SubmitButton>
      </form>
    </Sheet>
  );
}
