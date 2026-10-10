"use client";

import { useState } from "react";
import { PaymentSheet } from "@/components/PaymentSheet";
import { VendorCard } from "@/components/VendorCard";
import { VendorExpenseSheet } from "@/components/VendorExpenseSheet";
import { PlusIcon } from "@/components/icons";
import { usePujaData } from "@/lib/store";
import type { VendorPayment } from "@/lib/types";

type SortField = "name" | "total" | "balance";

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
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ field: SortField; dir: "asc" | "desc" }>({
    field: "name",
    dir: "asc",
  });

  const editing = vendorExpenses.find((e) => e.id === editingId);
  const paying = vendorExpenses.find((e) => e.id === payingFor);
  const editingPaymentExpense = editingPayment
    ? vendorExpenses.find((e) => e.id === editingPayment.expenseId)
    : undefined;

  function toggleSort(field: SortField) {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: field === "name" ? "asc" : "desc" },
    );
  }

  function balanceOf(expense: (typeof vendorExpenses)[number]): number {
    return expense.totalAmount - expense.payments.reduce((sum, p) => sum + p.amount, 0);
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? vendorExpenses.filter(
        (e) =>
          e.vendor.name.toLowerCase().includes(q) || e.vendor.serviceType.toLowerCase().includes(q),
      )
    : vendorExpenses;

  const dir = sort.dir === "asc" ? 1 : -1;
  const sortedExpenses = [...filtered].sort((a, b) => {
    if (sort.field === "total") return dir * (a.totalAmount - b.totalAmount);
    if (sort.field === "balance") return dir * (balanceOf(a) - balanceOf(b));
    return dir * a.vendor.name.localeCompare(b.vendor.name);
  });

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

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by vendor or service"
        className="w-full rounded-xl border border-border bg-surface-sunken px-3 py-2.5 text-[0.9rem] text-ink outline-none focus:border-brand"
      />

      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
        <span className="shrink-0 text-[0.68rem] font-semibold text-ink-faint">Sort</span>
        {(
          [
            { field: "name" as const, label: "Name" },
            { field: "total" as const, label: "Total" },
            { field: "balance" as const, label: "Balance" },
          ]
        ).map(({ field, label }) => (
          <button
            key={field}
            type="button"
            onClick={() => toggleSort(field)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold transition active:scale-95 ${
              sort.field === field
                ? "bg-brand text-white"
                : "border border-border bg-surface text-ink-soft"
            }`}
          >
            {label}
            {sort.field === field && (sort.dir === "asc" ? " ↑" : " ↓")}
          </button>
        ))}
      </div>

      {sortedExpenses.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-3.5 text-[0.8rem] text-ink-faint">
          {q ? `No matches for "${search}".` : "No vendor bills yet."}
        </p>
      )}

      {sortedExpenses.map((expense) => (
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
