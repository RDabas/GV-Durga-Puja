"use client";

import { useState } from "react";
import { PaymentSheet } from "@/components/PaymentSheet";
import { VendorCard } from "@/components/VendorCard";
import { VendorExpenseSheet } from "@/components/VendorExpenseSheet";
import { PlusIcon } from "@/components/icons";
import { usePujaData } from "@/lib/store";
import type { VendorPayment } from "@/lib/types";

export default function VendorsPage() {
  const { vendorExpenses, addVendorPayment, updateVendorPayment, deleteVendorPayment, deleteVendorExpense } =
    usePujaData();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payingFor, setPayingFor] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<{
    expenseId: string;
    payment: VendorPayment;
  } | null>(null);

  const editing = vendorExpenses.find((e) => e.id === editingId);
  const paying = vendorExpenses.find((e) => e.id === payingFor);
  const editingPaymentExpense = editingPayment
    ? vendorExpenses.find((e) => e.id === editingPayment.expenseId)
    : undefined;

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
          onEditPayment={(payment) => setEditingPayment({ expenseId: expense.id, payment })}
          onRemovePayment={(paymentId) => deleteVendorPayment(expense.id, paymentId)}
          onEdit={() => setEditingId(expense.id)}
          onDelete={() => deleteVendorExpense(expense.id)}
        />
      ))}

      <VendorExpenseSheet open={adding} onClose={() => setAdding(false)} />

      {editing && (
        <VendorExpenseSheet
          key={editing.id}
          open
          expense={editing}
          onClose={() => setEditingId(null)}
        />
      )}

      {paying && (
        <PaymentSheet
          key={paying.id}
          open
          title="Record vendor payment"
          subtitle={paying.vendor.name}
          memberLabel="Paid by"
          allowSelfFunded
          onSubmit={(input) => addVendorPayment(paying.id, input)}
          onClose={() => setPayingFor(null)}
        />
      )}

      {editingPayment && (
        <PaymentSheet
          key={editingPayment.payment.id}
          open
          title="Edit vendor payment"
          subtitle={editingPaymentExpense?.vendor.name}
          memberLabel="Paid by"
          allowSelfFunded
          payment={editingPayment.payment}
          onSubmit={(input) =>
            updateVendorPayment(editingPayment.expenseId, editingPayment.payment.id, input)
          }
          onClose={() => setEditingPayment(null)}
        />
      )}
    </div>
  );
}
