"use client";

import { useState } from "react";
import { PaymentSheet } from "@/components/PaymentSheet";
import { VendorCard } from "@/components/VendorCard";
import { VendorExpenseSheet } from "@/components/VendorExpenseSheet";
import { PlusIcon } from "@/components/icons";
import { usePujaData } from "@/lib/store";

export default function VendorsPage() {
  const { vendorExpenses, addVendorPayment, deleteVendorExpense } = usePujaData();
  const [adding, setAdding] = useState(false);
  const [payingFor, setPayingFor] = useState<string | null>(null);

  const paying = vendorExpenses.find((e) => e.id === payingFor);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="px-0.5 text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
          Vendor expenses
        </p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-xl bg-brand px-3 py-1.5 text-[0.75rem] font-semibold text-white active:scale-[0.98]"
        >
          <PlusIcon className="h-[13px] w-[13px]" />
          Add bill
        </button>
      </div>

      {vendorExpenses.map((expense) => (
        <VendorCard
          key={expense.id}
          expense={expense}
          onRecordPayment={() => setPayingFor(expense.id)}
          onDelete={() => deleteVendorExpense(expense.id)}
        />
      ))}

      <VendorExpenseSheet open={adding} onClose={() => setAdding(false)} />

      {paying && (
        <PaymentSheet
          key={paying.id}
          open
          title="Record vendor payment"
          subtitle={paying.vendor.name}
          memberLabel="Paid by"
          onSubmit={(input) => addVendorPayment(paying.id, input)}
          onClose={() => setPayingFor(null)}
        />
      )}
    </div>
  );
}
