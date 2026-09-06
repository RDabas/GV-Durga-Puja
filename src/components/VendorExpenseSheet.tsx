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
import type { VendorExpense } from "@/lib/types";

export function VendorExpenseSheet({
  open,
  expense,
  onClose,
}: {
  open: boolean;
  /** Present to edit an existing bill (fixing a typo'd name or amount); absent to add a new one. */
  expense?: VendorExpense;
  onClose: () => void;
}) {
  const { addVendorExpense, updateVendorExpense } = usePujaData();
  const [vendorName, setVendorName] = useState(expense?.vendor.name ?? "");
  const [serviceType, setServiceType] = useState(expense?.vendor.serviceType ?? "");
  const [phone, setPhone] = useState(expense?.vendor.phone ?? "");
  const [totalAmount, setTotalAmount] = useState(expense?.totalAmount ?? 0);
  const { submitting, error, run } = useAsyncAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!vendorName.trim()) return;
    const input = {
      vendorName: vendorName.trim(),
      serviceType: serviceType.trim() || "Other",
      phone: phone.trim() || undefined,
      totalAmount,
    };
    run(
      () => (expense ? updateVendorExpense(expense.id, input) : addVendorExpense(input)),
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
    <Sheet open={open} onClose={onClose} title={expense ? "Edit vendor bill" : "Add vendor bill"}>
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
        <SubmitButton disabled={submitting} submitting={submitting}>
          {expense ? "Save" : "Add bill"}
        </SubmitButton>
      </form>
    </Sheet>
  );
}
