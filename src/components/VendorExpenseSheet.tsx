"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "@/components/Sheet";
import {
  AmountInput,
  Field,
  FormError,
  SubmitButton,
  TextInput,
} from "@/components/FormControls";
import { usePujaData } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";

export function VendorExpenseSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { addVendorExpense } = usePujaData();
  const [vendorName, setVendorName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [phone, setPhone] = useState("");
  const [totalAmount, setTotalAmount] = useState(0);
  const { submitting, error, run } = useAsyncAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!vendorName.trim()) return;
    run(
      () =>
        addVendorExpense({
          vendorName: vendorName.trim(),
          serviceType: serviceType.trim() || "Other",
          phone: phone.trim() || undefined,
          totalAmount,
        }),
      () => {
        setVendorName("");
        setServiceType("");
        setPhone("");
        setTotalAmount(0);
        onClose();
      },
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add vendor bill">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Vendor">
          <TextInput
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="e.g. Maa Tara Decorators"
            autoFocus
          />
        </Field>

        <Field label="Service">
          <TextInput
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            placeholder="e.g. Pandal & lighting"
          />
        </Field>

        <Field label="Total amount">
          <AmountInput value={totalAmount} onChange={setTotalAmount} />
        </Field>

        <Field label="Phone">
          <TextInput
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <FormError message={error} />
        <SubmitButton disabled={submitting}>Add bill</SubmitButton>
      </form>
    </Sheet>
  );
}
